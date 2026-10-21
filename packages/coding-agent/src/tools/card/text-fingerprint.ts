import type { AgentTool, AgentToolContext, AgentToolResult, AgentToolUpdateCallback } from "@oh-my-pi/pi-agent-core";
import { type } from "@oh-my-pi/omptype";
import textFingerprintDescription from "../../prompts/tools/text-fingerprint.md" with { type: "text" };
import { throwIfAborted } from "../tool-errors";
import {
	clamp01,
	countMatches,
	FINGERPRINT_WEIGHTS,
	FUNCTION_WORDS,
	type FunctionWord,
	perThousand,
	splitWords,
} from "./domain";

const textFingerprintSchema = type({
	text: type("string").describe(
		"The text to compute punctuation-density, function-word, and word-length statistics for.",
	),
});

export type TextFingerprintParams = typeof textFingerprintSchema.infer;

export interface TextFingerprintDetails {
	/** Occurrences per 1 000 characters. */
	punctuation_density: {
		comma: number;
		semicolon: number;
		em_dash: number;
		ellipsis: number;
	};
	/** Occurrences per 1 000 words, per tracked function word. */
	function_word_ratio: Record<FunctionWord, number>;
	avg_word_length: number;
	/** 0-100 slop-risk score for the fingerprint lens. */
	slop_risk: number;
}

const FUNCTION_WORD_PATTERNS: Readonly<Record<FunctionWord, RegExp>> = Object.fromEntries(
	FUNCTION_WORDS.map(word => [word, new RegExp(`\\b${word}\\b`, "gi")]),
) as Record<FunctionWord, RegExp>;

export interface TextFingerprintMetrics extends Omit<TextFingerprintDetails, "slop_risk"> {}

/** Compute the fingerprint-lens metrics for a piece of text. */
export function computeTextFingerprint(text: string): TextFingerprintMetrics {
	const totalChars = text.length;

	const punctuation_density = {
		comma: perThousand(countMatches(text, /,/g), totalChars),
		semicolon: perThousand(countMatches(text, /;/g), totalChars),
		em_dash: perThousand(countMatches(text, /—|--/g), totalChars),
		ellipsis: perThousand(countMatches(text, /…|\.\.\./g), totalChars),
	};

	const wordList = splitWords(text);
	const totalWords = wordList.length;

	const function_word_ratio = Object.fromEntries(
		FUNCTION_WORDS.map(word => [word, perThousand(countMatches(text, FUNCTION_WORD_PATTERNS[word]), totalWords)]),
	) as Record<FunctionWord, number>;

	const avg_word_length = totalWords === 0 ? 0 : wordList.reduce((sum, word) => sum + word.length, 0) / totalWords;

	return { punctuation_density, function_word_ratio, avg_word_length };
}

// Sub-risk normalisations. The knees are the thresholds stated in
// `skills/forensics/references/slop-scoring.md`; the denominators set how fast
// each sub-risk saturates past its knee.

/**
 * Em-dash density outside the natural 0.5-3 per 1 000 band raises the risk, in
 * either direction: no em dashes at all is as unusual as a great many.
 */
function emDashRisk(emDashDensity: number): number {
	if (emDashDensity >= 0.5 && emDashDensity <= 3) return 0;
	const distance = emDashDensity < 0.5 ? 0.5 - emDashDensity : emDashDensity - 3;
	const scale = emDashDensity < 0.5 ? 0.5 : 5;
	return clamp01(distance / scale);
}

/**
 * A flat function-word distribution reads as mechanical; natural language has
 * an uneven spread. The coefficient of variation of the ratios measures that
 * spread — the lower it is, the higher the risk.
 */
function functionWordFlatnessRisk(ratios: Record<string, number>): number {
	const values = Object.values(ratios);
	if (values.length === 0) return 0;
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	if (mean === 0) return 0;
	const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
	const coefficientOfVariation = Math.sqrt(variance) / mean;
	return clamp01((0.6 - coefficientOfVariation) / 0.6);
}

/** Average word length outside the 4-5.5 character band raises the risk. */
function wordLengthRisk(avgWordLength: number): number {
	if (avgWordLength >= 4 && avgWordLength <= 5.5) return 0;
	const distance = avgWordLength < 4 ? 4 - avgWordLength : avgWordLength - 5.5;
	return clamp01(distance / 2);
}

/**
 * Composite 0-100 slop-risk score for the fingerprint lens.
 *
 * A screen, never a verdict: it says the text has a mechanically uniform
 * stylistic fingerprint, not that a machine wrote it.
 */
export function computeFingerprintSlopScore(metrics: TextFingerprintMetrics): number {
	// No words means no words to measure — an empty field is not slop.
	if (metrics.avg_word_length === 0) return 0;
	const risk =
		FINGERPRINT_WEIGHTS.emDash * emDashRisk(metrics.punctuation_density.em_dash) +
		FINGERPRINT_WEIGHTS.functionWordFlatness * functionWordFlatnessRisk(metrics.function_word_ratio) +
		FINGERPRINT_WEIGHTS.wordLength * wordLengthRisk(metrics.avg_word_length);
	return Math.round(risk * 100);
}

/**
 * Fingerprint lens: the stylistic signature of a piece of text.
 */
export class TextFingerprintTool implements AgentTool<typeof textFingerprintSchema, TextFingerprintDetails> {
	readonly name = "text_fingerprint";
	readonly label = "Text fingerprint";
	readonly description = textFingerprintDescription;
	readonly parameters = textFingerprintSchema;
	readonly approval = "read" as const;
	readonly intent = "omit" as const;
	readonly strict = true;

	async execute(
		_toolCallId: string,
		params: TextFingerprintParams,
		signal?: AbortSignal,
		_onUpdate?: AgentToolUpdateCallback<TextFingerprintDetails>,
		_context?: AgentToolContext,
	): Promise<AgentToolResult<TextFingerprintDetails>> {
		throwIfAborted(signal);
		const metrics = computeTextFingerprint(params.text);
		const slop_risk = computeFingerprintSlopScore(metrics);
		const { comma, semicolon, em_dash, ellipsis } = metrics.punctuation_density;
		const text = [
			`comma ${comma.toFixed(1)}/1k`,
			`semicolon ${semicolon.toFixed(1)}/1k`,
			`em dash ${em_dash.toFixed(1)}/1k`,
			`ellipsis ${ellipsis.toFixed(1)}/1k`,
			`avg word length ${metrics.avg_word_length.toFixed(2)} chars`,
			`slop-risk ${slop_risk}/100`,
		].join(" · ");

		return {
			content: [{ type: "text", text }],
			details: { ...metrics, slop_risk },
		};
	}
}
