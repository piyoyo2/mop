Entropy lens: measure the statistical shape of a passage.

Reports Shannon entropy over characters and over words, average sentence length, sentence-length variance, word-trigram repetition rate, vocabulary richness, and a 0–100 slop-risk score for this lens.

Use it for a forensic pass over a card, a lorebook entry, or pasted prose. Read the numbers against a known-human baseline rather than in isolation — there is no universal threshold, and the thresholds are tuned on English prose.

Pass one field or block of text at a time. Empty or whitespace-only text returns zeros for every field rather than failing.

A score is a screen, not a verdict. It says the text has the statistical shape of generated prose, never that a machine wrote it. Never sum it with the other lenses' scores — they measure different things on different scales.
