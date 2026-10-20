---
name: forensics
description: Forensic analysis of a passage — statistical signatures of generated prose, ghost content, and hidden bias. Use when the user asks whether text was machine-written, wants a slop-risk score, or wants the artifact examined rather than the quality judged.
---

# Forensics

Forensics asks what is in the text. It is not a review, and it does not judge quality.

## When this applies

- The user asks whether a passage was AI-written, or wants a slop-risk score.
- The user hands you a foreign or pasted card and wants it examined.
- The user wants the statistical or stylistic fingerprint of a text.

## Workflow

1. MUST read [forensics-lenses.md](references/forensics-lenses.md) before starting.
2. Run every applicable lens. These lenses are cheap and independent — a forensic pass that skips one because it "looked fine" is not a pass.
3. MUST read [slop-scoring.md](references/slop-scoring.md) before interpreting a score.
4. NEVER sum the lens scores into one number. They measure different things and the sum is meaningless.
5. Report each lens separately, with its own evidence.

## Reference files

- [forensics-lenses.md](references/forensics-lenses.md) — the lenses: entropy, fingerprint, ghost content, and bias, and what each one can and cannot say.
- [slop-scoring.md](references/slop-scoring.md) — how the 0–100 slop-risk score is computed per lens, and what the thresholds mean.

## Notes

- A slop-risk score is not a verdict on authorship. NEVER tell a user a text was written by a machine; report the statistical signal and its limits.
- The bias lens is qualitative by design and carries no score. That is the point.
