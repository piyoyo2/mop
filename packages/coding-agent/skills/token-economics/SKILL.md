---
name: token-economics
description: The token budget for a character card — the bands each box should land in, what counts toward the permanent budget, and when to offload content into a lorebook instead of cutting it. Use when a card is bloated, when checking size, or when deciding where content belongs.
---

# Token economics

Every box costs tokens on every turn, whether or not the user sees it. The permanent boxes cost the most.

## When this applies

- A card is too long, or the user says it is bloated or sluggish.
- You are deciding whether content belongs in the card or in a lorebook.
- You are checking a draft's size before showing it.

## Workflow

1. MUST read [budget-bands.md](references/budget-bands.md) before measuring or advising on size.
2. Run `card_budget` over the draft. Report the band, not just the number. Use `tokenize` for a raw count of a single box the bands do not cover.
3. A band above the sweet spot is a prompt to offload, not to cut. Read `lorebook` before removing content.
4. NEVER cut content to fit a band without telling the user what was removed and where it went.

## Reference files

- [budget-bands.md](references/budget-bands.md) — the bands for permanent fields, the lorebook hub, and a single lorebook entry, and what each band means.

## Notes

- Only the Scenario and Personality boxes are permanent. Example Dialogue and Opening Messages are not in the permanent budget, but they still cost when loaded.
- Token counts are estimates. NEVER present a count as exact.
