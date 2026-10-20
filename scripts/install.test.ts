import { afterEach, describe, expect, test } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

// install.sh binary mode against a fake GitHub releases host. The host is faked
// as musl Linux x64 by shadowing uname/ldd via PATH; MSYS sh on Windows
// prepends /usr/bin, so the stubs never win there.

const repoRoot = path.join(import.meta.dir, "..");
const BINARY = '#!/bin/sh\necho "mop/1.0.0"\n';
const CLEANUPS: (() => Promise<void> | void)[] = [];

afterEach(async () => {
	for (const cleanup of CLEANUPS.splice(0)) await cleanup();
});

function sha256(text: string): string {
	return new Bun.CryptoHasher("sha256").update(text).digest("hex");
}

/**
 * A releases host answering every release query with version 1.0.0 of
 * `mop-1.0.0-linux-musl-x86_64`. The sha256 sidecar carries the binary's real
 * digest; `binarySha256` lets a test hand out a different one.
 */
function startReleases(binarySha256: string): { url: string; apiUrl: string; requests: string[] } {
	const requests: string[] = [];
	const server = Bun.serve({
		port: 0,
		fetch(request) {
			const url = new URL(request.url);
			requests.push(url.pathname + url.search);
			if (url.pathname.endsWith(".sha256")) {
				return new Response(`${binarySha256}  ${url.pathname.split("/").pop()}\n`);
			}
			if (url.pathname.endsWith("/mop-1.0.0-linux-musl-x86_64")) {
				return new Response(BINARY);
			}
			if (url.pathname.endsWith("/latest")) {
				return Response.json({ tag_name: "v1.0.0" });
			}
			return Response.json({ error: "not_found" }, { status: 404 });
		},
	});
	CLEANUPS.push(() => server.stop(true));
	// Trailing slashes on the release URLs are trimmed.
	return { url: `${server.url.origin}/releases/`, apiUrl: `${server.url.origin}/api/`, requests };
}

async function writeExecutable(file: string, content: string): Promise<void> {
	await Bun.write(file, content);
	await fs.chmod(file, 0o755);
}

async function runInstall(
	releasesUrl: string,
	apiUrl: string,
	args: string[],
): Promise<{
	exitCode: number;
	stdout: string;
	stderr: string;
	installDir: string;
}> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "mop-install-"));
	CLEANUPS.push(() => fs.rm(dir, { recursive: true, force: true }));
	const binDir = path.join(dir, "bin");
	const installDir = path.join(dir, "install");
	await writeExecutable(path.join(binDir, "uname"), '#!/bin/sh\n[ "$1" = "-s" ] && echo Linux || echo x86_64\n');
	await writeExecutable(path.join(binDir, "ldd"), "#!/bin/sh\necho 'musl libc (x86_64)'\n");
	const proc = Bun.spawn(["sh", "scripts/install.sh", ...args], {
		cwd: repoRoot,
		env: {
			...process.env,
			PATH: `${binDir}:${process.env.PATH ?? ""}`,
			HOME: dir,
			PI_INSTALL_DIR: installDir,
			PI_RELEASES_URL: releasesUrl,
			PI_RELEASES_API_URL: apiUrl,
		},
		stdout: "pipe",
		stderr: "pipe",
	});
	const [exitCode, stdout, stderr] = await Promise.all([
		proc.exited,
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	return { exitCode, stdout, stderr, installDir };
}

describe.skipIf(process.platform === "win32")("install.sh binary mode", () => {
	test("installs the host target's release, verified against the published sha256", async () => {
		const releases = startReleases(sha256(BINARY));
		const result = await runInstall(releases.url, releases.apiUrl, ["--binary"]);

		expect(result.exitCode, result.stdout + result.stderr).toBe(0);
		expect(releases.requests[0]).toBe("/api/latest");
		expect(result.stdout).toContain("Using version: 1.0.0");
		expect(await fs.readdir(result.installDir)).toEqual(["mop"]);
		expect(await Bun.file(path.join(result.installDir, "mop")).text()).toBe(BINARY);
	});

	test("refuses a download whose sha256 differs from the published one", async () => {
		const releases = startReleases(sha256("something else"));
		const result = await runInstall(releases.url, releases.apiUrl, ["--binary"]);

		expect(result.exitCode).not.toBe(0);
		expect(result.stdout).toContain("Checksum mismatch for mop-1.0.0-linux-musl-x86_64");
		expect(await fs.readdir(result.installDir)).toEqual([]);
	});

	test("--ref pins a release tag and rejects other refs", async () => {
		const releases = startReleases(sha256(BINARY));
		const tagged = await runInstall(releases.url, releases.apiUrl, ["--binary", "--ref", "v1.0.0"]);
		expect(tagged.exitCode, tagged.stdout + tagged.stderr).toBe(0);
		// A pinned ref never asks for the latest release.
		expect(releases.requests).not.toContain("/api/latest");

		const branch = await runInstall(releases.url, releases.apiUrl, ["--binary", "--ref", "main"]);
		expect(branch.exitCode).toBe(1);
		expect(branch.stdout).toContain("use --source with --ref");
	});
});
