# Macro reference

Macros are substituted by the platform when the card loads. A wrong macro does not error — it renders wrong, in front of the user.

## The known set

| Macro | Substitutes |
|---|---|
| `{{user}}` | The user's name |
| `{{char}}` | The character's name |
| `{{sub}}` | The subject (third person, e.g. "she") |
| `{{obj}}` | The object (third person, e.g. "her") |
| `{{poss}}` | The possessive (e.g. "her") |
| `{{ref}}` | The subject in possessive form (e.g. "hers") |

These are the only double-brace macros that resolve. `{{char1}}` and `{{char2}}` do not work on the platform; they are not a way to address a second character.

## The three failures

### Spaced macro

`{{ user }}` does not resolve. The platform does not trim inside the braces. The double-brace form is exact: `{{user}}`.

### Unknown macro

Any tight double-brace form outside the known set — `{{char9}}`, `{{my name}}` — does not resolve. Write the literal text instead of a macro you are hoping resolves.

### The "the user" collapse

A box that uses `{{user}}` **and** refers to the user as "the user" in prose has collapsed: the platform substituted the name in one place and the prose in the other now describes a different entity. The card reads as if the character is talking about someone else.

The check triggers on the tight `{{user}}` form. A spaced `{{ user }}` is reported as a spaced macro instead, and becomes a collapse once the spacing is fixed.

## Rules

1. Use the double-brace form exactly. Never `{user}` — single braces are a different template syntax.
2. Never invent a macro. If it is not in the known set, it does not resolve.
3. Use `{{user}}` sparingly. A box stuffed with it reads as a template; a box that never mentions the user reads as a monologue.
4. After writing a box, check it. Run `card_macro_check` and fix what it reports.

## Checking

`card_macro_check` reports three finding types — `spaced_macro`, `unknown_macro`, and `user_collapse` — each with the offending text and a location. A box is clean when the check reports no findings.
