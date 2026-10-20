/**
 * Tests for project-scope registry resolution contracts.
 *
 * resolveActiveProjectRegistryPath: walk-up, .git fallback, null return, canonical path.
 * listClaudePluginRoots: project entries shadow user entries for same plugin ID.
 *
 * Note: helpers.ts imports @oh-my-pi/pi-natives (Rust addon via glob).
 * This file imports from helpers.ts directly — the native addon IS present in the
 * test environment (verified: `bun run import-helpers.ts` succeeds).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	clearClaudePluginRootsCache,
	listClaudePluginRoots,
	resolveActiveProjectRegistryPath,
	resolveOrDefaultProjectRegistryPath,
} from "@oh-my-pi/pi-coding-agent/discovery/helpers";
import { MarketplaceManager } from "@oh-my-pi/pi-coding-agent/extensibility/plugins/marketplace/manager";
import { getEnabledPlugins } from "@oh-my-pi/pi-coding-agent/extensibility/plugins/loader";
import type { InstalledPluginEntry } from "@oh-my-pi/pi-coding-agent/extensibility/plugins/marketplace";
import {
	addInstalledPlugin,
	buildPluginId,
	readInstalledPluginsRegistry,
	writeInstalledPluginsRegistry,
} from "@oh-my-pi/pi-coding-agent/extensibility/plugins/marketplace";
import { removeSyncWithRetries } from "@oh-my-pi/pi-utils";
import * as piUtils from "@oh-my-pi/pi-utils";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeEntry(installPath: string, scope: InstalledPluginEntry["scope"] = "user"): InstalledPluginEntry {
	return {
		scope,
		installPath,
		version: "1.0.0",
		installedAt: "2025-01-01T00:00:00.000Z",
		lastUpdated: "2025-01-01T00:00:00.000Z",
	};
}

// ── resolveActiveProjectRegistryPath ─────────────────────────────────────────

describe("resolveActiveProjectRegistryPath", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-proj-scope-"));
	});

	afterEach(() => {
		clearClaudePluginRootsCache();
		vi.restoreAllMocks();
		removeSyncWithRetries(tmpDir);
	});

	it("walk-up finds nearest .mop/ directory", async () => {
		// Layout: tmpDir/.mop/   +   tmpDir/sub/nested/  (cwd)
		// Resolver must climb from cwd → sub → tmpDir and find .mop/ there.
		fs.mkdirSync(path.join(tmpDir, ".mop"), { recursive: true });
		const cwd = path.join(tmpDir, "sub", "nested");
		fs.mkdirSync(cwd, { recursive: true });

		const result = await resolveActiveProjectRegistryPath(cwd);

		expect(result).toBe(path.join(tmpDir, ".mop", "plugins", "installed_plugins.json"));
	});

	it("walk-up stops at the nearest .mop/ — does not skip to a more distant one", async () => {
		// Layout: tmpDir/.mop/   +   tmpDir/sub/.mop/   +   tmpDir/sub/nested/  (cwd)
		// Resolver must stop at tmpDir/sub/.mop/, not climb further to tmpDir/.mop/.
		fs.mkdirSync(path.join(tmpDir, ".mop"), { recursive: true });
		fs.mkdirSync(path.join(tmpDir, "sub", ".mop"), { recursive: true });
		const cwd = path.join(tmpDir, "sub", "nested");
		fs.mkdirSync(cwd, { recursive: true });

		const result = await resolveActiveProjectRegistryPath(cwd);

		expect(result).toBe(path.join(tmpDir, "sub", ".mop", "plugins", "installed_plugins.json"));
	});

	it("falls back to .git root when no .mop/ exists", async () => {
		// Layout: tmpDir/.git/   +   tmpDir/sub/  (cwd)
		// No .mop/ anywhere → second pass finds .git/ at tmpDir.
		// Returned path is relative to the .git root, not .git itself.
		fs.mkdirSync(path.join(tmpDir, ".git"), { recursive: true });
		const cwd = path.join(tmpDir, "sub");
		fs.mkdirSync(cwd, { recursive: true });

		const result = await resolveActiveProjectRegistryPath(cwd);

		expect(result).toBe(path.join(tmpDir, ".mop", "plugins", "installed_plugins.json"));
	});

	it("does not load a temporary root's .mop/plugins from an unanchored scratch directory", async () => {
		const tempRoot = path.join(tmpDir, "tmp");
		const cwd = path.join(tempRoot, "scratch", "work");
		fs.mkdirSync(path.join(tempRoot, ".mop", "plugins"), { recursive: true });
		fs.mkdirSync(cwd, { recursive: true });
		vi.spyOn(os, "tmpdir").mockReturnValue(tempRoot);
		vi.spyOn(os, "homedir").mockReturnValue(path.join(tmpDir, "home"));

		expect(await resolveActiveProjectRegistryPath(cwd)).toBeNull();
	});

	it("does not fall back to a temporary root's .git anchor", async () => {
		const tempRoot = path.join(tmpDir, "tmp");
		const cwd = path.join(tempRoot, "scratch", "work");
		fs.mkdirSync(path.join(tempRoot, ".git"), { recursive: true });
		fs.mkdirSync(cwd, { recursive: true });
		vi.spyOn(os, "tmpdir").mockReturnValue(tempRoot);
		vi.spyOn(os, "homedir").mockReturnValue(path.join(tmpDir, "home"));

		expect(await resolveActiveProjectRegistryPath(cwd)).toBeNull();
	});

	it("still finds a project's .mop below the temporary root", async () => {
		const tempRoot = path.join(tmpDir, "tmp");
		const project = path.join(tempRoot, "project");
		const cwd = path.join(project, "sub");
		fs.mkdirSync(path.join(project, ".mop"), { recursive: true });
		fs.mkdirSync(cwd, { recursive: true });
		vi.spyOn(os, "tmpdir").mockReturnValue(tempRoot);
		vi.spyOn(os, "homedir").mockReturnValue(path.join(tmpDir, "home"));

		expect(await resolveActiveProjectRegistryPath(cwd)).toBe(
			path.join(project, ".mop", "plugins", "installed_plugins.json"),
		);
	});

	it("does not create a default project registry at an aliased temporary root", async () => {
		const tempRoot = path.join(tmpDir, "tmp");
		const alias = path.join(tmpDir, "tmp-link");
		fs.mkdirSync(path.join(tempRoot, ".mop"), { recursive: true });
		fs.symlinkSync(tempRoot, alias, "dir");
		vi.spyOn(os, "tmpdir").mockReturnValue(`${alias}${path.sep}`);
		vi.spyOn(os, "homedir").mockReturnValue(path.join(tmpDir, "home"));

		expect(await resolveActiveProjectRegistryPath(path.join(tempRoot, "scratch"))).toBeNull();
		expect(await resolveOrDefaultProjectRegistryPath(tempRoot)).toBeUndefined();
	});

	it.skipIf(process.platform === "win32").each(["/tmp", "/var/tmp"])(
		"does not create a project registry at the shared %s root even with another tmpdir",
		async root => {
			vi.spyOn(os, "tmpdir").mockReturnValue(tmpDir);
			vi.spyOn(os, "homedir").mockReturnValue(path.join(tmpDir, "home"));

			expect(await resolveOrDefaultProjectRegistryPath(root)).toBeUndefined();
		},
	);

	it("skips another account's .mop/agent root and falls back to the cwd's git anchor", async () => {
		const foreignHome = path.join(tmpDir, "other-user");
		const cwd = path.join(foreignHome, "Development", "project");
		fs.mkdirSync(path.join(foreignHome, ".mop", "agent"), { recursive: true });
		fs.mkdirSync(path.join(foreignHome, ".mop", "plugins"), { recursive: true });
		fs.mkdirSync(path.join(cwd, ".git"), { recursive: true });
		vi.spyOn(os, "homedir").mockReturnValue(path.join(tmpDir, "isolated-home"));

		expect(await resolveActiveProjectRegistryPath(cwd)).toBe(
			path.join(cwd, ".mop", "plugins", "installed_plugins.json"),
		);
		expect(await resolveOrDefaultProjectRegistryPath(foreignHome)).toBeUndefined();
	});

	it("keeps an active repo-local .mop/agent directory in project scope", async () => {
		const project = path.join(tmpDir, "project");
		const agentDir = path.join(project, ".mop", "agent");
		fs.mkdirSync(agentDir, { recursive: true });
		vi.spyOn(os, "homedir").mockReturnValue(path.join(tmpDir, "isolated-home"));
		vi.spyOn(piUtils, "getAgentDir").mockReturnValue(`${agentDir}${path.sep}`);
		const registry = path.join(project, ".mop", "plugins", "installed_plugins.json");

		expect(await resolveActiveProjectRegistryPath(project)).toBe(registry);
		expect(await resolveOrDefaultProjectRegistryPath(project)).toBe(registry);
	});

	it.each([".", "nested"])("keeps .mop/agent at or below a git root (%s) in project scope", async subdir => {
		const project = path.join(tmpDir, "project");
		const anchor = path.join(project, subdir);
		const cwd = path.join(anchor, "work");
		const home = path.join(tmpDir, "isolated-home");
		const pluginsDir = path.join(anchor, ".mop", "plugins");
		const pluginDir = path.join(pluginsDir, "node_modules", "omp-project-agent");
		fs.mkdirSync(path.join(project, ".git"), { recursive: true });
		fs.mkdirSync(path.join(anchor, ".mop", "agent"), { recursive: true });
		fs.mkdirSync(cwd, { recursive: true });
		fs.mkdirSync(pluginDir, { recursive: true });
		await Bun.write(
			path.join(pluginsDir, "package.json"),
			JSON.stringify({ dependencies: { "omp-project-agent": "*" } }),
		);
		await Bun.write(
			path.join(pluginDir, "package.json"),
			JSON.stringify({ name: "omp-project-agent", version: "1.0.0", omp: { tools: "tools" } }),
		);
		vi.spyOn(os, "homedir").mockReturnValue(home);
		vi.spyOn(piUtils, "getAgentDir").mockReturnValue(path.join(home, ".mop", "agent"));
		const registry = path.join(pluginsDir, "installed_plugins.json");

		expect(await resolveActiveProjectRegistryPath(cwd)).toBe(registry);
		expect(await resolveOrDefaultProjectRegistryPath(anchor)).toBe(registry);
		const plugins = await getEnabledPlugins(cwd, { home });
		expect(plugins.map(plugin => [plugin.name, plugin.scope, plugin.path])).toEqual([
			["omp-project-agent", "project", pluginDir],
		]);
	});

	it("skips an inactive user config root without a git anchor", async () => {
		const foreignHome = path.join(tmpDir, "other-user");
		const cwd = path.join(foreignHome, "scratch", "work");
		fs.mkdirSync(path.join(foreignHome, ".mop", "agent"), { recursive: true });
		fs.mkdirSync(path.join(foreignHome, ".mop", "plugins"), { recursive: true });
		fs.mkdirSync(cwd, { recursive: true });
		vi.spyOn(os, "tmpdir").mockReturnValue(tmpDir);
		vi.spyOn(os, "homedir").mockReturnValue(path.join(tmpDir, "isolated-home"));
		vi.spyOn(piUtils, "getAgentDir").mockReturnValue(path.join(tmpDir, "isolated-agent"));

		expect(await resolveActiveProjectRegistryPath(cwd)).toBeNull();
		expect(await resolveOrDefaultProjectRegistryPath(foreignHome)).toBeUndefined();
	});

	it("still prefers a plain ancestor .mop above the git root", async () => {
		const cwd = path.join(tmpDir, "project");
		fs.mkdirSync(path.join(tmpDir, ".mop"), { recursive: true });
		fs.mkdirSync(path.join(cwd, ".git"), { recursive: true });
		vi.spyOn(os, "homedir").mockReturnValue(path.join(tmpDir, "isolated-home"));

		expect(await resolveActiveProjectRegistryPath(cwd)).toBe(
			path.join(tmpDir, ".mop", "plugins", "installed_plugins.json"),
		);
	});

	it("returns null when neither .mop/ nor .git/ found anywhere in the tree", async () => {
		// Start at the filesystem root — guaranteed to have no .mop/ or .git/ ancestors.
		const result = await resolveActiveProjectRegistryPath(path.sep);

		expect(result).toBeNull();
	});

	it("does not treat ~/.git as a project root (pass-2 home-dir guard)", async () => {
		// Simulate a dotfiles repo managed with a bare-git technique: ~/.git exists.
		// resolveActiveProjectRegistryPath must NOT return ~/.mop/.../installed_plugins.json.
		const homeDir = fs.mkdtempSync(path.join(os.tmpdir(), "omp-proj-scope-home-"));
		vi.spyOn(os, "homedir").mockReturnValue(homeDir);
		const fakeHomeGit = path.join(homeDir, ".git");
		await fs.promises.mkdir(fakeHomeGit, { recursive: true });
		const cwd = path.join(homeDir, "work");
		await fs.promises.mkdir(cwd, { recursive: true });
		try {
			const result = await resolveActiveProjectRegistryPath(cwd);
			const homeOmpPath = path.join(homeDir, ".mop", "plugins", "installed_plugins.json");
			expect(result).not.toBe(homeOmpPath);
			expect(result).toBeNull();
		} finally {
			removeSyncWithRetries(homeDir);
		}
	});

	it("canonical path — /repo and /repo/src resolve to the same registry file", async () => {
		// Both sub-directories of the same project must produce identical paths.
		fs.mkdirSync(path.join(tmpDir, ".mop"), { recursive: true });
		const src = path.join(tmpDir, "src");
		fs.mkdirSync(src, { recursive: true });

		const fromRoot = await resolveActiveProjectRegistryPath(tmpDir);
		const fromSrc = await resolveActiveProjectRegistryPath(src);

		expect(fromRoot).not.toBeNull();
		expect(fromRoot).toBe(fromSrc);
	});

	it("keeps a user plugin in user scope with trailing-slash or symlinked home", async () => {
		const home = path.join(tmpDir, "home");
		const cwd = path.join(home, "work");
		const link = path.join(tmpDir, "home-link");
		const registryPath = path.join(home, ".mop", "plugins", "installed_plugins.json");
		fs.mkdirSync(cwd, { recursive: true });
		fs.mkdirSync(path.dirname(registryPath), { recursive: true });
		fs.symlinkSync(home, link, "dir");
		await writeInstalledPluginsRegistry(registryPath, {
			version: 2,
			plugins: { "sample@local": [makeEntry(path.join(tmpDir, "sample"))] },
		});

		for (const alias of [`${home}${path.sep}`, link]) {
			vi.spyOn(os, "homedir").mockReturnValue(alias);
			expect(await resolveActiveProjectRegistryPath(cwd)).toBeNull();
			const projectPath = await resolveOrDefaultProjectRegistryPath(cwd);
			const manager = new MarketplaceManager({
				marketplacesRegistryPath: path.join(home, ".mop", "plugins", "marketplaces.json"),
				installedRegistryPath: registryPath,
				projectInstalledRegistryPath: projectPath,
				marketplacesCacheDir: path.join(tmpDir, "marketplaces"),
				pluginsCacheDir: path.join(tmpDir, "plugins"),
			});
			expect((await manager.listInstalledPlugins()).map(({ scope }) => scope)).toEqual(["user"]);
			await manager.uninstallPlugin("sample@local", undefined, { dryRun: true });
			expect(await resolveOrDefaultProjectRegistryPath(home)).toBeUndefined();
		}
	});

	it("does not use an aliased user config as a project registry even at a git root", async () => {
		const home = path.join(tmpDir, "home");
		const project = path.join(home, "work");
		fs.mkdirSync(path.join(home, ".mop"), { recursive: true });
		fs.mkdirSync(path.join(project, ".git"), { recursive: true });
		fs.symlinkSync(path.join(home, ".mop"), path.join(project, ".mop"), "dir");
		vi.spyOn(os, "homedir").mockReturnValue(home);

		expect(await resolveActiveProjectRegistryPath(project)).toBeNull();
		expect(await resolveOrDefaultProjectRegistryPath(project)).toBeUndefined();
	});

	it("keeps a custom-home plugin in user scope during discovery", async () => {
		const home = path.join(tmpDir, "sdk-home");
		const cwd = path.join(home, "work");
		const registryPath = path.join(home, ".mop", "plugins", "installed_plugins.json");
		fs.mkdirSync(cwd, { recursive: true });
		await writeInstalledPluginsRegistry(registryPath, {
			version: 2,
			plugins: { "sample@local": [makeEntry(path.join(tmpDir, "sample"))] },
		});

		try {
			const { roots } = await listClaudePluginRoots(home, cwd);
			expect(roots.filter(root => root.id === "sample@local").map(root => root.scope)).toEqual(["user"]);
		} finally {
			clearClaudePluginRootsCache();
		}
	});
});

// ── listClaudePluginRoots: project shadows user ───────────────────────────────

describe("listClaudePluginRoots — project shadows user", () => {
	let tmpHome: string;
	let tmpProject: string;
	/** Path where listClaudePluginRoots reads the user OMP registry. */
	let userRegPath: string;
	/** Path where listClaudePluginRoots reads the project registry (resolved from tmpProject). */
	let projectRegPath: string;

	beforeEach(() => {
		tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "omp-shadow-home-"));
		tmpProject = fs.mkdtempSync(path.join(os.tmpdir(), "omp-shadow-proj-"));

		// Create .mop/ in project so resolveActiveProjectRegistryPath finds it.
		fs.mkdirSync(path.join(tmpProject, ".mop", "plugins"), { recursive: true });

		userRegPath = path.join(tmpHome, ".mop", "plugins", "installed_plugins.json");
		fs.mkdirSync(path.dirname(userRegPath), { recursive: true });

		projectRegPath = path.join(tmpProject, ".mop", "plugins", "installed_plugins.json");
	});

	afterEach(() => {
		// Cache is keyed by home:projectPath — must clear between tests.
		clearClaudePluginRootsCache();
		removeSyncWithRetries(tmpHome);
		removeSyncWithRetries(tmpProject);
	});

	it("project entry shadows user entry when plugin IDs match", async () => {
		const pluginId = buildPluginId("shared-plugin", "test-mkt");

		// User registry has the plugin at a user-side install path.
		let userReg = await readInstalledPluginsRegistry(userRegPath);
		userReg = addInstalledPlugin(userReg, pluginId, makeEntry("/user/install/shared-plugin"));
		await writeInstalledPluginsRegistry(userRegPath, userReg);

		// Project registry has the same plugin ID at a project-side install path.
		let projReg = await readInstalledPluginsRegistry(projectRegPath);
		projReg = addInstalledPlugin(projReg, pluginId, makeEntry("/project/install/shared-plugin", "project"));
		await writeInstalledPluginsRegistry(projectRegPath, projReg);

		const { roots } = await listClaudePluginRoots(tmpHome, tmpProject);
		const matching = roots.filter(r => r.id === pluginId);

		// Exactly one entry survives — the user entry is suppressed.
		expect(matching).toHaveLength(1);
		expect(matching[0]?.path).toBe("/project/install/shared-plugin");
		expect(matching[0]?.scope).toBe("project");
	});
});
