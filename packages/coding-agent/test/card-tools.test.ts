import { describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { shortenPath } from "@oh-my-pi/pi-tui/render/render-utils";
import { CardBudgetTool } from "../src/tools/card/card-budget";
import { CardMacroCheckTool, findMacroIssues } from "../src/tools/card/card-macro-check";
import {
	entryBand,
	hubBand,
	permanentBand,
	type EntryBand,
	type GhostCategory,
	type HubBand,
	type MacroFindingType,
	type PermanentBand,
} from "../src/tools/card/domain";
import { GhostPhraseScanTool, scanGhostPhrases } from "../src/tools/card/ghost-phrase-scan";
import { LibrarySearchTool } from "../src/tools/card/library-search";
import { computeEntropySlopScore, computeTextEntropy, TextEntropyTool } from "../src/tools/card/text-entropy";
import {
	computeFingerprintSlopScore,
	computeTextFingerprint,
	TextFingerprintTool,
} from "../src/tools/card/text-fingerprint";
import { TokenizeTool } from "../src/tools/card/tokenize";

// =============================================================================
// Budget bands
// =============================================================================

describe("card budget bands", () => {
	const PERMANENT_CASES: [number, PermanentBand][] = [
		[1999, "under_specified"],
		[2000, "sweet_spot"],
		[3000, "sweet_spot"],
		[3001, "lorepacked_range"],
		[6000, "lorepacked_range"],
		[6001, "approaching_bloat"],
		[6999, "approaching_bloat"],
		[7000, "bloated"],
	];
	test.each(PERMANENT_CASES)("bands a permanent pair of %i tokens as %s", (tokens, band) => {
		expect(permanentBand(tokens).band).toBe(band);
	});

	const HUB_CASES: [number, HubBand][] = [
		[300, "within_aim"],
		[301, "above_aim_below_ceiling"],
		[999, "above_aim_below_ceiling"],
		[1000, "over_ceiling"],
	];
	test.each(HUB_CASES)("bands a lorebook hub of %i tokens as %s", (tokens, band) => {
		expect(hubBand(tokens).band).toBe(band);
	});

	const ENTRY_CASES: [number, EntryBand][] = [
		[300, "within_soft"],
		[301, "above_soft_within_hard"],
		[400, "above_soft_within_hard"],
		[401, "over_hard"],
	];
	test.each(ENTRY_CASES)("bands a lorebook entry of %i tokens as %s", (tokens, band) => {
		expect(entryBand(tokens).band).toBe(band);
	});

	test("a band inside the target range carries no advisory, one outside it does", () => {
		expect(permanentBand(2500).flag).toBeUndefined();
		expect(permanentBand(2500).band).toBe("sweet_spot");
		expect(permanentBand(5000).flag).toBeDefined();
		expect(permanentBand(5000).band).toBe("lorepacked_range");
	});
});

// =============================================================================
// card_budget
// =============================================================================

describe("card_budget", () => {
	const SCENARIO = "The rain came down on the tin roof all night. ".repeat(60);
	const PERSONALITY = "She was patient, and tired, and did not say so. ".repeat(60);

	test("bands the permanent pair as one budget, not each box alone", async () => {
		const tool = new CardBudgetTool();
		const result = await tool.execute("budget-1", { scenario: SCENARIO, personality: PERSONALITY });
		const details = result.details;
		expect(details).toBeDefined();
		expect(Object.keys(details!.per_field_tokens)).toEqual(["permanent"]);
		expect(details!.bands.permanent).toBe(permanentBand(details!.per_field_tokens.permanent).band);
	});

	test("agrees with tokenize on the token count it measures", async () => {
		const budget = new CardBudgetTool();
		const tokenize = new TokenizeTool();
		const budgeted = await budget.execute("budget-2", { scenario: SCENARIO, personality: PERSONALITY });
		const scenario = await tokenize.execute("tokenize-1", { text: SCENARIO });
		const personality = await tokenize.execute("tokenize-2", { text: PERSONALITY });
		expect(budgeted.details!.per_field_tokens.permanent).toBe(scenario.details!.tokens + personality.details!.tokens);
	});

	test("reports a lorebook hub and a conditional entry on their own scales", async () => {
		const tool = new CardBudgetTool();
		const result = await tool.execute("budget-3", {
			lorebook_hub: "A short hub entry. ".repeat(10),
			lorebook_entry: "A short conditional entry. ".repeat(10),
		});
		expect(result.details!.bands.lorebook_hub).toBe(hubBand(result.details!.per_field_tokens.lorebook_hub).band);
		expect(result.details!.bands.lorebook_entry).toBe(
			entryBand(result.details!.per_field_tokens.lorebook_entry).band,
		);
	});

	test("rejects a call with nothing to measure instead of reporting an empty verdict", async () => {
		const tool = new CardBudgetTool();
		await expect(tool.execute("budget-4", {})).rejects.toThrow(/at least one field/i);
	});
});

// =============================================================================
// card_macro_check
// =============================================================================

describe("card_macro_check", () => {
	const MACRO_CASES: [string, MacroFindingType][] = [
		["{{ user }}", "spaced_macro"],
		["{{ char }}", "spaced_macro"],
		["{{char9}}", "unknown_macro"],
		["{{my name}}", "unknown_macro"],
		["{{user1}}", "unknown_macro"],
	];
	test.each(MACRO_CASES)("reports %s as %s", (text, expected) => {
		const findings = findMacroIssues(text);
		expect(findings.map(finding => finding.type)).toContain(expected);
	});

	test("a known macro written tight is not a finding", () => {
		expect(findMacroIssues("{{char}} waits. {{poss}} coat. {{sub}} nod.")).toEqual([]);
	});

	test("the user macro next to literal 'the user' prose is a collapse", () => {
		const findings = findMacroIssues("{{user}} enters. The user looks away.");
		const collapse = findings.find(finding => finding.type === "user_collapse");
		expect(collapse).toBeDefined();
		expect(collapse!.match).toBe("The user");
		expect(collapse!.index).toBe(17);
	});

	test("the user macro on its own does not collapse", () => {
		expect(findMacroIssues("{{user}} enters and waits.").map(finding => finding.type)).not.toContain("user_collapse");
	});

	test("prose that only says 'the user' does not collapse", () => {
		expect(findMacroIssues("The user waits by the door.").map(finding => finding.type)).not.toContain(
			"user_collapse",
		);
	});

	test("names the box it checked and reports the offending text", async () => {
		const tool = new CardMacroCheckTool();
		const result = await tool.execute("macro-1", { text: "{{char9}} waves", box: "Scenario" });
		expect(result.details!.box).toBe("Scenario");
		expect(result.details!.clean).toBe(false);
		expect(result.details!.findings[0].match).toBe("{{char9}}");
		expect(result.details!.findings[0].index).toBe(0);
		expect(result.content[0]).toEqual({ type: "text", text: expect.stringContaining("Scenario") });
	});

	test("a clean field reports no findings", async () => {
		const tool = new CardMacroCheckTool();
		const result = await tool.execute("macro-2", { text: "{{char}} waits by the door." });
		expect(result.details!.clean).toBe(true);
		expect(result.details!.findings).toEqual([]);
	});
});

// =============================================================================
// tokenize
// =============================================================================

describe("tokenize", () => {
	test("an empty text has no tokens", async () => {
		const tool = new TokenizeTool();
		const result = await tool.execute("tokenize-empty", { text: "" });
		expect(result.details!.tokens).toBe(0);
		expect(result.details!.characters).toBe(0);
	});

	test("reports the character count next to the token count", async () => {
		const tool = new TokenizeTool();
		const text = "The rain came down.";
		const result = await tool.execute("tokenize-chars", { text });
		expect(result.details!.characters).toBe(text.length);
		expect(result.details!.tokens).toBeGreaterThan(0);
	});

	test("the two encodings can disagree about the same text", async () => {
		const tool = new TokenizeTool();
		const text = "こんにちは世界、これはトークナイザのテストです。";
		const modern = await tool.execute("tokenize-o200k", { text, encoding: "o200k_base" });
		const legacy = await tool.execute("tokenize-cl100k", { text, encoding: "cl100k_base" });
		expect(modern.details!.tokens).not.toBe(legacy.details!.tokens);
	});
});

// =============================================================================
// text_entropy
// =============================================================================

describe("text_entropy", () => {
	test("empty text scores zero on every metric", async () => {
		const tool = new TextEntropyTool();
		const result = await tool.execute("entropy-empty", { text: "   " });
		expect(result.details!.shannon_entropy_word).toBe(0);
		expect(result.details!.repetition_rate).toBe(0);
		expect(result.details!.vocabulary_richness).toBe(0);
		expect(result.details!.slop_risk).toBe(0);
	});

	test("formulaic prose scores higher than varied prose on this lens", () => {
		const repetitive =
			"The same thing again and again. The same thing again and again. The same thing again and again. The same thing again and again.";
		const varied =
			"Rain drummed the tin roof while the kettle complained. She counted the mismatched thimbles, then lost her place in the letter and started over, amused by her own handwriting.";
		const repetitiveScore = computeEntropySlopScore(computeTextEntropy(repetitive));
		const variedScore = computeEntropySlopScore(computeTextEntropy(varied));
		expect(repetitiveScore).toBeGreaterThan(variedScore);
	});

	test("repeated phrasing is what drives the repetition rate", () => {
		const metrics = computeTextEntropy("alpha beta gamma alpha beta gamma alpha beta gamma");
		expect(metrics.repetition_rate).toBeGreaterThan(0);
		expect(metrics.vocabulary_richness).toBeLessThan(0.5);
	});
});

// =============================================================================
// text_fingerprint
// =============================================================================

describe("text_fingerprint", () => {
	test("empty text scores zero on every metric", async () => {
		const tool = new TextFingerprintTool();
		const result = await tool.execute("fp-empty", { text: "" });
		expect(result.details!.avg_word_length).toBe(0);
		expect(result.details!.punctuation_density.comma).toBe(0);
		expect(result.details!.slop_risk).toBe(0);
	});

	test("em-dash density is per 1000 characters and counts both spellings", () => {
		const metrics = computeTextFingerprint("x—y--z");
		expect(metrics.punctuation_density.em_dash).toBeCloseTo((2 / 6) * 1000, 5);
	});

	test("a natural em-dash density scores lower than a total absence of them", () => {
		const sentence =
			"The keeper of the lamp and the quiet orchard knew the name of the road and did not say it aloud. ";
		const withDashes = `${sentence.repeat(20)}A—B`;
		const withoutDashes = `${sentence.repeat(20)}AB`;
		const withScore = computeFingerprintSlopScore(computeTextFingerprint(withDashes));
		const withoutScore = computeFingerprintSlopScore(computeTextFingerprint(withoutDashes));
		expect(withScore).toBeLessThan(withoutScore);
	});
});

// =============================================================================
// ghost_phrase_scan
// =============================================================================

describe("ghost_phrase_scan", () => {
	const GHOST_CASES: [string, GhostCategory][] = [
		["As an AI language model, I refuse.", "assistant_leakage"],
		["Moreover, the evidence is clear.", "essay_transitions"],
		["Let's dive into the archive.", "stock_openers"],
		["It's not just a card, it's a story.", "formulaic_contrast"],
	];
	test.each(GHOST_CASES)("finds %s as %s", (text, category) => {
		expect(scanGhostPhrases(text).map(match => match.category)).toContain(category);
	});

	test("a match carries its offset in the scanned text", () => {
		const matches = scanGhostPhrases("She paused. Moreover, she looked away.");
		expect(matches).toHaveLength(1);
		expect(matches[0].index).toBe(12);
	});

	test("prose with no ghost content reports no matches and a zero score", async () => {
		const tool = new GhostPhraseScanTool();
		const result = await tool.execute("ghost-clean", { text: "She poured the tea and watched the storm arrive." });
		expect(result.details!.matches).toEqual([]);
		expect(result.details!.match_count).toBe(0);
		expect(result.details!.slop_risk).toBe(0);
	});
});

// =============================================================================
// library_search
// =============================================================================

describe("library_search", () => {
	async function makeLibrary(): Promise<string> {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "mop-lore-"));
		await fs.mkdir(path.join(root, "worlds"), { recursive: true });
		await fs.mkdir(path.join(root, "voices"), { recursive: true });
		await fs.mkdir(path.join(root, "ideas"), { recursive: true });
		await fs.writeFile(path.join(root, "ashveil.md"), "# Ashveil\nA lineage of glass and oath.\n");
		await fs.writeFile(path.join(root, "worlds", "glass-hollow.md"), "# Glass Hollow\nA valley under glass.\n");
		await fs.writeFile(path.join(root, "voices", "jane-doe.md"), "# Jane Doe\nA clipped, dry voice.\n");
		await fs.writeFile(path.join(root, "ideas", "drift-cities.md"), "# Drift Cities\nCities that walk.\n");
		return root;
	}

	test("matches a file name before it looks inside the files", async () => {
		const root = await makeLibrary();
		const tool = new LibrarySearchTool(root);
		const result = await tool.execute("lib-1", { query: "ashveil" });
		expect(result.details!.candidates).toHaveLength(1);
		expect(result.details!.candidates[0].path).toBe("ashveil.md");
		expect(result.details!.candidates[0].matchType).toBe("filename");
	});

	test("falls back to a content match when no file name matches", async () => {
		const root = await makeLibrary();
		const tool = new LibrarySearchTool(root);
		const result = await tool.execute("lib-2", { query: "valley under glass" });
		expect(result.details!.candidates.map(candidate => candidate.path)).toEqual(["worlds/glass-hollow.md"]);
		expect(result.details!.candidates[0].matchType).toBe("content");
		expect(result.details!.candidates[0].snippet).toContain("valley under glass");
	});

	test("narrows to voice profiles when the caller asks for voices", async () => {
		const root = await makeLibrary();
		const tool = new LibrarySearchTool(root);
		const result = await tool.execute("lib-3", { query: "doe", library: "voices" });
		expect(result.details!.candidates.map(candidate => candidate.path)).toEqual(["voices/jane-doe.md"]);
	});

	test("the voices filter excludes everything that is not a voice profile", async () => {
		const root = await makeLibrary();
		const tool = new LibrarySearchTool(root);
		const result = await tool.execute("lib-4", { query: "drift", library: "voices" });
		expect(result.details!.candidates).toEqual([]);
	});

	test("a miss is reported as a miss rather than resolved to the closest entry", async () => {
		const root = await makeLibrary();
		const tool = new LibrarySearchTool(root);
		const result = await tool.execute("lib-5", { query: "nonexistent-thing" });
		expect(result.details!.candidates).toEqual([]);
		expect(result.details!.count).toBe(0);
		expect(result.content[0]).toEqual({ type: "text", text: expect.stringContaining("no candidates") });
	});

	test("a library that does not exist yet is reported, not thrown", async () => {
		const root = path.join(os.tmpdir(), `mop-lore-missing-${Date.now()}`);
		const tool = new LibrarySearchTool(root);
		const result = await tool.execute("lib-6", { query: "anything" });
		expect(result.details!.library_missing).toBe(true);
		expect(result.details!.candidates).toEqual([]);
	});

	test("a file name match reports the path without opening the file", async () => {
		const root = await makeLibrary();
		const tool = new LibrarySearchTool(root);
		const result = await tool.execute("lib-7", { query: "glass" });
		const candidate = result.details!.candidates.find(entry => entry.path === "worlds/glass-hollow.md");
		expect(candidate).toBeDefined();
		expect(candidate!.matchType).toBe("filename");
		expect(candidate!.snippet).toBeUndefined();
	});

	test("the report shows a path the agent can read directly", async () => {
		const root = await makeLibrary();
		const tool = new LibrarySearchTool(root);
		const result = await tool.execute("lib-8", { query: "ashveil" });
		const text = (result.content[0] as { text: string }).text;
		expect(text).toContain(shortenPath(path.join(root, "ashveil.md")));
	});
});
