---
name: card-anatomy
description: The shape of a JanitorAI character card — the four platform boxes, which of them is permanent, and how a card is stored on disk. Use whenever you need to know what a card field means, which box the user is talking about, or how to read and write a card file.
---

# Card anatomy

A card is a compiled artifact, not where a character originates. This skill defines the shape: the boxes, what they cost, and the file format they live in.

## When this applies

- The user names a box, a field, or "the card", and you need to know which part they mean.
- You are about to read, parse, or write a card file.
- You need to decide whether content belongs in a permanent box or can be offloaded.

## Workflow

1. Identify which of the four boxes the request touches.
2. MUST read [four-box-model.md](four-box-model.md) before writing content into any box.
3. MUST read [card-file-format.md](card-file-format.md) before reading or writing a card file.

## Reference files

- [four-box-model.md](four-box-model.md) — the four boxes, which are required, what is permanent, and the visibility line.
- [card-file-format.md](card-file-format.md) — how a card is stored and parsed: headings, separators, and the header spellings the parser tolerates.
