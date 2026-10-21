Check a card or lorebook field's text for macro problems, mechanically.

Reports three finding types:
- `spaced_macro` — a known macro written with internal spaces, like `{{ user }}`. The platform does not trim inside the braces, so a spaced one never resolves.
- `unknown_macro` — a double-brace span whose name is not in the known set (`{{user}}`, `{{char}}`, `{{sub}}`, `{{obj}}`, `{{poss}}`, `{{ref}}` — nothing else resolves). `{{char1}}` and `{{char2}}` do not work on the platform.
- `user_collapse` — the text uses `{{user}}` and also spells out "the user" as literal prose. That prose will not be substituted at runtime, so the card reads as if the character is talking about someone else.

Pass one field's text at a time, and label it with `box` so the report says which box it is about.

This is a mechanical check, not a substitute for judgment — it catches the deterministic failures, not every macro misuse.
