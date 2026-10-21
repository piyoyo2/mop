import type { AgentTool, AgentToolContext, AgentToolResult, AgentToolUpdateCallback } from "@oh-my-pi/pi-agent-core";
import { type } from "@oh-my-pi/omptype";
import { ToolError } from "@oh-my-pi/pi-tui/tools/tool-errors";
import cardBudgetDescription from "../../prompts/tools/card-budget.md" with { type: "text" };
import { throwIfAborted } from "../tool-errors";
import { entryBand, hubBand, permanentBand } from "./domain";
import { countTokens, DEFAULT_ENCODING, type Encoding } from "./tokenizer";

const cardBudgetSchema = type({
	"scenario?": type("string").describe("The card's Scenario box text."),
	"personality?": type("string").describe("The card's Personality box text."),
	"lorebook_hub?": type("string").describe("A lorebook's constant:true hub entry content."),
	"lorebook_entry?": type("string").describe("A single lorebook conditional (constant:false) entry's content."),
	"encoding?": type('"o200k_base" | "cl100k_base"').describe(
		"BPE encoding to count with. o200k_base (GPT-4o and newer) by default.",
	),
});

export type CardBudgetParams = typeof cardBudgetSchema.infer;

export interface CardBudgetDetails {
	/** True when no field fell outside its target band. */
	within_budget: boolean;
	encoding: Encoding;
	/** Token count per field that was checked. */
	per_field_tokens: Record<string, number>;
	/** Band name per field that was checked. */
	bands: Record<string, string>;
	/** One advisory per field outside its target band. */
	flags: string[];
}

/** Human-facing label for a checked field, in the order the bands are reported. */
const FIELD_LABELS: Readonly<Record<string, string>> = {
	permanent: "permanent (Scenario + Personality)",
	lorebook_hub: "lorebook hub",
	lorebook_entry: "lorebook entry",
};

/**
 * Band a card's permanent pair, lorebook hub, or lorebook entry against the
 * token budgets in `skills/token-economics/references/budget-bands.md`.
 */
export class CardBudgetTool implements AgentTool<typeof cardBudgetSchema, CardBudgetDetails> {
	readonly name = "card_budget";
	readonly label = "Card budget";
	readonly description = cardBudgetDescription;
	readonly parameters = cardBudgetSchema;
	readonly approval = "read" as const;
	readonly intent = "omit" as const;
	readonly strict = true;

	async execute(
		_toolCallId: string,
		params: CardBudgetParams,
		signal?: AbortSignal,
		_onUpdate?: AgentToolUpdateCallback<CardBudgetDetails>,
		_context?: AgentToolContext,
	): Promise<AgentToolResult<CardBudgetDetails>> {
		throwIfAborted(signal);
		const encoding = params.encoding ?? DEFAULT_ENCODING;
		const perFieldTokens: Record<string, number> = {};
		const bands: Record<string, string> = {};
		const flags: string[] = [];
		const lines: string[] = [];

		const report = (field: string, tokens: number, band: string, flag?: string): void => {
			perFieldTokens[field] = tokens;
			bands[field] = band;
			lines.push(`${FIELD_LABELS[field] ?? field}: ${tokens} tokens — ${band}`);
			if (flag) flags.push(flag);
		};

		if (params.scenario !== undefined || params.personality !== undefined) {
			throwIfAborted(signal);
			const scenarioTokens = params.scenario !== undefined ? countTokens(params.scenario, encoding) : 0;
			const personalityTokens = params.personality !== undefined ? countTokens(params.personality, encoding) : 0;
			const verdict = permanentBand(scenarioTokens + personalityTokens);
			report("permanent", scenarioTokens + personalityTokens, verdict.band, verdict.flag);
		}

		if (params.lorebook_hub !== undefined) {
			throwIfAborted(signal);
			const tokens = countTokens(params.lorebook_hub, encoding);
			const verdict = hubBand(tokens);
			report("lorebook_hub", tokens, verdict.band, verdict.flag);
		}

		if (params.lorebook_entry !== undefined) {
			throwIfAborted(signal);
			const tokens = countTokens(params.lorebook_entry, encoding);
			const verdict = entryBand(tokens);
			report("lorebook_entry", tokens, verdict.band, verdict.flag);
		}

		if (lines.length === 0) {
			throw new ToolError(
				"card_budget needs at least one field to measure (scenario, personality, lorebook_hub, or lorebook_entry).",
			);
		}

		const withinBudget = flags.length === 0;
		const text = withinBudget
			? `within budget\n${lines.join("\n")}`
			: `${flags.length} flag(s)\n${lines.join("\n")}\n\n${flags.map(flag => `- ${flag}`).join("\n")}`;

		return {
			content: [{ type: "text", text }],
			details: {
				within_budget: withinBudget,
				encoding,
				per_field_tokens: perFieldTokens,
				bands,
				flags,
			},
		};
	}
}
