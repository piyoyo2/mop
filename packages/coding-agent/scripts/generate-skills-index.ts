import * as path from "node:path";
import { gzipSync } from "node:zlib";
import { Glob } from "bun";

const packageDir = path.resolve(import.meta.dir, "..");
const skillsDir = path.join(packageDir, "skills");
const outputPath = path.join(packageDir, "dist", "skills-index.generated.txt");

export interface SkillsIndexPayload {
	readonly files: readonly string[];
	readonly bodies: readonly string[];
	readonly payload: string;
}

/**
 * Build the two-line skills embed from the repo `skills/` corpus: the sorted
 * file paths relative to the skills root on the first line, and a base64 gzip
 * blob of the index-aligned bodies on the second.
 */
export async function buildSkillsIndexPayload(): Promise<SkillsIndexPayload> {
	const glob = new Glob("**/*");
	const files: string[] = [];
	for await (const relativePath of glob.scan(skillsDir)) {
		files.push(relativePath.split(path.sep).join("/"));
	}
	files.sort();

	const bodies = await Promise.all(files.map(file => Bun.file(path.join(skillsDir, file)).text()));
	const bodiesB64 = Buffer.from(gzipSync(Buffer.from(JSON.stringify(bodies)), { level: 9 })).toString("base64");
	return {
		files,
		bodies,
		payload: `${JSON.stringify(files)}\n${bodiesB64}`,
	};
}

if (import.meta.main) {
	const payload = await buildSkillsIndexPayload();
	await Bun.write(outputPath, payload.payload);
	console.log(`Wrote ${payload.files.length} skill files to ${outputPath}`);
}
