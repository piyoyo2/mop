Count the exact tokens in a piece of text using a real BPE tokenizer.

Use it whenever a token count matters:
- Measuring a card's permanent fields (Scenario, Personality) against the density budget. Those cost tokens on every turn, so measure them.
- Sizing an Opening Message — only one loads per chat, so its cost is one-time.
- Reporting a real before/after when a card is trimmed or de-slopped.

Pass one section at a time so the count is per-box, and call it again for the next section rather than concatenating.

Encodings: `o200k_base` (GPT-4o and newer — the default) or `cl100k_base` (GPT-3.5 / GPT-4 era).

The count is a reference number, not an exact per-model figure — JanitorAI proxies many models with different tokenizers. Never present it as exact.
