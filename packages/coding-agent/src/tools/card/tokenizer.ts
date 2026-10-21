/**
 * Token counting for mop's card-budget tools.
 *
 * The card budget is expressed in tokens, so estimating it (chars/4) is not
 * good enough — the bands in `budget-bands.md` are token counts, and an
 * estimate can move a card across a band boundary.
 *
 * The counting itself is the repo's canonical offline BPE tokenizer
 * (`@oh-my-pi/pi-natives`, the `utok` port of the OpenAI rank tables) — the
 * same one the `mop toks` command reports. It is a native call, so there is
 * nothing to load lazily and no JavaScript rank table in the bundle.
 */

import { countTokens as countTokensNative, Encoding as NativeEncoding } from "@oh-my-pi/pi-natives";

export const ENCODINGS = ["o200k_base", "cl100k_base"] as const;
export type Encoding = (typeof ENCODINGS)[number];

export const DEFAULT_ENCODING: Encoding = "o200k_base";

const NATIVE_ENCODINGS: Readonly<Record<Encoding, NativeEncoding>> = {
	o200k_base: NativeEncoding.O200kBase,
	cl100k_base: NativeEncoding.Cl100kBase,
};

/** Count the tokens in `text` under `encoding`. */
export function countTokens(text: string, encoding: Encoding = DEFAULT_ENCODING): number {
	return countTokensNative(text, NATIVE_ENCODINGS[encoding]);
}
