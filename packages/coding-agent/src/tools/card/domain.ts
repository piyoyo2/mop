/**
 * Domain constants and shared text statistics for mop's card-analysis tools.
 *
 * Every threshold in this file is the executable form of a number stated in a
 * skill reference file. The reference file is the spec; this module is what the
 * tools compute against. When the two disagree, the reference file wins and
 * this module is the bug.
 *
 * | Constant group | Spec |
 * |---|---|
 * | budget bands | `skills/token-economics/references/budget-bands.md` |
 * | macro set | `skills/macro-rules/references/macro-reference.md` |
 * | ghost phrases, slop weights | `skills/forensics/references/slop-scoring.md` |
 * | ghost categories | `skills/forensics/references/forensics-lenses.md` |
 *
 * The sub-risk *normalisation* scales (how fast a sub-risk saturates past its
 * knee) are not stated in the reference files — they are implementation detail
 * of the "sub-risk rises when" thresholds, which are.
 */

// =============================================================================
// Budget bands (skills/token-economics/references/budget-bands.md)
// =============================================================================

/** Band boundaries for the permanent pair (Scenario + Personality). */
export const PERMANENT_BANDS = {
	/** Below this the permanent pair is under-specified. */
	underSpecified: 2000,
	/** At or below this the permanent pair is in the sweet spot. */
	sweetSpot: 3000,
	/** At or below this the permanent pair may be genuinely lorepacked. */
	lorepacked: 6000,
	/** At or above this the permanent pair is bloated. */
	bloated: 7000,
} as const;

/** Band boundaries for a lorebook's constant hub entry. */
export const HUB_BANDS = {
	/** At or below this the hub is within aim. */
	aim: 300,
	/** At or above this the hub is over the hard ceiling. */
	ceiling: 1000,
} as const;

/** Band boundaries for a single lorebook conditional entry. */
export const ENTRY_BANDS = {
	/** At or below this the entry is within the soft target. */
	soft: 300,
	/** At or above this the entry is over the hard cap. */
	hard: 400,
} as const;

export const PERMANENT_BAND_NAMES = [
	"under_specified",
	"sweet_spot",
	"lorepacked_range",
	"approaching_bloat",
	"bloated",
] as const;
export type PermanentBand = (typeof PERMANENT_BAND_NAMES)[number];

export const HUB_BAND_NAMES = ["within_aim", "above_aim_below_ceiling", "over_ceiling"] as const;
export type HubBand = (typeof HUB_BAND_NAMES)[number];

export const ENTRY_BAND_NAMES = ["within_soft", "above_soft_within_hard", "over_hard"] as const;
export type EntryBand = (typeof ENTRY_BAND_NAMES)[number];

/** A band verdict plus the advisory note that goes with it, when there is one. */
export interface BandVerdict<TBand extends string> {
	band: TBand;
	/** Present when the band is outside the target range. */
	flag?: string;
}

export function permanentBand(tokens: number): BandVerdict<PermanentBand> {
	if (tokens < PERMANENT_BANDS.underSpecified) {
		return {
			band: "under_specified",
			flag: `permanent definition (Scenario+Personality) is ~${tokens} tokens — under the 2k-3k sweet spot, usually means the card is under-specified`,
		};
	}
	if (tokens <= PERMANENT_BANDS.sweetSpot) return { band: "sweet_spot" };
	if (tokens <= PERMANENT_BANDS.lorepacked) {
		return {
			band: "lorepacked_range",
			flag: `permanent definition is ~${tokens} tokens — above the 2k-3k sweet spot; fine if genuinely lorepacked (dense, non-redundant), otherwise trim or move situational lore to a lorebook`,
		};
	}
	if (tokens < PERMANENT_BANDS.bloated) {
		return {
			band: "approaching_bloat",
			flag: `permanent definition is ~${tokens} tokens — past the healthy band (especially past 6k); consider proposing a lorebook to offload reference lore`,
		};
	}
	return {
		band: "bloated",
		flag: `permanent definition is ~${tokens} tokens — bloated territory (7k+); look for repetition or generic filler, and propose a lorebook for reference lore`,
	};
}

export function hubBand(tokens: number): BandVerdict<HubBand> {
	if (tokens <= HUB_BANDS.aim) return { band: "within_aim" };
	if (tokens < HUB_BANDS.ceiling) {
		return {
			band: "above_aim_below_ceiling",
			flag: `lorebook hub is ~${tokens} tokens — above the ~200-300 aim but still under the ~1000 ceiling`,
		};
	}
	return {
		band: "over_ceiling",
		flag: `lorebook hub is ~${tokens} tokens — at or over the ~1000 token ceiling for a hub entry; trim`,
	};
}

export function entryBand(tokens: number): BandVerdict<EntryBand> {
	if (tokens <= ENTRY_BANDS.soft) return { band: "within_soft" };
	if (tokens <= ENTRY_BANDS.hard) {
		return {
			band: "above_soft_within_hard",
			flag: `lorebook entry is ~${tokens} tokens — above the ~300 soft target, within the ~400 hard cap`,
		};
	}
	return {
		band: "over_hard",
		flag: `lorebook entry is ~${tokens} tokens — over the ~400 hard cap; trim`,
	};
}

// =============================================================================
// Macros (skills/macro-rules/references/macro-reference.md)
// =============================================================================

/** The only double-brace macros the platform resolves. */
export const KNOWN_MACROS = ["user", "char", "sub", "obj", "poss", "ref"] as const;
export type KnownMacro = (typeof KNOWN_MACROS)[number];

const KNOWN_MACRO_SET: ReadonlySet<string> = new Set(KNOWN_MACROS);

export function isKnownMacro(name: string): boolean {
	return KNOWN_MACRO_SET.has(name);
}

export const MACRO_FINDING_NAMES = ["spaced_macro", "unknown_macro", "user_collapse"] as const;
export type MacroFindingType = (typeof MACRO_FINDING_NAMES)[number];

export interface MacroFinding {
	type: MacroFindingType;
	message: string;
	/** The offending text, when the finding is anchored to a span. */
	match?: string;
	/** Character offset of `match` in the checked text. */
	index?: number;
}

// =============================================================================
// Ghost phrases (skills/forensics/references/slop-scoring.md)
// =============================================================================

export const GHOST_CATEGORY_NAMES = [
	"assistant_leakage",
	"formulaic_contrast",
	"stock_openers",
	"essay_transitions",
] as const;
export type GhostCategory = (typeof GHOST_CATEGORY_NAMES)[number];

/** Literal phrases per category. `formulaic_contrast` is a shape, not a list. */
export const GHOST_PHRASE_CATEGORIES: Readonly<
	Record<Exclude<GhostCategory, "formulaic_contrast">, readonly string[]>
> = {
	assistant_leakage: ["as an AI", "I cannot and will not", "I'd be happy to", "certainly!", "as a language model"],
	essay_transitions: ["moreover", "furthermore", "in conclusion", "it's important to note"],
	stock_openers: ["let's dive into", "picture this", "imagine a world where"],
};

/** Per-match weights, applied to match density per 1 000 words. */
export const GHOST_CATEGORY_WEIGHTS: Readonly<Record<GhostCategory, number>> = {
	assistant_leakage: 25,
	formulaic_contrast: 20,
	stock_openers: 15,
	essay_transitions: 8,
};

// =============================================================================
// Slop-scoring weights (skills/forensics/references/slop-scoring.md)
// =============================================================================

/** Entropy lens: weights of the four sub-risks. */
export const ENTROPY_WEIGHTS = {
	vocabularyRichness: 0.25,
	sentenceVariance: 0.25,
	repetition: 0.3,
	wordEntropy: 0.2,
} as const;

/** Fingerprint lens: weights of the three sub-risks. */
export const FINGERPRINT_WEIGHTS = {
	emDash: 0.4,
	functionWordFlatness: 0.4,
	wordLength: 0.2,
} as const;

/** Function words tracked by the fingerprint lens. */
export const FUNCTION_WORDS = [
	"the",
	"and",
	"of",
	"to",
	"a",
	"in",
	"is",
	"that",
	"it",
	"with",
	"for",
	"as",
	"was",
	"on",
	"are",
] as const;
export type FunctionWord = (typeof FUNCTION_WORDS)[number];

// =============================================================================
// Shared text statistics
// =============================================================================

export function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

/** Count occurrences of `pattern` in `text`. */
export function countMatches(text: string, pattern: RegExp): number {
	return text.match(pattern)?.length ?? 0;
}

/** Scale a count to a per-thousand rate. */
export function perThousand(count: number, total: number): number {
	return total === 0 ? 0 : (count / total) * 1000;
}

/**
 * Split text into lowercase words with surrounding punctuation stripped.
 *
 * The entropy and fingerprint lenses must agree on what counts as a word, so
 * both use this one tokenizer.
 */
export function splitWords(text: string): string[] {
	return text
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map(word => word.toLowerCase().replace(/^\W+|\W+$/g, ""))
		.filter(word => word.length > 0);
}

/** Split text into sentences on `.`/`!`/`?` followed by whitespace or end of input. */
export function splitSentences(text: string): string[] {
	return text
		.split(/[.!?]+(?=\s|$)/)
		.map(sentence => sentence.trim())
		.filter(sentence => sentence.length > 0);
}

/** Shannon entropy in bits over a frequency distribution. */
export function shannonEntropy(counts: Map<string, number>, total: number): number {
	if (total === 0) return 0;
	let entropy = 0;
	for (const count of counts.values()) {
		const p = count / total;
		entropy -= p * Math.log2(p);
	}
	return entropy;
}

/** Frequency map over an item list. */
export function frequency<T>(items: readonly T[]): Map<T, number> {
	const counts = new Map<T, number>();
	for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
	return counts;
}
