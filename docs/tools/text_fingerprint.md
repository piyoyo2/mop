# text_fingerprint

> Fingerprint lens: measure the stylistic signature of a passage.

## Source
- Entry: `packages/coding-agent/src/tools/card/text-fingerprint.ts`
- Model-facing prompt: `packages/coding-agent/src/prompts/tools/text-fingerprint.md`
- Weights and sub-risk knees: `packages/coding-agent/src/tools/card/domain.ts` — the executable form of `skills/forensics/references/slop-scoring.md`
- Registration: `packages/coding-agent/src/tools/index.ts`

## Registration / Visibility
- Metadata: `approval = "read"`, `strict = true`, `intent = "omit"`.
- Registered as a built-in; present in every session's tool roster unless the session restricts its tool list.

## Inputs

| Field | Type | Required | Description |
|---|---|---:|---|
| `text` | `string` | Yes | The text to measure. |

## Outputs
Returns a single text block plus structured `details`.

- `details.punctuation_density` — `comma`, `semicolon`, `em_dash`, `ellipsis`, each per 1 000 characters.
- `details.function_word_ratio` — occurrences per 1 000 words for each of fifteen common function words.
- `details.avg_word_length` — mean characters per word.
- `details.slop_risk` — 0–100 slop-risk score for the fingerprint lens.

Empty or whitespace-only text returns zeros for every field and a score of 0.

## Flow
1. Check for cancellation.
2. Count the punctuation marks and the tracked function words, and compute the mean word length.
3. Combine the three sub-risks into the lens score.

The score weights em-dash density (0.4), function-word flatness (0.4), and average word length (0.2). The em-dash term is two-sided on purpose: density outside the natural 0.5–3 per 1 000 band scores risk in *either* direction, because no em dashes at all is as unusual as a great many.

## Side Effects
None. The tool is a pure measurement.

## Limits & Errors
- A score is a **screen, not a verdict**, and it says nothing about quality. A clean fingerprint and a boring text are compatible.
- The em-dash term saturates on short inputs, which carry no em dashes by default. Read the density alongside the score.
- Never sum this score with the other lenses' scores.

## Notes
- The word tokenizer is shared with `text_entropy`, so the two lenses agree on what counts as a word.
- The companion lenses are `text_entropy` and `ghost_phrase_scan`.
