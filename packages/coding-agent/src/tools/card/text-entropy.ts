import type { AgentTool, AgentToolContext, AgentToolResult, AgentToolUpdateCallback } from "@oh-my-pi/pi-agent-core";
import { type } from "@oh-my-pi/omptype";
import textEntropyDescription from "../../prompts/tools/text-entropy.md" with { type: "text" };
import { throwIfAborted } from "../tool-errors";
import { clamp01, ENTROPY_WEIGHTS, frequency, shannonEntropy, splitSentences, splitWords } from "./domain";

const textEntropySchema = type({
	text: type("string").describe("The text to compute entropy, repetition, and vocabulary statistics for."),
});

export type TextEntropyParams = typeof textEntropySchema.infer;

export interface TextEntropyDetails {
	/** Shannon entropy in bits per character. */
	shannon_entropy_char: number;
	/** Shannon entropy in bits per word. */
	shannon_entropy_word: number;
	avg_sentence_length: number;
	sentence_length_variance: number;
	/** Share of word trigrams that occur more than once. */
	repetition_rate: number;
	/** Type-token ratio. */
	vocabulary_richness: number;
	/** 0-100 slop-risk score for the entropy lens. */
	slop_risk: number;
}

const ZERO_METRICS = {
	shannon_entropy_char: 0,
	shannon_entropy_word: 0,
	avg_sentence_length: 0,
	sentence_length_variance: 0,
	repetition_rate: 0,
	vocabulary_richness: 0,
} as const;

export interface TextEntropyMetrics extends Omit<TextEntropyDetails, "slop_risk"> {}

/** Compute the entropy-lens metrics for a piece of text. */
export function computeTextEntropy(text: string): TextEntropyMetrics {
	if (text.trim().length === 0) return { ...ZERO_METRICS };

	const chars = Array.from(text);
	const shannon_entropy_char = shannonEntropy(frequency(chars), chars.length);

	const wordList = splitWords(text);
	const shannon_entropy_word = shannonEntropy(frequency(wordList), wordList.length);

	const sentenceList = splitSentences(text);
	const sentenceLengths = sentenceList.map(sentence => sentence.split(/\s+/).filter(Boolean).length);
	const avg_sentence_length =
		sentenceLengths.length === 0 ? 0 : sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
	const sentence_length_variance =
		sentenceLengths.length === 0
			? 0
			: sentenceLengths.reduce((sum, len) => sum + (len - avg_sentence_length) ** 2, 0) / sentenceLengths.length;

	let repetition_rate = 0;
	if (wordList.length >= 3) {
		const trigrams: string[] = [];
		for (let i = 0; i <= wordList.length - 3; i++) {
			trigrams.push(`${wordList[i]} ${wordList[i + 1]} ${wordList[i + 2]}`);
		}
		const trigramCounts = frequency(trigrams);
		let repeated = 0;
		for (const count of trigramCounts.values()) {
			if (count > 1) repeated++;
		}
		repetition_rate = trigrams.length === 0 ? 0 : repeated / trigrams.length;
	}

	const vocabulary_richness = wordList.length === 0 ? 0 : new Set(wordList).size / wordList.length;

	return {
		shannon_entropy_char,
		shannon_entropy_word,
		avg_sentence_length,
		sentence_length_variance,
		repetition_rate,
		vocabulary_richness,
	};
}

// Sub-risk normalisations. The knees are the thresholds stated in
// `skills/forensics/references/slop-scoring.md`; the denominators set how fast
// each sub-risk saturates past its knee.

/** Type-token ratio below 0.6 raises the risk; it saturates at 0.3. */
function vocabularyRichnessRisk(vocabulary_richness: number): number {
	return clamp01((0.6 - vocabulary_richness) / 0.3);
}

/** Sentence-length variance below 8 raises the risk; it saturates at 1. */
function sentenceVarianceRisk(sentence_length_variance: number): number {
	return clamp01((8 - sentence_length_variance) / 7);
}

/** Trigram repetition above 0.3 raises the risk; it saturates at 0.3. */
function repetitionRisk(repetition_rate: number): number {
	return clamp01(repetition_rate / 0.3);
}

/**
 * Word entropy outside the 4-8 bit band raises the risk, in either direction.
 * Both flat vocabulary and unusually varied vocabulary are signals.
 */
function wordEntropyRisk(shannon_entropy_word: number): number {
	if (shannon_entropy_word >= 4 && shannon_entropy_word <= 8) return 0;
	const distance = shannon_entropy_word < 4 ? 4 - shannon_entropy_word : shannon_entropy_word - 8;
	return clamp01(distance / 4);
}

/**
 * Composite 0-100 slop-risk score for the entropy lens.
 *
 * A screen, never a verdict: it says the text has the statistical shape of
 * generated prose, not that a machine wrote it.
 */
export function computeEntropySlopScore(metrics: TextEntropyMetrics): number {
	// Nothing measured means nothing to score — an empty field is not slop.
	if (metrics.avg_sentence_length === 0) return 0;
	const risk =
		ENTROPY_WEIGHTS.vocabularyRichness * vocabularyRichnessRisk(metrics.vocabulary_richness) +
		ENTROPY_WEIGHTS.sentenceVariance * sentenceVarianceRisk(metrics.sentence_length_variance) +
		ENTROPY_WEIGHTS.repetition * repetitionRisk(metrics.repetition_rate) +
		ENTROPY_WEIGHTS.wordEntropy * wordEntropyRisk(metrics.shannon_entropy_word);
	return Math.round(risk * 100);
}

/**
 * Entropy lens: the statistical shape of a piece of text.
 */
export class TextEntropyTool implements AgentTool<typeof textEntropySchema, TextEntropyDetails> {
	readonly name = "text_entropy";
	readonly label = "Text entropy";
	readonly description = textEntropyDescription;
	readonly parameters = textEntropySchema;
	readonly approval = "read" as const;
	readonly intent = "omit" as const;
	readonly strict = true;

	async execute(
		_toolCallId: string,
		params: TextEntropyParams,
		signal?: AbortSignal,
		_onUpdate?: AgentToolUpdateCallback<TextEntropyDetails>,
		_context?: AgentToolContext,
	): Promise<AgentToolResult<TextEntropyDetails>> {
		throwIfAborted(signal);
		const metrics = computeTextEntropy(params.text);
		const slop_risk = computeEntropySlopScore(metrics);
		const text = [
			`${metrics.shannon_entropy_char.toFixed(2)} bits/char`,
			`${metrics.shannon_entropy_word.toFixed(2)} bits/word`,
			`${metrics.avg_sentence_length.toFixed(1)} words/sentence`,
			`variance ${metrics.sentence_length_variance.toFixed(2)}`,
			`repetition ${(metrics.repetition_rate * 100).toFixed(1)}%`,
			`vocab richness ${metrics.vocabulary_richness.toFixed(2)}`,
			`slop-risk ${slop_risk}/100`,
		].join(" · ");

		return {
			content: [{ type: "text", text }],
			details: { ...metrics, slop_risk },
		};
	}
}
