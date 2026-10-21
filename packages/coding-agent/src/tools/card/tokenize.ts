import type { AgentTool, AgentToolContext, AgentToolResult, AgentToolUpdateCallback } from "@oh-my-pi/pi-agent-core";
import { type } from "@oh-my-pi/omptype";
import tokenizeDescription from "../../prompts/tools/tokenize.md" with { type: "text" };
import { throwIfAborted } from "../tool-errors";
import { countTokens, DEFAULT_ENCODING, type Encoding } from "./tokenizer";

const tokenizeSchema = type({
	text: type("string").describe("The text to count tokens for — a card section, a lorebook entry, a whole card."),
	"encoding?": type('"o200k_base" | "cl100k_base"').describe(
		"BPE encoding: o200k_base (GPT-4o and newer) by default, or cl100k_base (GPT-3.5 / GPT-4 era).",
	),
});

export type TokenizeParams = typeof tokenizeSchema.infer;

export interface TokenizeDetails {
	tokens: number;
	characters: number;
	encoding: Encoding;
}

/**
 * Count the exact tokens in a piece of text with a real BPE tokenizer.
 */
export class TokenizeTool implements AgentTool<typeof tokenizeSchema, TokenizeDetails> {
	readonly name = "tokenize";
	readonly label = "Tokenize";
	readonly description = tokenizeDescription;
	readonly parameters = tokenizeSchema;
	readonly approval = "read" as const;
	readonly intent = "omit" as const;
	readonly strict = true;

	async execute(
		_toolCallId: string,
		params: TokenizeParams,
		signal?: AbortSignal,
		_onUpdate?: AgentToolUpdateCallback<TokenizeDetails>,
		_context?: AgentToolContext,
	): Promise<AgentToolResult<TokenizeDetails>> {
		throwIfAborted(signal);
		const encoding = params.encoding ?? DEFAULT_ENCODING;
		const tokens = countTokens(params.text, encoding);
		const characters = params.text.length;

		return {
			content: [{ type: "text", text: `${tokens} tokens · ${characters} characters · encoding ${encoding}` }],
			details: { tokens, characters, encoding },
		};
	}
}
