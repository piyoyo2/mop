Band a card or lorebook field's real token count against the density bands, so the numbers are measured rather than eyeballed.

Pass the fields you are checking — all are optional, and each one is banded on its own scale:
- `scenario` + `personality`: summed into the permanent per-turn budget. Pass both to measure the real permanent total; pass one to measure that box on its own against the same bands.
- `lorebook_hub`: the `constant: true` hub entry.
- `lorebook_entry`: one `constant: false` conditional entry.

The result names the band, the token count per field, and one advisory line per field outside its target range. A band above the sweet spot is a prompt to offload into a lorebook, not to cut — report the number, let the author decide.

Use `tokenize` instead for a raw count of something this tool does not band (an Opening Message, say).
