import { describe, expect, it } from "bun:test";
import * as path from "node:path";
import { InternalUrlRouter } from "@oh-my-pi/pi-coding-agent/internal-urls";
import { getDocsDiskRoot } from "@oh-my-pi/pi-coding-agent/internal-urls/docs-index";

describe("MopProtocolHandler", () => {
	it("treats mop://docs as the documentation root", async () => {
		const resource = await InternalUrlRouter.instance().resolve("mop://docs");

		expect(resource.content).toContain("# Documentation");
		expect(resource.content).toContain("tools/read.md");
	});

	it("resolves docs-prefixed documentation paths", async () => {
		const router = InternalUrlRouter.instance();
		const direct = await router.resolve("mop://tools/read.md");
		const prefixed = await router.resolve("mop://docs/tools/read.md");

		expect(prefixed.content).toBe(direct.content);
		expect(prefixed.content).toContain("# read");
	});

	it("locates a doc to the file the active corpus was read from", async () => {
		const router = InternalUrlRouter.instance();
		// A source checkout reads docs from disk; a bundled or embedded corpus
		// (e.g. after `gen:bundle`) has no file and must never link.
		const root = getDocsDiskRoot();
		const onDisk = root === null ? undefined : path.join(root, "tools", "read.md");

		// Both renderer entry points (sync read cards, async markdown links) must
		// agree on the file, or a link opens a doc `read` never resolved.
		expect(router.locateSync("mop://tools/read.md")).toBe(onDisk);
		expect(router.locateSync("mop://docs/tools/read.md:1-20")).toBe(onDisk);
		expect(await router.locate("mop://tools/read.md")).toBe(onDisk ?? null);
	});

	it("never locates a URL that names no doc on disk", async () => {
		const router = InternalUrlRouter.instance();

		// The docs root is a listing, and an unknown doc has no file: linking it
		// would open something `mop://` does not serve.
		expect(router.locateSync("mop://")).toBeUndefined();
		expect(router.locateSync("mop://docs")).toBeUndefined();
		expect(router.locateSync("mop://no-such-doc.md")).toBeUndefined();
		expect(await router.locate("mop://no-such-doc.md")).toBeNull();

		// Render paths must survive a model-authored traversal URL.
		expect(router.locateSync("mop://../AGENTS.md")).toBeUndefined();
	});
});
