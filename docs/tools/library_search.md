# library_search

> Search the lore library for a file matching a plain-language reference — a creator name, a lore topic, a world or character name.

## Source
- Entry: `packages/coding-agent/src/tools/card/library-search.ts`
- Model-facing prompt: `packages/coding-agent/src/prompts/tools/library-search.md`
- Library root: `getLoreDir()` in `packages/utils/src/dirs.ts` — `~/.mop/agent/lore`
- Layout spec: `skills/lore-library/references/library-layout.md`
- Registration: `packages/coding-agent/src/tools/index.ts`

## Registration / Visibility
- Metadata: `approval = "read"`, `strict = true`, `intent = "omit"`.
- Registered as a built-in; present in every session's tool roster unless the session restricts its tool list.

## Inputs

| Field | Type | Required | Description |
|---|---|---:|---|
| `query` | `string` | Yes | The plain-language reference to search for. |
| `library` | `"lore" \| "voices" \| "any"` | No | Narrow the search. Defaults to `"any"`. |

`"voices"` matches only entries under `voices/`; `"lore"` matches everything else, including root topic notes, `worlds/`, `ideas/`, and lorebook JSON.

## Outputs
Returns a single text block plus structured `details`.

- `details.query`, `details.library` — echoed inputs.
- `details.count` — number of candidates.
- `details.candidates` — one entry per candidate, with the `path` relative to the library root, the `title` (file name without extension), the `category` (the library folder, or `Lore` for a root note), the `matchType` (`filename` or `content`), and — for a content match — a `snippet` window around the hit.
- `details.root` — the library root that was searched, with the home directory shortened.
- `details.library_missing` — true when the library directory does not exist yet.

The tool returns **candidates**, never a resolved file. A filename match carries no snippet, because the file was not opened.

The text block lists each candidate with its full path (home directory shortened), so a candidate can be read directly.

## Flow
1. Check for cancellation.
2. Scan the library root for `.md`, `.txt`, and `.json` entries.
3. Match file names first: every token of the query must appear in the file name, case- and punctuation-insensitively.
4. Only when no file name matches, read each entry and match its content, keeping a snippet around the first hit.
5. Return the candidates.

## Side Effects
Reads the lore library. Writes nothing, and never resolves a file for the caller.

## Limits & Errors
- A library that does not exist yet is reported through `details.library_missing` and an explanatory text block, not an error.
- Zero candidates means nothing was found. Report the miss; do not pick the closest entry and continue.
- Even a single candidate needs the user's confirmation before it is read or used.

## Notes
- This is the one sanctioned way to search the library. Do not fall back to raw file globbing or reading against the library instead of this tool.
- The library is the user's. Nothing in mop writes into it without an explicit request.
