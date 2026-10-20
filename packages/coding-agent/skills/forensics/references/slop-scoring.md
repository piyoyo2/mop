# Slop-risk scoring

Each lens that produces a score produces its own 0–100 **slop-risk** score: higher means more characteristic of generated prose.

**Never sum the scores.** They measure different things.

## Entropy score

Weighted from four sub-risks:

| Component | Weight | Sub-risk rises when |
|---|---|---|
| Vocabulary richness | 0.25 | Type-token ratio falls below 0.6 |
| Sentence-length variance | 0.25 | Variance falls below 8 |
| Repetition | 0.30 | Word-trigram repetition rises above 0.3 |
| Word entropy | 0.20 | Entropy leaves the 4–8 bit band (either direction) |

The word-entropy component is U-shaped: entropy between 4 and 8 bits per word scores zero risk, and deviation in *either* direction scores risk. Both flat vocabulary and unusually varied vocabulary are signals.

## Fingerprint score

| Component | Weight | Sub-risk rises when |
|---|---|---|
| Em-dash density | 0.4 | Density leaves the natural 0.5–3 per 1 000 band — **both** extremes |
| Function-word flatness | 0.4 | The coefficient of variation of function-word frequency falls below 0.6 |
| Word length | 0.2 | Average word length leaves the 4–5.5 character band |

The em-dash term is two-sided on purpose: no em dashes at all is as unusual as a great many.

## Ghost score

Weighted by category, from the density of matches per 1 000 words:

| Category | Weight |
|---|---|
| Assistant leakage | 25 |
| Formulaic contrast | 20 |
| Stock openers | 15 |
| Essay transitions | 8 |

Clamped to 100.

## Reading a score

- A score is a **screen**, not a verdict. It says "this text has the statistical shape of generated prose", never "this text was generated".
- The thresholds were tuned on English prose. A score on translated text, on dialogue-heavy text, or on a non-native author's writing is weaker evidence.
- Two lenses scoring high on the *same* signal is meaningful. One lens scoring high alone usually means the text has that one property, not that it is generated.
