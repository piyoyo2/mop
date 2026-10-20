/**
 * Bundled skill corpus for mop.
 *
 * mop's JanitorAI domain ships as a tree of skills under the repo's `skills/`
 * directory: one `SKILL.md` router per skill, plus reference files the router
 * names and the model loads on demand.
 *
 * The tree has to reach three places: a monorepo checkout (the directory is
 * already on disk), the prepacked npm bundle, and a standalone compiled binary.
 * The last two have no directory to point at, so they inline a compressed index
 * of the tree — injected via `process.env.PI_SKILLS_EMBED` at build time, and
 * written to `dist/skills-index.generated.txt` for the npm package. The format
 * matches the docs corpus: two lines.
 *
 *   1. a plain JSON array of the sorted file paths relative to the skills root, and
 *   2. a base64 gzip blob of the index-aligned file bodies (`string[]`).
 *
 * Listing never touches the blob; the bodies are gunzipped off the event loop
 * (via the async `node:zlib` threadpool) lazily, once, on the first read.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";
import { getBaseConfigRoot, isEnoent } from "@oh-my-pi/pi-utils";
import { Glob } from "bun";

const skillsEmbed = process.env.PI_SKILLS_EMBED ?? "";

/**
 * Where the corpus lives when it is reachable as a plain directory: the
 * package's own `skills/` folder.
 *
 * Two layouts are probed, because the module runs from `src/skills/` in a
 * source checkout or npm package but from `dist/` inside the bundled CLI:
 * `../../skills` resolves in the first, `../skills` in the second.
 */
const SKILLS_DIR_CANDIDATES = [
	path.resolve(import.meta.dir, "../../skills"),
	path.resolve(import.meta.dir, "../skills"),
];

/** First candidate that actually holds a skill, or `null` when none does. */
function resolveSkillsDir(): string | null {
	for (const dir of SKILLS_DIR_CANDIDATES) {
		try {
			for (const entry of readdirSync(dir, { withFileTypes: true })) {
				if (entry.isDirectory() && existsSync(path.join(dir, entry.name, "SKILL.md"))) return dir;
			}
		} catch (err) {
			if (!isEnoent(err)) throw err;
		}
	}
	return null;
}

const gunzipAsync = promisify(gunzip);

export interface SkillsIndex {
	/** Sorted skill file paths, relative to the skills root. */
	readonly filenames: readonly string[];
	/** Resolve a file body by relative path; inflates the embedded bodies off-thread, lazily, on first call. */
	getBody(relativePath: string): Promise<string | undefined>;
}

/**
 * Decode a populated two-line embed (`<filenames JSON>\n<base64 gzip of bodies>`)
 * into a lazily-inflating index, or `null` when there is no newline separator
 * (the empty placeholder, or a malformed payload — the caller decides which).
 */
export function decodeSkillsIndex(embed: string): SkillsIndex | null {
	const newline = embed.indexOf("\n");
	if (newline === -1) return null;
	const filenames = JSON.parse(embed.slice(0, newline)) as string[];
	let bodies: Promise<Record<string, string>> | undefined;
	return {
		filenames,
		getBody(relativePath: string): Promise<string | undefined> {
			bodies ??= (async () => {
				const inflated = await gunzipAsync(Buffer.from(embed.slice(newline + 1), "base64"));
				const decoded = JSON.parse(inflated.toString("utf8")) as string[];
				const map: Record<string, string> = {};
				for (let i = 0; i < filenames.length; i++) map[filenames[i]] = decoded[i];
				return map;
			})();
			return bodies.then(map => map[relativePath]);
		},
	};
}

/** Dev tree / source checkout: read the index straight off the package's `skills/` directory. */
function readSkillsFromDisk(): SkillsIndex | null {
	const skillsDir = resolveSkillsDir();
	if (skillsDir === null) return null;
	const filenames: string[] = [];
	const bodies: Record<string, string> = {};
	try {
		for (const relativePath of new Glob("**/*").scanSync(skillsDir)) {
			const normalized = relativePath.split(path.sep).join("/");
			filenames.push(normalized);
			bodies[normalized] = readFileSync(path.join(skillsDir, relativePath), "utf8");
		}
	} catch (err) {
		if (isEnoent(err)) return null;
		throw err;
	}
	filenames.sort();
	return { filenames, getBody: relativePath => Promise.resolve(bodies[relativePath]) };
}

/** Prepacked npm package: the skills embed is written to `dist/skills-index.generated.txt` during `gen:bundle`. */
function readShippedEmbed(): SkillsIndex | null {
	const embedPath = path.resolve(import.meta.dir, "../../dist/skills-index.generated.txt");
	let raw: string;
	try {
		raw = readFileSync(embedPath, "utf8");
	} catch (err) {
		if (isEnoent(err)) return null;
		throw err;
	}
	const decoded = decodeSkillsIndex(raw);
	if (decoded === null) {
		throw new Error(
			`Malformed shipped skills index at ${embedPath}: payload without a newline separator. Rebuild the bundle.`,
		);
	}
	return decoded;
}

/** Empty index for when no skills corpus is reachable — degrades the provider instead of throwing. */
function emptyIndex(): SkillsIndex {
	return { filenames: [], getBody: () => Promise.resolve(undefined) };
}

let index: SkillsIndex | undefined;
/** Filesystem root backing the corpus when it was read from disk; `null` for embed/shipped/empty. */
let diskRoot: string | null | undefined;
function getIndex(): SkillsIndex {
	if (index !== undefined) return index;
	if (skillsEmbed.length > 0) {
		const decoded = decodeSkillsIndex(skillsEmbed);
		if (decoded === null) {
			throw new Error(
				"Malformed embedded skills index: non-empty payload without a newline separator. " +
					"Rebuild the binary or bundle.",
			);
		}
		index = decoded;
		diskRoot = null;
		return index;
	}
	// A source checkout and an unpacked npm package both carry the corpus as
	// plain files, and those files are the ones being edited — so the directory
	// wins over a shipped embed that a previous bundle build left behind.
	const fromDisk = readSkillsFromDisk();
	if (fromDisk !== null) {
		index = fromDisk;
		diskRoot = resolveSkillsDir();
		return index;
	}
	// The bundled CLI has no `skills/` directory next to it; it reads the embed
	// the bundle build wrote.
	const shipped = readShippedEmbed();
	if (shipped !== null) {
		index = shipped;
		diskRoot = null;
		return index;
	}
	index = emptyIndex();
	diskRoot = null;
	return index;
}

/** Sorted list of available bundled skill file paths (relative to the skills root). */
export function getBundledSkillFilenames(): readonly string[] {
	return getIndex().filenames;
}

/**
 * Filesystem root backing the corpus when the active index was read from disk
 * (a monorepo checkout), or `null` when it came from an embed, the shipped
 * bundle file, or nowhere.
 */
export function getBundledSkillsDiskRoot(): string | null {
	getIndex();
	return diskRoot ?? null;
}

/** Resolve a bundled skill file's content, or `undefined` when not found. */
export function getBundledSkillBody(relativePath: string): Promise<string | undefined> {
	return getIndex().getBody(relativePath);
}

/**
 * Directory the bundled skills tree is materialized into when it is not
 * reachable as a plain directory (compiled binary, npm package).
 *
 * Kept under the config root rather than the agent dir so a user's own
 * `~/.mop/agent/skills/` entries and mop's bundled corpus never collide.
 */
export function getBundledSkillsRoot(): string {
	return path.join(getBaseConfigRoot(), "skills");
}
