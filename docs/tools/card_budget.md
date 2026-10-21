# card_budget

> Band a card or lorebook field's real token count against the density bands, so the numbers are measured rather than eyeballed.

## Source
- Entry: `packages/coding-agent/src/tools/card/card-budget.ts`
- Model-facing prompt: `packages/coding-agent/src/prompts/tools/card-budget.md`
- Bands: `packages/coding-agent/src/tools/card/domain.ts` — the executable form of `skills/token-economics/references/budget-bands.md`
- Tokenizer: `packages/coding-agent/src/tools/card/tokenizer.ts` — the native offline BPE counter (`@oh-my-pi/pi-natives`)
- Registration: `packages/coding-agent/src/tools/index.ts`

## Registration / Visibility
- Metadata: `approval = "read"`, `strict = true`, `intent = "omit"`.
- Registered as a built-in; present in every session's tool roster unless the session restricts its tool list.

## Inputs

| Field | Type | Required | Description |
|---|---|---:|---|
| `scenario` | `string` | No | The card's Scenario box text. |
| `personality` | `string` | No | The card's Personality box text. |
| `lorebook_hub` | `string` | No | A lorebook's `constant: true` hub entry content. |
| `lorebook_entry` | `string` | No | A single lorebook conditional (`constant: false`) entry's content. |
| `encoding` | `"o200k_base" \| "cl100k_base"` | No | BPE encoding to count with. Defaults to `o200k_base`. |

All fields are optional, but at least one must be supplied. `scenario` and `personality` are summed into a single permanent budget; each lorebook field is banded on its own scale.

## Outputs
Returns a single text block plus structured `details`.

- `details.within_budget` — true when no field fell outside its target band.
- `details.encoding` — the encoding the count was taken with.
- `details.per_field_tokens` — token count per checked field. The permanent pair is reported under `permanent`.
- `details.bands` — band name per checked field.
- `details.flags` — one advisory line per field outside its target band.

Band names:

| Field | Bands |
|---|---|
| permanent | `under_specified`, `sweet_spot`, `lorepacked_range`, `approaching_bloat`, `bloated` |
| `lorebook_hub` | `within_aim`, `above_aim_below_ceiling`, `over_ceiling` |
| `lorebook_entry` | `within_soft`, `above_soft_within_hard`, `over_hard` |

## Flow
1. Check for cancellation.
2. Count the tokens of each supplied field with the requested encoding.
3. Band each field and collect the advisory for any field outside its target range.
4. Return the report. The tool never edits a card and never proposes the offload itself.

## Side Effects
None. The tool is a pure measurement.

## Limits & Errors
- A call with no field to measure fails with a `ToolError` rather than reporting an empty verdict.
- Token counts are estimates from an approximate tokenizer. Never present one as exact.
- Counting is a native call, so it needs the `pi_natives` addon the CLI already requires.

## Notes
- A band above the sweet spot is a prompt to **offload, not cut**. The content usually belongs in a lorebook entry behind a keyword.
- `tokenize` gives a raw count for something the bands do not cover, such as a single Opening Message.
