import { afterEach, beforeAll, describe, expect, it, vi } from "bun:test";
import { formatVersion } from "@oh-my-pi/pi-utils/version";
import { logoInk, pickWeightedTip, WelcomeComponent } from "@oh-my-pi/pi-tui/prompt/welcome";
import { initTheme, theme } from "@oh-my-pi/pi-tui/theme";
import { visibleWidth } from "@oh-my-pi/pi-tui";

describe("WelcomeComponent", () => {
	beforeAll(async () => {
		await initTheme(false);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("natively sets the version under the wordmark beside the logo", () => {
		const tree = new WelcomeComponent("18.4.12").describe({} as never);
		expect(tree.c?.[0]).toMatchObject({
			key: "lockup",
			p: { role: "omp.welcome.lockup" },
			c: [
				{ k: "image", key: "logo" },
				{
					k: "col",
					p: { role: "omp.welcome.mark" },
					c: [
						{ p: { role: "omp.welcome.wordmark" } },
						{ p: { role: "omp.welcome.version", spans: [{ t: "v18.4.12" }] } },
					],
				},
			],
		});
	});

	it("selects standard tip when preset is not unicode", () => {
		vi.spyOn(theme, "getSymbolPreset").mockReturnValue("nerd");

		const welcome = new WelcomeComponent("1.0.0");
		expect(welcome.tip).not.toBe("Please use nerdfont 😭.");
		expect(welcome.tip).toBeDefined();
	});

	it("selects nerdfont tip with 10% probability under unicode preset", () => {
		vi.spyOn(theme, "getSymbolPreset").mockReturnValue("unicode");

		// 9% chance => selects special tip
		vi.spyOn(Math, "random").mockReturnValue(0.09);
		const welcomeSpecial = new WelcomeComponent("1.0.0");
		expect(welcomeSpecial.tip).toBe("Please use nerdfont 😭.");

		// 10% chance => selects regular tip
		vi.spyOn(Math, "random").mockReturnValue(0.1);
		const welcomeRegular = new WelcomeComponent("1.0.0");
		expect(welcomeRegular.tip).not.toBe("Please use nerdfont 😭.");
		expect(welcomeRegular.tip).toBeDefined();
	});

	it("weights [NEW] tips above ordinary tips in selection", () => {
		// Data-independent: tips.txt may legitimately carry zero "[NEW]" tips, so
		// exercise the weighting contract on a synthetic list.
		const tips = ["plain one", "shiny thing [NEW]", "plain two"] as const;

		const counts = new Map<string, number>();
		const samples = 10_000;
		for (let i = 0; i < samples; i++) {
			const tip = pickWeightedTip(tips, (i + 0.5) / samples); // sweep the selection domain uniformly
			counts.set(tip, (counts.get(tip) ?? 0) + 1);
		}

		let newMax = 0;
		let ordinaryMax = 0;
		for (const [tip, count] of counts) {
			if (/\[NEW\]\s*$/.test(tip)) newMax = Math.max(newMax, count);
			else ordinaryMax = Math.max(ordinaryMax, count);
		}

		// A "[NEW]" tip carries a >1 weight, so it covers strictly more of the
		// uniform selection domain than any single ordinary tip.
		expect(newMax).toBeGreaterThan(0);
		expect(newMax).toBeGreaterThan(ordinaryMax);
		expect(pickWeightedTip([], 0.5)).toBe("");
	});

	it("centers the lockup and every tip line in the terminal width", () => {
		const columns = 140;
		const rows = new WelcomeComponent("1.0.0").render(columns).map(row => Bun.stripANSI(row).trimEnd());
		const indent = (row: string) => visibleWidth(row) - visibleWidth(row.trimStart());
		const expectCentered = (left: number, right: number) => expect(Math.abs(left - right)).toBeLessThanOrEqual(1);

		// The lockup is one block: the logo's bar starts it, the wordmark row ends it.
		const bar = rows.find(row => row.includes("████████████")) ?? "";
		const word = rows.find(row => row.includes("▄▀▀▄")) ?? "";
		expectCentered(indent(bar), columns - visibleWidth(word));

		// Each tip line centers on its own.
		const below = rows.slice(rows.findIndex(row => row.includes("Tip: "))).filter(row => row.length > 0);
		expect(below.length).toBeGreaterThanOrEqual(1);
		for (const row of below) expectCentered(indent(row), columns - visibleWidth(row));
	});

	it("drops the tip below 50 columns", () => {
		const text = (columns: number) => Bun.stripANSI(new WelcomeComponent("1.2.3").render(columns).join("\n"));
		expect(text(50)).toContain("Tip: ");
		expect(text(49)).not.toContain("Tip: ");
		expect(text(49)).toContain("v1.2.3");
	});

	it("shows the version in its shortest form", () => {
		expect(formatVersion("0.1.0")).toBe("0.1");
		expect(formatVersion("0.1.5")).toBe("0.1.5");
		expect(formatVersion("18.12.3")).toBe("18.12.3");
	});

	it("sets the version under the wordmark while the lockup fits, else keeps the logo alone", () => {
		const rows = (columns: number) => new WelcomeComponent("1.2.3").render(columns).map(row => Bun.stripANSI(row));

		// The lockup needs 12 logo + 4 gap + 15 wordmark columns inside the 2-column margin.
		const fits = rows(33);
		// The wordmark's first glyph is the `m`; the version shares its column.
		const word = fits.find(row => row.includes("█▀▄▀▄"));
		const version = fits.find(row => row.includes("v1.2.3"));
		expect(fits.some(row => row.includes("████████████"))).toBe(true);
		expect(version?.indexOf("v1.2.3")).toBe(word?.indexOf("█▀▄▀▄"));

		const narrow = rows(32).join("\n");
		expect(narrow).toContain("████████████");
		expect(narrow).not.toContain("█▀▄▀▄");
		expect(narrow).not.toContain("v1.2.3");
	});

	it("stamps the mark in the ink that reads against the terminal background", () => {
		const previous = Bun.env.COLORFGBG;
		try {
			// COLORFGBG is the terminal-derived appearance signal the TUI falls
			// back to when the terminal does not answer an OSC 11 query.
			Bun.env.COLORFGBG = "0;15";
			expect(logoInk()).toBe("dark");
			Bun.env.COLORFGBG = "0;0";
			expect(logoInk()).toBe("light");
		} finally {
			if (previous === undefined) delete Bun.env.COLORFGBG;
			else Bun.env.COLORFGBG = previous;
		}
	});
});
