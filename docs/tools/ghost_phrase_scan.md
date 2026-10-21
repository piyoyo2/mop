# ghost_phrase_scan

> Ghost-content lens: scan for content that belongs to a different genre.

## Source
- Entry: `packages/coding-agent/src/tools/card/ghost-phrase-scan.ts`
- Model-facing prompt: `packages/coding-agent/src/prompts/tools/ghost-phrase-scan.md`
- Phrase list and weights: `packages/coding-agent/src/tools/card/domain.ts` — the executable form of `skills/forensics/references/slop-scoring.md`
- Registration: `packages/coding-agent/src/tools/index.ts`

## Registration / Visibility
- Metadata: `approval = "read"`, `strict = true`, `intent = "omit"`.
- Registered as a built-in; present in every session's tool roster unless the session restricts its tool list.

## Inputs

| Field | Type | Required | Description |
|---|---|---:|---|
| `text` | `string` | Yes | The text to scan. |

## Outputs
Returns a single text block plus structured `details`.

- `details.matches` — one entry per match, with the matched `phrase`, its `category`, and its character `index`.
- `details.match_count` — number of matches.
- `details.slop_risk` — 0–100 slop-risk score for the ghost lens.

Categories:

| Category | What it catches | Weight |
|---|---|---:|
| `assistant_leakage` | "as an AI", "I'd be happy to" — the underlying assistant leaking through the character's voice. | 25 |
| `formulaic_contrast` | The "it's not just X, it's Y" sentence shape, matched structurally rather than as a fixed phrase. | 20 |
| `stock_openers` | "let's dive into", "picture this" — generic scene-setting openers. | 15 |
| `essay_transitions` | "moreover", "in conclusion" — formal essay connectives. | 8 |

The score is the weighted match density per 1 000 words, clamped to 100. Text with no matches scores 0.

## Flow
1. Check for cancellation.
2. Scan each literal phrase with a word-boundary regex, and the formulaic-contrast shape with its own pattern.
3. Sort the matches by offset and score them by category weight per 1 000 words.

## Side Effects
None. The tool is a pure scan.

## Limits & Errors
- A match is a prompt to look closer, not proof of AI generation on its own. Ghost content is a genre leak, and it happens in human writing too.
- The literal lists are curated, so a leak phrased differently is not caught.
- Never sum this score with the other lenses' scores.

## Notes
- The phrase list and the banned-phrase list in `skills/anti-slop/references/banned-phrases.md` are different instruments. This one looks for content from the wrong genre; the banned-phrase list is a reading rubric for card prose.
