Ghost-content lens: scan for content that belongs to a different genre.

Categories checked:
- `assistant_leakage` — phrases like "as an AI" or "I'd be happy to" that leak the underlying assistant through the character's voice.
- `essay_transitions` — formal essay connectives ("moreover", "in conclusion", "it's important to note") that read as generated rather than written in character.
- `stock_openers` — generic scene-setting openers ("let's dive into", "picture this", "imagine a world where").
- `formulaic_contrast` — the "it's not just X, it's Y" sentence shape, matched structurally rather than as a fixed phrase.

Each match reports the phrase, its category, and its character offset. The result also carries a 0–100 slop-risk score for this lens, weighted by category density per 1 000 words.

Pass one field or block of text at a time. A match is a prompt to look closer, not proof of AI generation on its own.
