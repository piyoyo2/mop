import type { AgentTool, AgentToolContext, AgentToolResult, AgentToolUpdateCallback } from "@oh-my-pi/pi-agent-core";
import { type } from "@oh-my-pi/omptype";
import ghostPhraseScanDescription from "../../prompts/tools/ghost-phrase-scan.md" with { type: "text" };
import { throwIfAborted } from "../tool-errors";
import { GHOST_CATEGORY_WEIGHTS, GHOST_PHRASE_CATEGORIES, type GhostCategory } from "./domain";

const ghostPhraseScanSchema = type({
	text: type("string").describe("The text to scan for AI-generation artifacts and stock phrasing."),
});

export type GhostPhraseScanParams = typeof ghostPhraseScanSchema.infer;

export interface GhostPhraseMatch {
	/** The matched phrase, or the matched span for a formulaic contrast. */
	phrase: string;
	category: GhostCategory;
	/** Character offset of the match in the scanned text. */
	index: number;
}

export interface GhostPhraseScanDetails {
	matches: GhostPhraseMatch[];
	match_count: number;
	/** 0-100 slop-risk score for the ghost lens. */
	slop_risk: number;
}

/** "it's not just X, it's Y" — the formulaic-contrast sentence shape. */
const FORMULAIC_CONTRAST = /it'?s not (?:just |only )?[^.!?]+,\s*it'?s\s+[^.!?]+/gi;

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary regex for a literal phrase.
 *
 * `\b` is anchored only on an edge that is actually a word character — a
 * trailing `\b` after "certainly!" would be meaningless.
 */
function phraseRegex(phrase: string): RegExp {
	const escaped = escapeRegExp(phrase);
	const startsWord = /\w/.test(phrase[0] ?? "");
	const endsWord = /\w/.test(phrase[phrase.length - 1] ?? "");
	return new RegExp(`${startsWord ? "\\b" : ""}${escaped}${endsWord ? "\\b" : ""}`, "gi");
}

/** Find every ghost phrase in `text`. */
export function scanGhostPhrases(text: string): GhostPhraseMatch[] {
	const matches: GhostPhraseMatch[] = [];

	for (const [category, phrases] of Object.entries(GHOST_PHRASE_CATEGORIES)) {
		for (const phrase of phrases) {
			for (const match of text.matchAll(phraseRegex(phrase))) {
				matches.push({ phrase, category: category as GhostCategory, index: match.index ?? 0 });
			}
		}
	}

	for (const match of text.matchAll(FORMULAIC_CONTRAST)) {
		matches.push({ phrase: match[0], category: "formulaic_contrast", index: match.index ?? 0 });
	}

	matches.sort((a, b) => a.index - b.index);
	return matches;
}

/**
 * Composite 0-100 slop-risk score for the ghost lens: the weighted density of
 * matches per 1 000 words, clamped to 100.
 */
export function computeGhostSlopScore(matches: GhostPhraseMatch[], text: string): number {
	const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
	if (wordCount === 0 || matches.length === 0) return 0;
	const weighted = matches.reduce((sum, match) => sum + (GHOST_CATEGORY_WEIGHTS[match.category] ?? 12), 0);
	return Math.min(100, Math.round((weighted / wordCount) * 1000));
}

/**
 * Ghost-content lens: content in the text that belongs to a different genre.
 */
export class GhostPhraseScanTool implements AgentTool<typeof ghostPhraseScanSchema, GhostPhraseScanDetails> {
	readonly name = "ghost_phrase_scan";
	readonly label = "Ghost phrase scan";
	readonly description = ghostPhraseScanDescription;
	readonly parameters = ghostPhraseScanSchema;
	readonly approval = "read" as const;
	readonly intent = "omit" as const;
	readonly strict = true;

	async execute(
		_toolCallId: string,
		params: GhostPhraseScanParams,
		signal?: AbortSignal,
		_onUpdate?: AgentToolUpdateCallback<GhostPhraseScanDetails>,
		_context?: AgentToolContext,
	): Promise<AgentToolResult<GhostPhraseScanDetails>> {
		throwIfAborted(signal);
		const matches = scanGhostPhrases(params.text);
		const slop_risk = computeGhostSlopScore(matches, params.text);
		const text =
			matches.length === 0
				? "no matches found · slop-risk 0/100"
				: `${matches.map(match => `"${match.phrase}" (${match.category})`).join("\n")}\nslop-risk ${slop_risk}/100`;

		return {
			content: [{ type: "text", text }],
			details: { matches, match_count: matches.length, slop_risk },
		};
	}
}
