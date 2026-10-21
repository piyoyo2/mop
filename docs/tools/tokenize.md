# tokenize

> Count the exact tokens in a piece of text using a real BPE tokenizer.

## Source
- Entry: `packages/coding-agent/src/tools/card/tokenize.ts`
- Model-facing prompt: `packages/coding-agent/src/prompts/tools/tokenize.md`
- Tokenizer: `packages/coding-agent/src/tools/card/tokenizer.ts` — the native offline BPE counter (`@oh-my-pi/pi-natives`), the same one `mop toks` reports
- Registration: `packages/coding-agent/src/tools/index.ts`

## Registration / Visibility
- Metadata: `approval = "read"`, `strict = true`, `intent = "omit"`.
- Registered as a built-in; present in every session's tool roster unless the session restricts its tool list.

## Inputs

| Field | Type | Required | Description |
|---|---|---:|---|
| `text` | `string` | Yes | The text to count — a card section, a lorebook entry, a whole card. |
| `encoding` | `"o200k_base" \| "cl100k_base"` | No | BPE encoding to count with. Defaults to `o200k_base`. |

## Outputs
Returns a single text block plus structured `details`.

- `details.tokens` — the token count.
- `details.characters` — the character length of the input.
- `details.encoding` — the encoding the count was taken with.

The text block reads `<tokens> tokens · <characters> characters · encoding <encoding>`.

## Flow
1. Check for cancellation.
2. Load (or reuse) the encoder for the requested encoding.
3. Encode the text and report the length.

## Side Effects
None. The tool is a pure measurement.

## Limits & Errors
- The count is a reference number, not an exact per-model figure. JanitorAI proxies many models with different tokenizers.
- The two encodings can disagree about the same text — non-Latin scripts in particular tokenize differently under `o200k_base` and `cl100k_base`.
- Counting is a native call, so it needs the `pi_natives` addon the CLI already requires.

## Notes
- Pass one section at a time so the count is per-box, and call the tool again for the next section rather than concatenating.
- `card_budget` bands the counts that have a band; this tool covers everything else.
