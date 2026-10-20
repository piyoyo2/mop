---
name: card-authoring
description: Write a new JanitorAI character card from a concept — the box-by-box workflow, the opening message, and the hook that makes a card playable. Use when creating a card from scratch, filling in an empty card, or rewriting a single box.
---

# Card authoring

Turning a concept into a card the platform can load. The platform's shape is fixed; your job is the content inside it.

## When this applies

- The user asks for a new card, or for a card to be filled in from a concept.
- You are writing or replacing one specific box of an existing card.
- You need to decide what the opening message must accomplish.

## Workflow

1. Get the concept before the content. If the user has not said what the character is, ask — one question, not an interview.
2. MUST read [four-box-model.md](../card-anatomy/references/four-box-model.md) before writing the Scenario or Personality box.
3. Write Personality first: who this person is, stated as traits a reader can act against, not as a list of adjectives.
4. Write Scenario second: the situation the card opens in, in present tense, with no backstory dump.
5. MUST read [opening-message.md](references/opening-message.md) before writing the Opening Message.
6. Write the Opening Message: a scene already in motion, ending on a moment the user can step into.
7. Write Example Dialogue last: it demonstrates voice, it does not advance the story.
8. Run the checks the skill names before showing the draft.

## Reference files

- [opening-message.md](references/opening-message.md) — what the opening message must do: the hook, the user's place in it, and the failure modes.
- [authoring-workflow.md](references/authoring-workflow.md) — the full box-by-box pass, in order, with the decision each box requires.

## Sibling skills

- `card-anatomy` — the box shapes and the file format.
- `anti-slop` — the quality bar the draft must clear.
- `macro-rules` — how `{{user}}` and `{{char}}` behave inside a box.
- `token-economics` — the budget each box must fit inside.
