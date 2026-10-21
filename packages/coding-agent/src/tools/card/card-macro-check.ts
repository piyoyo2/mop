import type { AgentTool, AgentToolContext, AgentToolResult, AgentToolUpdateCallback } from "@oh-my-pi/pi-agent-core";
import { type } from "@oh-my-pi/omptype";
import cardMacroCheckDescription from "../../prompts/tools/card-macro-check.md" with { type: "text" };
import { throwIfAborted } from "../tool-errors";
import { isKnownMacro, type MacroFinding } from "./domain";

const cardMacroCheckSchema = type({
	text: type("string").describe("The card or lorebook field text to check for macro issues."),
	"box?": type("string").describe('Label for the field being checked (e.g. "Scenario", "Opening Message 1").'),
});

export type CardMacroCheckParams = typeof cardMacroCheckSchema.infer;

export interface CardMacroCheckDetails {
	/** True when the text has no macro findings. */
	clean: boolean;
	/** The label the caller passed for the field, echoed back. */
	box?: string;
	findings: MacroFinding[];
}

/** Any double-brace span, however malformed. */
const MACRO_SPAN = /\{\{([^{}]*)\}\}/g;

/**
 * Find every macro problem in `text`.
 *
 * The three failure types are the ones named in
 * `skills/macro-rules/references/macro-reference.md`:
 *
 * - `spaced_macro` — a known macro name written with internal spaces
 *   (`{{ user }}`). The platform does not trim inside the braces.
 * - `unknown_macro` — a double-brace span whose name is not in the known set
 *   (`{{char9}}`, `{{my name}}`). Nothing about it resolves.
 * - `user_collapse` — the box uses `{{user}}` and also refers to the user as
 *   "the user" in prose. A functional bug: that prose is not substituted.
 */
export function findMacroIssues(text: string): MacroFinding[] {
	const findings: MacroFinding[] = [];

	for (const match of text.matchAll(MACRO_SPAN)) {
		const [span, rawName] = match;
		const name = rawName.trim();
		const index = match.index ?? 0;
		if (name === "") {
			findings.push({
				type: "unknown_macro",
				message: "empty placeholder `{{}}` — nothing to substitute",
				match: span,
				index,
			});
			continue;
		}
		if (!isKnownMacro(name)) {
			const spaced = /\s/.test(rawName);
			findings.push({
				type: "unknown_macro",
				message: `unknown placeholder \`{{${rawName}}}\` — the platform recognises {{user}}, {{char}}, {{sub}}, {{obj}}, {{poss}}, {{ref}} and nothing else`,
				match: span,
				index,
			});
			if (spaced) {
				findings.push({
					type: "spaced_macro",
					message: `spaced placeholder — the platform does not trim inside the braces, so \`{{${rawName}}}\` never resolves`,
					match: span,
					index,
				});
			}
			continue;
		}
		if (rawName !== name) {
			findings.push({
				type: "spaced_macro",
				message: `spaced placeholder — the platform only substitutes tight \`{{${name}}}\` with no internal spaces`,
				match: span,
				index,
			});
		}
	}

	// The {{user}} -> "the user" collapse. Only the tight form counts: a spaced
	// `{{ user }}` is already reported as a spaced macro, and the author fixes
	// that before the collapse becomes visible.
	const collapse = /\bthe user\b/i.exec(text);
	if (/\{\{user\}\}/.test(text) && collapse) {
		findings.push({
			type: "user_collapse",
			message:
				'uses the {{user}} macro but also spells out "the user" as literal prose — a functional bug, not a style nit: that prose will not get substituted at runtime',
			match: collapse[0],
			index: collapse.index,
		});
	}

	return findings;
}

/**
 * Check a card or lorebook field for macro problems.
 */
export class CardMacroCheckTool implements AgentTool<typeof cardMacroCheckSchema, CardMacroCheckDetails> {
	readonly name = "card_macro_check";
	readonly label = "Macro check";
	readonly description = cardMacroCheckDescription;
	readonly parameters = cardMacroCheckSchema;
	readonly approval = "read" as const;
	readonly intent = "omit" as const;
	readonly strict = true;

	async execute(
		_toolCallId: string,
		params: CardMacroCheckParams,
		signal?: AbortSignal,
		_onUpdate?: AgentToolUpdateCallback<CardMacroCheckDetails>,
		_context?: AgentToolContext,
	): Promise<AgentToolResult<CardMacroCheckDetails>> {
		throwIfAborted(signal);
		const findings = findMacroIssues(params.text);
		const clean = findings.length === 0;
		const heading = params.box ? `${params.box}: ` : "";
		const text = clean
			? `${heading}macros clean`
			: `${heading}${findings.length} issue(s)\n${findings
					.map(finding => `- [${finding.type}] ${finding.message}`)
					.join("\n")}`;

		return {
			content: [{ type: "text", text }],
			details: { clean, box: params.box, findings },
		};
	}
}
