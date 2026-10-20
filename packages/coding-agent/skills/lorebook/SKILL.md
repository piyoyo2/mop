---
name: lorebook
description: The lorebook — the World Info JSON attached to a card, its hub and triggered entries, and how the cascade works. Use when writing, fixing, or reviewing a lorebook, or when deciding whether content should be offloaded from a card.
---

# Lorebook

A lorebook holds worldbuilding the card references but does not permanently carry. It is offload, not deletion.

## When this applies

- The user asks for a lorebook, or for one to be fixed or reviewed.
- A card's permanent boxes are bloated and the content should be offloaded rather than cut.
- You need to check that a lorebook's cascade actually reaches its entries.

## Workflow

1. MUST read [lorebook-format.md](references/lorebook-format.md) before writing or editing a lorebook.
2. MUST read [lorebook-example.json](references/lorebook-example.json) when you need a concrete shape to copy — a worked example with a hub and triggered entries.
3. Write the hub entry first: the always-on core of the world, short enough to pay for on every turn.
4. Write each conditional entry against a trigger keyword, and give it a hub it belongs under.
5. Run the budget check over the hub and every entry.
6. NEVER write a lorebook without proposing it first. The user approves the structure before you fill it in.

## Reference files

- [lorebook-format.md](references/lorebook-format.md) — the entry schema, the keyword fields that must agree, the cascade, and the size limits.
- [lorebook-example.json](references/lorebook-example.json) — a complete worked example: one constant hub plus eight triggered entries.

## Notes

- A lorebook is proposed, never silently created. The user decides whether the card gets one at all.
- An entry with no keyword can never be triggered. An entry with a keyword nothing references is dead weight.
