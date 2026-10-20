# Forensics lenses

Forensics asks what is in the text. It never judges whether the text is good.

---

## Entropy

**Measures:** Shannon entropy over characters and over words, average sentence length, sentence-length variance, word-trigram repetition rate, vocabulary richness.

**Answers:** is the distribution unusually flat? Generated prose tends toward low variance — every sentence about the same length, every paragraph the same shape.

**Does not answer:** whether a machine wrote it. Low entropy is common in dialogue, in technical text, and in writing by a non-native speaker.

---

## Fingerprint

**Measures:** punctuation density (comma, semicolon, em dash, ellipsis per 1 000 characters), function-word ratio across fifteen common words, average word length.

**Answers:** does the punctuation pattern look human? Em dashes in particular cluster differently between generated and human prose.

**Does not answer:** anything about quality. A clean fingerprint and a boring text are compatible.

---

## Ghost content

**Measures:** assistant-mode and essay-mode leakage, plus stock openers and formulaic contrast constructions.

**Answers:** is there content in this that belongs to a different genre entirely — an assistant's hedging, an essay's transitions, a stock opening?

**Does not answer:** authorship. Ghost content is a genre leak, and it happens in human writing too.

---

## Bias

**Measures:** nothing numeric. This is a reading lens.

**Answers:** what default patterns, unexamined assumptions, and single perspectives are present in the text — and what the text takes for granted about the reader.

**Does not answer:** anything quantitative. It carries no score, by design.

---

## Rules

- Run every applicable lens. These lenses are cheap and independent.
- **Never sum the scores.** They measure different things on different scales and the sum is meaningless.
- Report each lens separately with its own evidence.
- **Never state that a text was written by a machine.** Report the statistical signal and what it can and cannot support.
