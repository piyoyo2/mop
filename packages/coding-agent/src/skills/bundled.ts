/**
 * Provider for mop's bundled skill corpus.
 *
 * The corpus is the JanitorAI domain: one `SKILL.md` router per skill, each
 * naming the reference files the model should read at a given step. The heavy
 * material never sits in an agent prompt — it lives in the reference files and
 * is loaded on demand through `skill://<name>/<path>`.
 *
 * Three delivery shapes, one code path:
 *
 * - **Monorepo checkout** — the `skills/` directory is already on disk. The
 *   provider scans it in place; nothing is copied.
 * - **npm bundle / compiled binary** — the corpus is inlined as a compressed
 *   index (see `skills-index.ts`). It is materialized into the config root so
 *   that reference files exist as real paths, which is what `skill://`
 *   resolution and the `read` tool need.
 *
 * Materialization is idempotent: a file whose content already matches is left
 * alone, and files that the corpus no longer contains are pruned, so an
 * upgraded install never serves a stale reference.
 */
import * as path from "node:path";
import { Glob } from "bun";
import { registerProvider } from "../capability";
import { type Skill, skillCapability } from "../capability/skill";
import type { LoadContext, LoadResult } from "../capability/types";
import { scanSkillsFromDir } from "../discovery/helpers";
import {
	getBundledSkillBody,
	getBundledSkillFilenames,
	getBundledSkillsDiskRoot,
	getBundledSkillsRoot,
} from "./skills-index";

const PROVIDER_ID = "mop-bundled";
const DISPLAY_NAME = "mop bundled";
const DESCRIPTION = "Character-card authoring skills shipped with mop";
/** Above the native provider (100): mop's domain skills keep their canonical names. */
const PRIORITY = 110;

/**
 * Copy the embedded corpus to disk so every file has a real path.
 * Files whose content already matches are skipped; files the corpus no longer
 * contains are removed.
 */
export async function materializeBundledSkills(root: string): Promise<void> {
	const filenames = getBundledSkillFilenames();
	const wanted = new Set(filenames);
	for (const relativePath of filenames) {
		const body = await getBundledSkillBody(relativePath);
		if (body === undefined) continue;
		const target = path.join(root, relativePath);
		const existing = await Bun.file(target)
			.text()
			.catch(() => undefined);
		if (existing === body) continue;
		await Bun.write(target, body);
	}
	for (const relativePath of new Glob("**/*").scanSync(root)) {
		const normalized = relativePath.split(path.sep).join("/");
		if (wanted.has(normalized)) continue;
		await Bun.file(path.join(root, relativePath))
			.delete()
			.catch(() => undefined);
	}
}

/**
 * Directory holding the bundled skill tree, materializing it when the corpus
 * only exists as an inlined index. `null` when no corpus is reachable at all.
 */
let resolvedRoot: string | null | undefined;
export async function ensureBundledSkillsTree(): Promise<string | null> {
	if (resolvedRoot !== undefined) return resolvedRoot;
	const diskRoot = getBundledSkillsDiskRoot();
	if (diskRoot !== null) {
		resolvedRoot = diskRoot;
		return resolvedRoot;
	}
	if (getBundledSkillFilenames().length === 0) {
		resolvedRoot = null;
		return resolvedRoot;
	}
	const root = getBundledSkillsRoot();
	await materializeBundledSkills(root);
	resolvedRoot = root;
	return resolvedRoot;
}

async function loadBundledSkills(ctx: LoadContext): Promise<LoadResult<Skill>> {
	const root = await ensureBundledSkillsTree();
	if (root === null) return { items: [] };
	return scanSkillsFromDir(ctx, {
		dir: root,
		providerId: PROVIDER_ID,
		level: "user",
		requireDescription: true,
	});
}

registerProvider<Skill>(skillCapability.id, {
	id: PROVIDER_ID,
	displayName: DISPLAY_NAME,
	description: DESCRIPTION,
	priority: PRIORITY,
	load: loadBundledSkills,
});
