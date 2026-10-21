/**
 * Case- and punctuation-insensitive tokenizer shared by the library search.
 *
 * Lowercases, collapses any run of non-alphanumeric characters into a single
 * space, and trims.
 */
export function normalizeForMatch(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}
