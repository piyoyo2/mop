# card_macro_check

> Check a card or lorebook field's text for macro problems, mechanically.

## Source
- Entry: `packages/coding-agent/src/tools/card/card-macro-check.ts`
- Model-facing prompt: `packages/coding-agent/src/prompts/tools/card-macro-check.md`
- Known macro set: `packages/coding-agent/src/tools/card/domain.ts` — the executable form of `skills/macro-rules/references/macro-reference.md`
- Registration: `packages/coding-agent/src/tools/index.ts`

## Registration / Visibility
- Metadata: `approval = "read"`, `strict = true`, `intent = "omit"`.
- Registered as a built-in; present in every session's tool roster unless the session restricts its tool list.

## Inputs

| Field | Type | Required | Description |
|---|---|---:|---|
| `text` | `string` | Yes | The card or lorebook field text to check. |
| `box` | `string` | No | Label for the field being checked, echoed back in the report. |

## Outputs
Returns a single text block plus structured `details`.

- `details.clean` — true when the text has no macro findings.
- `details.box` — the label the caller passed, echoed back.
- `details.findings` — one entry per finding, each with a `type`, a `message`, and — for findings anchored to a span — the offending `match` and its character `index`.

Finding types:

| Type | Meaning |
|---|---|
| `spaced_macro` | A known macro written with internal spaces. The platform does not trim inside the braces, so it never resolves. |
| `unknown_macro` | A double-brace span whose name is not in the known set. Nothing about it resolves. |
| `user_collapse` | The text uses `{{user}}` and also refers to the user as "the user" in prose. That prose is not substituted at runtime. |

The known set is `user`, `char`, `sub`, `obj`, `poss`, `ref`. `{{char1}}` and `{{char2}}` do not resolve on the platform.

## Flow
1. Check for cancellation.
2. Scan every `{{...}}` span. A span whose trimmed name is a known macro but whose raw name carries internal spaces is a `spaced_macro`; a span whose trimmed name is not in the known set is an `unknown_macro` (with a second `spaced_macro` finding when it also carries internal spaces, so the spacing is not silently absorbed).
3. If the text contains `{{user}}` and also matches `\bthe user\b`, report a `user_collapse`.
4. Return the findings. The tool never rewrites the text.

## Side Effects
None. The tool is a pure check.

## Limits & Errors
- A mechanical check catches the deterministic failures only. It does not judge macro density, and it does not catch every misuse — over-defining `{{user}}` is a style question, not a mechanical one.
- The collapse finding triggers on the tight `{{user}}` form only; a spaced `{{ user }}` is reported as a `spaced_macro` and becomes a collapse once the spacing is fixed.

## Notes
- Pass one field's text at a time, and label it with `box` so the report says which box it is about.
- A wrong macro does not error on the platform — it renders wrong, in front of the user. That is why this check is worth running before a card is shown.
