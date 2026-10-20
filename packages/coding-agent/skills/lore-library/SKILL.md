---
name: lore-library
description: The persistent lore library — where worldbuilding, saved ideas, and voice profiles live on disk, how to search it, and the protocol for saving into it. Use when the user names a lore entry, wants material grounded in their library, or asks to save something.
---

# Lore library

Durable material lives here, not in a card. The library is what a card is compiled from, and it survives across sessions and across characters.

## When this applies

- The user names lore, a world, a saved idea, or a voice profile.
- The user asks you to ground a card in something they already have.
- The user asks you to save a world, an idea, or a profile.

## Workflow

1. MUST read [library-layout.md](references/library-layout.md) before reading or writing anything in the library.
2. Search before you read. Use the library search tool with the user's own words; NEVER guess a filename.
3. When a search returns candidates, you MUST confirm the match with the user before you read or use one. A miss is reported, never guessed around.
4. When saving: MUST read [save-protocol.md](references/save-protocol.md) and follow it exactly — naming, format, and the confirmation before writing.

## Reference files

- [library-layout.md](references/library-layout.md) — the directory layout, the file naming convention, and what belongs in each folder.
- [save-protocol.md](references/save-protocol.md) — the steps for saving: naming, format, confirming the path, and never overwriting silently.

## Notes

- The library is the user's. You NEVER delete from it, and you NEVER overwrite an entry without being asked to.
- Grounding a card in the library is the normal path, not a special one. If the user says "use my dragon lore", the library is where you look.
