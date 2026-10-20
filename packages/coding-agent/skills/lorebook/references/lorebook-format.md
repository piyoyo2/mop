# Lorebook format

A lorebook is World Info JSON: an array of entries. Each entry is a block of content plus the keyword that triggers it.

## Entry shape

Every entry carries the same fields. The ones that matter:

| Field | Value |
|---|---|
| `content` | The text injected into context. |
| `constant` | `true` for the hub, `false` for everything else. |
| `key` | The trigger regex. |
| `keysRaw` | The same trigger, raw. |
| `keywordsRaw` | The same trigger, raw. |
| `matchWholeWords` | `true`. |
| `priority` | Ascending order across the entries. |
| `insertion_order` | Ascending order across the entries. |
| `name` | A human-readable label. |
| `enabled` | `true`. |
| `id` | A UUID. |

**`key`, `keysRaw`, and `keywordsRaw` must be identical.** They are three spellings of one trigger; a lorebook where they disagree imports unpredictably. Set all three to the same string.

The full 25-key template is in `lorebook-example.json` — copy that shape rather than trimming keys, because importers differ on which keys they read.

## The cascade

- One hub entry has `constant: true`. It always loads. It carries the core of the world — the part that has to be true in every conversation.
- Every other entry has `constant: false` and a trigger. It loads only when its keyword appears.
- Priority and insertion order ascend together, so the hub loads before the entries that build on it.

## Sizing

- Hub: aim for 300 tokens, treat 1 000 as the ceiling.
- Each conditional entry: aim for 300 tokens, treat 400 as the limit.

See `token-economics` for the full band table.

## Rules

- An entry with no keyword can never fire. An entry whose keyword nothing in the card ever produces is dead weight.
- Keywords should be words that appear in ordinary conversation about the topic, not rare invented terms.
- `matchWholeWords: true` — the trigger should match whole words so "mage" does not fire inside "damage".
- One hub per lorebook. Two hubs means two always-on blocks, which defeats the offloading the lorebook exists for.

## Checking a lorebook

- Every non-hub entry has a keyword, and the keyword appears somewhere the card can produce.
- `key`, `keysRaw`, and `keywordsRaw` agree on every entry.
- The hub is within budget and every entry is within budget.
- No two entries contradict each other, and no entry contradicts the card's permanent boxes.
