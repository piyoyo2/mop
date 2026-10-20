---
name: card-rewrite
description: Rewrite an existing card to remove AI tells, clichés, padding, and drift, and iterate a draft against review findings. Use when the user asks to deslop a card, tighten it, or run a revision loop.
---

# Card rewrite

Rewriting is not editing. A rewrite replaces the content of a box; it does not trim adjectives out of a draft.

## When this applies

- The user asks for a card to be deslopped, tightened, or rewritten.
- A draft failed review and needs another pass.
- The user wants the revision loop run to a fixed number of rounds.

## Workflow

1. MUST read [rewrite-playbook.md](references/rewrite-playbook.md) before starting.
2. Diagnose before you write. Name what is wrong — genericness, tells, bloat, contradiction — because each has a different fix.
3. Rewrite the box, not the sentence. A box that fails for a structural reason cannot be fixed by rewording.
4. Re-run the checks and the review. A rewrite that was not re-reviewed is not finished.
5. When running the iteration loop, stop at the number of rounds the user asked for, and report what each round changed.

## Reference files

- [rewrite-playbook.md](references/rewrite-playbook.md) — the failure modes and their distinct fixes, the iteration loop, and what to do when a box has grown past its budget.

## Sibling skills

- `anti-slop` — the bar the rewrite has to clear.
- `review` — the findings that drive the rewrite.
- `token-economics` — what to offload instead of cutting.
