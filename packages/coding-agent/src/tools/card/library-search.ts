import * as path from "node:path";
import type { AgentTool, AgentToolContext, AgentToolResult, AgentToolUpdateCallback } from "@oh-my-pi/pi-agent-core";
import { type } from "@oh-my-pi/omptype";
import { shortenPath } from "@oh-my-pi/pi-tui/render/render-utils";
import { getLoreDir, isEnoent } from "@oh-my-pi/pi-utils";
import { Glob } from "bun";
import librarySearchDescription from "../../prompts/tools/library-search.md" with { type: "text" };
import { throwIfAborted } from "../tool-errors";
import { normalizeForMatch } from "./match-util";

const librarySearchSchema = type({
	query: type("string").describe(
		"The plain-language reference to search for — a creator name, a lore topic, a world or character name.",
	),
	"library?": type('"lore" | "voices" | "any"').describe(
		"Narrow the search: 'voices' for a creator's voice profile, 'lore' for lore/world/character reference, 'any' when unsure.",
	),
});

export type LibrarySearchParams = typeof librarySearchSchema.infer;

export type LibraryFilter = "lore" | "voices" | "any";

export interface LibraryCandidate {
	/** Path relative to the library root. */
	path: string;
	/** File name without its extension. */
	title: string;
	/** The library folder the entry lives in, or "Lore" for a root note. */
	category: string;
	matchType: "filename" | "content";
	/** A window of the matching content, for a content match. */
	snippet?: string;
}

export interface LibrarySearchDetails {
	query: string;
	library: LibraryFilter;
	count: number;
	candidates: LibraryCandidate[];
	/** The library root that was searched, with the home directory shortened. */
	root: string;
	/** True when the library directory does not exist yet. */
	library_missing: boolean;
}

/** File extensions the library holds: markdown notes plus lorebook JSON. */
const LIBRARY_EXTENSIONS: ReadonlySet<string> = new Set([".md", ".txt", ".json"]);

/** The folder holding voice profiles. Everything else is lore. */
const VOICES_DIR = "voices";

/** Does `haystack` contain every token of `query`? */
export function matchesQuery(haystack: string, query: string): boolean {
	const tokens = normalizeForMatch(query).split(" ").filter(Boolean);
	if (tokens.length === 0) return false;
	const normalizedHaystack = normalizeForMatch(haystack);
	return tokens.every(token => normalizedHaystack.includes(token));
}

/** The library folder a relative path lives in, or "Lore" for a root note. */
export function categoryFor(relativePath: string): string {
	const dir = path.posix.dirname(relativePath);
	return dir === "." ? "Lore" : dir;
}

/** Is a relative path inside the requested filter? */
export function matchesLibraryFilter(relativePath: string, library: LibraryFilter): boolean {
	if (library === "any") return true;
	const inVoices = relativePath.split("/")[0] === VOICES_DIR;
	return library === "voices" ? inVoices : !inVoices;
}

/** A window of `content` around the first query token that appears in it. */
export function buildSnippet(content: string, query: string, radius = 60): string | undefined {
	const lower = content.toLowerCase();
	const tokens = normalizeForMatch(query).split(" ").filter(Boolean);
	for (const token of tokens) {
		const index = lower.indexOf(token);
		if (index === -1) continue;
		const start = Math.max(0, index - radius);
		const end = Math.min(content.length, index + token.length + radius);
		const prefix = start > 0 ? "…" : "";
		const suffix = end < content.length ? "…" : "";
		return `${prefix}${content.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
	}
	return undefined;
}

/** The library entries whose file name matches the query. */
export function searchFilenames(files: string[], query: string, library: LibraryFilter): LibraryCandidate[] {
	return files
		.filter(file => matchesLibraryFilter(file, library))
		.filter(file => matchesQuery(path.posix.basename(file, path.posix.extname(file)), query))
		.map(file => ({
			path: file,
			title: path.posix.basename(file, path.posix.extname(file)),
			category: categoryFor(file),
			matchType: "filename" as const,
		}));
}

/** The library entries whose content matches the query. */
export function searchContent(
	files: readonly { path: string; content: string }[],
	query: string,
	library: LibraryFilter,
): LibraryCandidate[] {
	return files
		.filter(file => matchesLibraryFilter(file.path, library))
		.filter(file => matchesQuery(file.content, query))
		.map(file => ({
			path: file.path,
			title: path.posix.basename(file.path, path.posix.extname(file.path)),
			category: categoryFor(file.path),
			matchType: "content" as const,
			snippet: buildSnippet(file.content, query),
		}));
}

/**
 * Search the lore library for a file matching a plain-language reference.
 *
 * The tool returns **candidates**, never a resolved file. The
 * "search, then confirm the match with the user" protocol only works if the
 * search refuses to guess.
 */
export class LibrarySearchTool implements AgentTool<typeof librarySearchSchema, LibrarySearchDetails> {
	readonly name = "library_search";
	readonly label = "Library search";
	readonly description = librarySearchDescription;
	readonly parameters = librarySearchSchema;
	readonly approval = "read" as const;
	readonly intent = "omit" as const;
	readonly strict = true;

	/** The library root this tool searches. Defaults to the user's lore library. */
	readonly #root: string;

	constructor(root?: string) {
		this.#root = root ?? getLoreDir();
	}

	async execute(
		_toolCallId: string,
		params: LibrarySearchParams,
		signal?: AbortSignal,
		_onUpdate?: AgentToolUpdateCallback<LibrarySearchDetails>,
		_context?: AgentToolContext,
	): Promise<AgentToolResult<LibrarySearchDetails>> {
		throwIfAborted(signal);
		const root = this.#root;
		const library = params.library ?? "any";
		const query = params.query;

		const relativePaths: string[] = [];
		let libraryMissing = false;
		try {
			for await (const relativePath of new Glob("**/*").scan({ cwd: root, dot: false, followSymlinks: true })) {
				if (LIBRARY_EXTENSIONS.has(path.posix.extname(relativePath).toLowerCase()))
					relativePaths.push(relativePath);
			}
		} catch (err) {
			if (!isEnoent(err)) throw err;
			libraryMissing = true;
		}

		let candidates = searchFilenames(relativePaths, query, library);
		if (candidates.length === 0 && !libraryMissing) {
			const withContent: { path: string; content: string }[] = [];
			for (const relativePath of relativePaths) {
				throwIfAborted(signal);
				try {
					withContent.push({ path: relativePath, content: await Bun.file(path.join(root, relativePath)).text() });
				} catch (err) {
					if (!isEnoent(err)) throw err;
				}
			}
			candidates = searchContent(withContent, query, library);
		}

		const details: LibrarySearchDetails = {
			query,
			library,
			count: candidates.length,
			candidates,
			root: shortenPath(root),
			library_missing: libraryMissing,
		};

		const text = renderCandidates(details, root);
		return { content: [{ type: "text", text }], details };
	}
}

/**
 * Render the candidate list a model reads.
 *
 * The paths are shown absolute (with the home directory shortened) so the agent
 * can read one directly, without having to re-derive the library root.
 */
function renderCandidates(details: LibrarySearchDetails, root: string): string {
	if (details.library_missing) {
		return `the lore library at ${details.root} does not exist yet — no candidates for "${details.query}"`;
	}
	if (details.candidates.length === 0) {
		return `no candidates for "${details.query}" in ${details.root} — report the miss, do not guess a filename`;
	}
	const lines = details.candidates.map((candidate, index) => {
		const fullPath = shortenPath(path.join(root, candidate.path));
		const head = `${index + 1}. ${fullPath}  [${candidate.category}] (${candidate.matchType})`;
		return candidate.snippet ? `${head}\n   ${candidate.snippet}` : head;
	});
	return `${details.candidates.length} candidate(s) for "${details.query}"\n${lines.join("\n")}`;
}
