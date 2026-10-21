# text_entropy

> Entropy lens: measure the statistical shape of a passage.

## Source
- Entry: `packages/coding-agent/src/tools/card/text-entropy.ts`
- Model-facing prompt: `packages/coding-agent/src/prompts/tools/text-entropy.md`
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

- `details.shannon_entropy_char` — Shannon entropy in bits per character.
- `details.shannon_entropy_word` — Shannon entropy in bits per word.
- `details.avg_sentence_length` — mean words per sentence.
- `details.sentence_length_variance` — variance of the sentence lengths.
- `details.repetition_rate` — share of word trigrams that occur more than once.
- `details.vocabulary_richness` — type-token ratio.
- `details.slop_risk` — 0–100 slop-risk score for the entropy lens.

Empty or whitespace-only text returns zeros for every field and a score of 0.

## Flow
1. Check for cancellation.
2. Compute the metrics.
3. Combine the four sub-risks into the lens score.

The score weights vocabulary richness (0.25), sentence-length variance (0.25), repetition (0.30), and word entropy (0.20). The word-entropy term is U-shaped: entropy between 4 and 8 bits per word scores zero risk, and deviation in *either* direction scores risk.

## Side Effects
None. The tool is a pure measurement.

## Limits & Errors
- A score is a **screen, not a verdict**. It says the text has the statistical shape of generated prose, never that a machine wrote it.
- The thresholds are tuned on English prose. A score on translated text, on dialogue-heavy text, or on a non-native author's writing is weaker evidence.
- Never sum this score with the other lenses' scores. They measure different things on different scales.

## Notes
- Read the numbers against a known-human baseline rather than in isolation — there is no universal threshold.
- The companion lens is `text_fingerprint`; the third is `ghost_phrase_scan`.
