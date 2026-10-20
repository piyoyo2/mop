# The four-box model

A JanitorAI card has exactly four platform-fixed boxes. There is no fifth.

| Box | Required | Permanent | What it holds |
|---|---|---|---|
| **Scenario** | no | yes | The situation the card opens in |
| **Personality** | yes | yes | Who the character is |
| **Opening Messages** | yes (1–10 slots) | no | Alternate opening scenes; exactly one loads per chat |
| **Example Dialogue** | no | no | Voice demonstration |

"Description" is a synonym for Personality, not a fifth box. `Name` is a field of the card, not a box.

## Required

- Personality and at least one Opening Message. A card missing either does not load correctly.
- Scenario and Example Dialogue are optional.

## The permanent budget

Only Scenario and Personality are permanent: they sit in context on every turn, whether or not the user sees them. Example Dialogue is not permanent but is loaded with the card. Opening Messages ship as slots, but only the selected one loads.

**This is why content gets offloaded.** A fact that is only needed sometimes does not belong in a permanent box — it belongs in a lorebook entry behind a keyword trigger. See the `lorebook` skill.

## The visibility line

> The backend boxes are index data. The Opening Message is full prose.

Scenario and Personality are read by the model as reference material: index entries, character notes, facts it can draw on. The Opening Message is what the user actually sees when the card loads. Writing them to the same standard is a mistake — the opening message is the only box that has to be immediately good.

## Naming

`Name` is not a box, but the platform displays it, so a card without one has no identity in the picker. Treat it as a field of the card file.
