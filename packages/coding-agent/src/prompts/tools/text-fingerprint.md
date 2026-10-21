Fingerprint lens: measure the stylistic signature of a passage.

Reports punctuation density (comma, semicolon, em dash, ellipsis per 1 000 characters), function-word frequency across fifteen common words, average word length, and a 0–100 slop-risk score for this lens.

Use it alongside the entropy lens when assessing a text. Heavy em-dash use is a commonly-cited generated-prose tell, but so is a total absence of them — the score is two-sided on purpose. A flat function-word distribution and an average word length outside the natural band are the other two signals.

Pass one field or block of text at a time. Empty or whitespace-only text returns zeros for every field rather than failing.

A score is a screen, not a verdict, and it says nothing about quality. Never sum it with the other lenses' scores.
