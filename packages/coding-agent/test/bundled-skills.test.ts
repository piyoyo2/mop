import { afterEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { gzipSync } from "node:zlib";
import { parseInternalUrl } from "@oh-my-pi/pi-coding-agent/internal-urls/parse";
import { SkillProtocolHandler } from "@oh-my-pi/pi-coding-agent/internal-urls/skill-protocol";
import { loadSkills, resetActiveSkillsForTests, setActiveSkills } from "@oh-my-pi/pi-coding-agent/extensibility/skills";
import { materializeBundledSkills } from "@oh-my-pi/pi-coding-agent/skills/bundled";
import { decodeSkillsIndex } from "@oh-my-pi/pi-coding-agent/skills/skills-index";

const ALL_DEFAULT_SOURCES_DISABLED = {
	enableCodexUser: false,
	enableClaudeUser: false,
	enableClaudeProject: false,
	enablePiUser: false,
	enablePiProject: false,
	enableAgentsUser: false,
	enableAgentsProject: false,
} as const;

/** The domain skills mop ships. Every one of them must be discoverable by name. */
const BUNDLED_SKILL_NAMES = [
	"anti-slop",
	"card-anatomy",
	"card-authoring",
	"card-rewrite",
	"forensics",
	"lore-library",
	"lorebook",
	"macro-rules",
	"review",
	"section-drafts",
	"token-economics",
	"voice-profile",
	"worldbuilding",
] as const;

describe("mop bundled skills", () => {
	const tempDirs: string[] = [];

	afterEach(async () => {
		resetActiveSkillsForTests();
		for (const dir of tempDirs) await fs.rm(dir, { recursive: true, force: true });
		tempDirs.length = 0;
	});

	it("discovers every bundled domain skill with a routing description", async () => {
		const { skills } = await loadSkills({ ...ALL_DEFAULT_SOURCES_DISABLED });
		const byName = new Map(skills.map(skill => [skill.name, skill]));

		for (const name of BUNDLED_SKILL_NAMES) {
			const skill = byName.get(name);
			expect(skill, `bundled skill "${name}" was not discovered`).toBeDefined();
			// The description is the routing trigger: without it the model cannot
			// decide to read the skill in the first place.
			expect(skill?.description.length ?? 0).toBeGreaterThan(0);
		}
	});

	it("resolves a bundled skill's reference file through skill://", async () => {
		const { skills } = await loadSkills({ ...ALL_DEFAULT_SOURCES_DISABLED });
		setActiveSkills(skills);

		const handler = new SkillProtocolHandler();
		const resource = await handler.resolve(parseInternalUrl("skill://card-anatomy/references/four-box-model.md"));

		// The heavy material is not in the router: it lives in the reference file
		// and is only reachable on demand.
		const router = skills.find(skill => skill.name === "card-anatomy");
		const routerBody = await Bun.file(router!.filePath).text();
		expect(routerBody).not.toContain("The four-box model");
		expect(resource.content).toContain("The four-box model");
	});

	it("materializes the corpus to disk and prunes files the corpus dropped", async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "mop-skills-"));
		tempDirs.push(root);
		await fs.mkdir(path.join(root, "card-anatomy"), { recursive: true });
		await Bun.write(path.join(root, "card-anatomy", "SKILL.md"), "stale\n");
		await Bun.write(path.join(root, "removed-skill.md"), "stale\n");

		await materializeBundledSkills(root);

		const cardAnatomy = await Bun.file(path.join(root, "card-anatomy", "SKILL.md")).text();
		expect(cardAnatomy).toContain("name: card-anatomy");
		// A file the corpus no longer contains must not survive an upgrade.
		expect(await Bun.file(path.join(root, "removed-skill.md")).exists()).toBe(false);
		// Reference files come along with the router they belong to.
		expect(await Bun.file(path.join(root, "card-anatomy", "references", "four-box-model.md")).exists()).toBe(true);
	});

	it("decodes an embedded corpus back into the files it was built from", async () => {
		const filenames = ["a/SKILL.md", "a/references/b.md"];
		const bodies = ["body one", "body two"];
		const payload = `${JSON.stringify(filenames)}\n${gzipSync(Buffer.from(JSON.stringify(bodies))).toString("base64")}`;

		const index = decodeSkillsIndex(payload);
		expect(index).not.toBeNull();
		expect(index?.filenames).toEqual(filenames);
		expect(await index?.getBody("a/references/b.md")).toBe("body two");
		expect(await index?.getBody("a/missing.md")).toBeUndefined();
	});
});
