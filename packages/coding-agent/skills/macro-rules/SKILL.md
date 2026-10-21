---
name: macro-rules
description: How {{user}}, {{char}}, and the rest of the macro set behave inside a character card — the known macro list, the spaced and unknown forms, and the "the user" collapse bug. Use when writing or checking macros in any card box.
---

# Macro rules

Macros are substituted by the platform when the card is loaded. A macro written wrong does not error — it renders wrong, in front of the user.

## When this applies

- Any card box contains a macro, or is about to.
- You are checking an existing card for macros that will not resolve.
- A card "loses the user's name" or speaks about the user in the third person.

## Workflow

1. MUST read [macro-reference.md](references/macro-reference.md) before writing a macro or interpreting one.
2. When writing: use the double-brace form exactly. `{{user}}`, never `{user}`, never `{{ user }}`.
3. When checking: run `card_macro_check` over every box. Fix the findings it reports.
4. A macro that is not in the known set does not resolve. NEVER invent one; write the literal text instead.

## Reference files

- [macro-reference.md](references/macro-reference.md) — the known macro set, the forms that break, the collapse bug, and the rules for spacing and frequency.

## Notes

- `{{char1}}` and `{{char2}}` are not functional on the platform. They are not a way to address a second character.
- Macro density matters. A box stuffed with `{{user}}` reads as a template; one that never mentions the user reads as a monologue. The rubric has the exact rule.
