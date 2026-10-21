# HANDOFF

**Project:** mop — a character-card authoring agent
**Repo:** https://github.com/piyoyo2/mop
**Fork base:** [`can1357/oh-my-pi`](https://github.com/can1357/oh-my-pi) @ `7820b7de27` (v18.12.3)
**Status:** Milestone 1 complete and verified. Milestone 2 (the analyzer tools) complete and
verified in the compiled binary. Milestone 3 not started.
**Last updated:** 2026-10-21

---

## 1. The vision

mop is a coding agent for **character cards**. It builds and revises JanitorAI-style
character cards, their lorebooks, and the worldbuilding they rest on.

### Lineage

mop is the successor to **jclaw** (`/Users/westin/Desktop/jclaw`, repo `soliloquy1/Jclaw`).
jclaw was a fork of opencode's TUI plus a vendored Rust "claw-code" runtime. It worked,
but it was heavy in three specific ways:

1. **Two runtimes, one of them dead weight.** jclaw's `tui/` was vendored opencode
   (Bun/TS/Solid) and did all the real work. Its `rust/` was vendored claw-code —
   ~35k LOC across 8 crates — that was really just a launcher plus a diagnostic CLI.
   The two halves exchanged exactly three things: a path, an env marker, and a bun
   invocation.
2. **The domain lived in agent prompts.** 19 agents, 970 LOC of prompt text, a 45KB
   README. `peak.txt` alone was 180 LOC / ~8.2k tokens and held the card model, the
   macro rules, the token economics, the lorebook spec, and the whole anti-slop rubric.
3. **Duplicated logic.** `card_tools.rs` (1,754 LOC) and the TS tools implemented the
   same bands and macro rules with *different* thresholds (a real BPE tokenizer vs a
   `chars/4` heuristic), and the constants had already drifted.

mop fixes all three by forking **oh-my-pi** (omp) instead, which has a single coherent
runtime: the Bun/TypeScript `coding-agent` package *is* the agent, and `crates/pi-*` are
a performance addon (in-process grep, glob, shell, AST) rather than a second agent
implementation.

### The design rule

> **The prompt stays small. The domain lives in skills. The heavy material lives in
> reference files, loaded only when the agent reaches that step.**

Two agents, both light skeletons:

- the **main agent** — identity, craft principles, workflow, tool policy;
- a **read-only agent** (`reader`) — for parallel reads over the lore library.

Everything else is a **skill**: a short `SKILL.md` that says *when it applies*, *the
workflow*, and *which reference file to read at which step*. The card schema, the macro
rules, the anti-slop rubric, the reference lorebook, the voice-profile format — none of
it is in a prompt. The agent reads it on demand, when a task reaches that step.

```
skills/
  card-anatomy/SKILL.md            router: when it applies, the workflow, which ref
    references/four-box-model.md     heavy material, loaded on demand
```

This is the whole point of the design. A skill's router is the *retrieval trigger* —
its `description` is what the model matches against to decide whether to read it. The
reference files are the *content*. omp's skill system (`packages/coding-agent/src/skills/`)
gave us `skill://<name>` URLs and on-demand file reads for free; the corpus rides on
top of that.

---

## 2. What we did

### Phase 0 — Research (read-only, ~40 min of agent time)

Explored jclaw end to end and omp end to end, in parallel, before writing any code.

**jclaw findings** (subagent reports):

- Two layers: `tui/` (vendored opencode, does the work) and `rust/` (vendored claw-code).
- The only coupling is `rust/crates/rusty-claude-cli/src/tui.rs` (320 LOC) — it locates
  bun, builds an argv, and `exec()`s into `tui/packages/opencode/src/index.ts`. It sets
  `JCLAW_TUI=1` and passes `JCLAW_BUN` / `JCLAW_TUI_DIR`.
- 19 agents. Heavy prompts: `peak.txt` 180 LOC, `build.txt` 47, `review.txt` 53,
  `worldsmith.txt` 35, `voice-profiler.txt` 42. Light: the 13 lens prompts (600–1,100
  tokens each).
- The domain model: four platform-fixed boxes (Scenario, Personality, Opening Messages,
  Example Dialogue); Personality + Opening Messages required; Scenario + Personality are
  the *permanent* budget; a lorebook is SillyTavern/Chub "World Info" JSON with one
  `constant: true` hub plus conditional entries.
- The lore library: `~/.local/share/opencode/jclaw/lore/` with `worlds/`, `voices/`,
  `ideas/` subfolders and kebab-case filenames.
- 9 custom TS tools (~886 LOC) — `card_budget`, `card_macro_check`, `tokenize`,
  `text_entropy`, `text_fingerprint`, `ghost_phrase_scan`, `library_search`,
  `command_search`, plus `match-util.ts`.
- The numeric thresholds (baili code bands, macro known-set, ghost-phrase list,
  slop-risk weights) were captured in full — they became the content of mop's
  reference files.
- `tui/HANDOFF.md` item 36 records that the anti-slop rubric was cross-checked against
  four external botmaking guides. That document is the provenance for the rubric's
  *intent*, and the port source for its *content*.

**omp findings** (subagent reports):

- Packages: `coding-agent` (primary), `agent`, `ai`, `catalog`, `tui`, `natives`,
  `omptype`, `stats`, `utils`. Rust: `crates/pi-*` (perf only).
- The **skills system**: `src/extensibility/skills.ts` (loader + collision resolution),
  `src/capability/skill.ts` (the `Skill` type), `src/discovery/helpers.ts`
  (`scanSkillsFromDir`), `src/discovery/builtin.ts` (the `.omp/skills/` provider),
  `src/internal-urls/skill-protocol.ts` (`skill://<name>/<path>` resolution).
  Discovery is **non-recursive, one level under `skills/`**. A router is a
  `SKILL.md` with `name` + `description` frontmatter; `description` is mandatory for the
  native provider.
- The **agent roster**: `src/task/agents.ts` (`EMBEDDED_AGENT_DEFS`, embedded via
  `import … with { type: "text" }`), frontmatter parsed by `parseAgentFields`.
  `tools:` restricts a subagent's tool set. `read-only-policy.ts` enforces read-only
  subagents.
- The **system prompt** is a Handlebars template; `src/prompts/system/system-prompt.md`.
  `SYSTEM.md` / `SYSTEM_TEMPLATE.md` override it at user/project scope.
- The **docs corpus** pattern (`src/internal-urls/docs-index.ts`): a two-line embed —
  a JSON filename list plus a base64 gzip blob of bodies — injected at build time via
  `process.env.PI_DOCS_EMBED`, written to `dist/` for the npm package, falling back to
  the on-disk `docs/` directory in a source checkout. **This is the pattern mop's skill
  corpus copied.**

### Phase 1 — The fork

```sh
git clone --filter=blob:none https://github.com/can1357/oh-my-pi.git .
git remote rename origin upstream
git remote add origin https://github.com/piyoyo2/mop.git
```

Blobless (`--filter=blob:none`) so the history stays small locally, with upstream
intact for merges. Local git identity: `piyoyo2 <Eousbelle@gmail.com>`.

### Phase 2 — The rebrand

**Deliberate scope decision:** rename the *user-facing surface*, not the internals.
Renaming the `@oh-my-pi/*` npm scope would have touched 4,788 files and created
permanent merge friction for zero user-visible benefit. The internal package names
stay `@oh-my-pi/pi-*`; only the binary, config dir, URL scheme, and published package
name changed.

| Surface | Before | After |
|---|---|---|
| Binary | `omp` | `mop` |
| Config root | `~/.omp/` | `~/.mop/` |
| Project config | `.omp/` | `.mop/` |
| Internal URL scheme | `omp://` | `mop://` |
| Published package | `@oh-my-pi/pi-coding-agent` | `@mop/pi-coding-agent` |
| Natives package | `@oh-my-pi/pi-natives` | `@mop/pi-natives` |
| Log files | `omp.<date>.<pid>.log` | `mop.<date>.<pid>.log` |

Code changes (all in `packages/utils/src/dirs.ts` unless noted):
`CONFIG_DIR_NAME`, `APP_NAME`, `USER_AGENT`; plus `CONFIG_DIR_NAME` adopted at the
remaining hardcoded call sites — `secrets/index.ts`, `ratchet/ratchet.ts`,
`discovery/omp-extension-roots.ts`, `advisor/watchdog.ts`,
`tools/browser/storage-state.ts` — so a future rename is a one-line change.

Mechanical sweep: **330 files** rewritten, `.omp` → `.mop` as a path segment only. The
regex deliberately excluded `my.omp.sh`, `.omp-plugin`, `omp://`, and property names like
`globals.ompPersisted`.

Also rebranded: `mop-protocol.ts` / `mop-scope.ts` (the `omp://` handler and its
scope), the `mop.md` internal-URL prompt, the shell-completion generator (helper
functions are now derived from the binary name instead of hardcoded `_omp_*`),
`build-service.ts` (product id `mop`), `update-cli.ts` (brew tap, mise tool, npm
package), the license header, and both installers.

### Phase 3 — The agent surface

**`packages/coding-agent/src/prompts/system/mop-system-prompt.md`** (218 lines) — the
main agent skeleton. It keeps omp's Handlebars structure *exactly* (verified: the set
of `{{expr}}` and `{{#block}}` uses is identical to omp's template minus
`toolRefs.lsp` and `toolRefs.think`) and swaps the domain sections:

- `§ Role` — "You are mop, a character-card authoring assistant…"
- `# Craft` — five principles, including *the lore is the source; the card is the render*
  and *propose; never silently create*.
- `§ Workflow` — Scope → Ground → Draft → Check → Deliver.

What was dropped from omp's prompt: the LSP/AST/browser/desktop policy blocks, the
`§ Engineering` six-month-maintainability section, the mermaid/svg/chart rendering
guidance, and the code-specific verification bullets. What was kept: the skills block,
internal URLs, tool inventory, tool policy, delegation gates, and the delivery contract.

**`packages/coding-agent/src/prompts/agents/reader.md`** (54 lines) — the read-only
agent. Modelled on omp's `scout.md`: `tools: read, find, grep, glob`, `model: "@smol"`,
structured output (`summary` / `findings` / `sources` / optional `report`), and a
`<critical>` block stating it never writes or runs state-changing commands. Its
distinguishing instruction: **it reports what the material contains and never assesses
quality** — the rubric is the main agent's job.

Both are registered in `src/task/agents.ts` (`EMBEDDED_AGENT_DEFS`).

### Phase 4 — The skill corpus

**13 skills, 32 files** in `packages/coding-agent/skills/`. Each `SKILL.md` follows the
same shape: frontmatter (`name` = directory name, `description` = the routing trigger),
then *When this applies* / *Workflow* / *Reference files* / *Sibling skills*.

| Skill | Covers |
|---|---|
| `card-anatomy` | the four boxes, what is permanent, the card file format |
| `card-authoring` | box-by-box workflow; the opening message and its hook |
| `card-rewrite` | deslop, tighten, the iteration loop |
| `anti-slop` | the quality bar; the anatomy of a bad card; banned patterns |
| `macro-rules` | the known macro set, the forms that break, the collapse bug |
| `token-economics` | budget bands; offload vs cut |
| `lorebook` | World Info JSON: hub, entries, cascade, sizing |
| `lore-library` | the durable store: layout, search, save protocol |
| `worldbuilding` | a world as a system |
| `voice-profile` | building a reusable profile from samples |
| `review` | four lenses: prose, lore, macros, structure |
| `forensics` | entropy, fingerprint, ghost content, bias |
| `section-drafts` | several genuinely different takes on one section |

**18 Markdown reference files + 1 JSON** (19 files under `references/`). The JSON is
jclaw's real worked example — `lorebook-example.json`, 9 entries, 1 constant hub, 25
keys per entry, copied verbatim from jclaw (the "Aefract" lorebook). The Markdown
references carry the *precise* values where we had them from jclaw's source:

- `budget-bands.md` — the exact bands (permanent: `sweet_spot` 2,000–3,000,
  `lorepacked_range` 3,000–6,000, `approaching_bloat` 6,000–7,000, `bloated` 7,000+;
  hub ≤300 aim / 1,000 ceiling; entry ≤300 soft / 400 hard).
- `macro-reference.md` — the known set (`user, char, sub, obj, poss, ref`), the three
  failure types (`spaced_macro`, `unknown_macro`, `user_collapse`).
- `banned-phrases.md` — jclaw's actual descriptor / reaction / staging / purple-prose /
  hedging / cliché lists.
- `slop-scoring.md` — the actual weights (entropy: 0.25 vocab + 0.25 variance + 0.30
  repetition + 0.20 word-entropy, with the U-shaped entropy term; fingerprint:
  0.4 em-dash + 0.4 function-word + 0.2 word-length; ghost: 25/20/15/8).
- `four-box-model.md` — the boxes, the required set, the permanent budget, the
  visibility line.

**What the references are *not* yet:** the full prose from jclaw's `peak.txt` (180 LOC)
and the 13 lens prompts. The current files are a faithful, condensed first pass — the
*facts* are right, the *voice* is not jclaw's. That port is milestone 2.

### Phase 5 — Skill delivery

Three delivery shapes, one code path, in `packages/coding-agent/src/skills/`:

- `skills-index.ts` — the corpus codec. Two-line embed (JSON filename list + base64
  gzip blob of bodies), mirroring omp's `docs-index.ts`. Resolution order: build-time
  embed (`PI_SKILLS_EMBED`) → on-disk `skills/` directory → shipped
  `dist/skills-index.generated.txt`. The directory wins over the shipped embed so a
  source checkout always serves the files you are editing.
- `bundled.ts` — the capability provider (`mop-bundled`, priority **110**, above the
  native provider's 100 so mop's domain skills keep the canonical names). It
  **materializes** the corpus to `~/.mop/skills/` — reference files must exist as real
  paths for `skill://` resolution and the `read` tool — then scans it with
  `scanSkillsFromDir`. Materialization is idempotent: identical files are skipped, and
  files the corpus dropped are pruned, so an upgrade never serves a stale reference.
- `generate-skills-index.ts` — the build-time generator.

Wiring: `compile-binary.ts` injects `PI_SKILLS_EMBED`; `bundle-dist.ts` writes
`dist/skills-index.generated.txt`; `package.json` ships `skills/` in the npm `files`
list. The provider is registered by `discovery/index.ts`.

**Verified working in the compiled binary:**

```
$ mop skills list
anti-slop  The quality bar for a character card — …
card-anatomy  The shape of a JanitorAI character card — …
…
$ mop read "skill://card-anatomy/references/four-box-model.md"
[Skill file: /Users/westin/.mop/skills/card-anatomy/references/four-box-model.md]
# The four-box model
…
```

And end to end with a real model, the agent reads the router, then loads the reference
file on demand:

```
$ mop -p "Before answering, read the skill that covers the character-card structure…"
A JanitorAI card has four boxes:
1. Scenario — the opening situation; permanent.
2. Personality — the character's identity and traits; permanent.
3. Opening Messages — 1–10 alternate openings; only the selected message loads per chat.
4. Example Dialogue — voice demonstrations; optional and non-permanent.
```

(The "Description is another name for Personality, not a fifth box" detail appears only
in `four-box-model.md`, not in the router — proof the reference file was actually read.)

### Phase 6 — Installers

`scripts/install.sh` and `scripts/install.ps1` now resolve releases from **GitHub
releases** instead of omp's build service. Two overridable bases:
`PI_RELEASES_URL` (assets) and `PI_RELEASES_API_URL` (metadata). Assets are named
`mop-<version>-<target>` with a `.sha256` sidecar; the download is verified before it
replaces the installed binary, and the freshly installed binary is smoke-tested
(`--version`) before success is reported. `scripts/install.test.ts` was rewritten
against a fake releases host and passes.

### Phase 7 — Verification

The rebrand broke a lot of upstream tests, because upstream hardcodes `.omp` in test
fixtures. This was the longest phase.

- **208 failures** on the first full run.
- Introduced `skills.excludeProviders` (a real setting) so the bundled corpus can be
  switched off — and so the upstream tests that assert exhaustive skill lists can
  exclude it.
- Swept 330 files for the path-segment rename.
- Added `excludeProviders` to `LoadSkillsOptions` (a gap-fill: the capability layer
  already supported provider exclusion; `loadSkills` did not expose it).
- Updated the four upstream system-prompt assertions to mop's contract.
- Parameterized the shell-completion generator's helper names by binary name.
- **11 failures** remain, and **all 11 are not ours**: 8 confirmed pre-existing by
  stashing the changes and re-running (`status-line-context-cache` ×3,
  `model-registry-default-config` ×1, `move-completion` ×1, `bash-interceptor` ×3), and
  3 browser/puppeteer tests that need Chrome, which this machine does not have.

Final: **7 of 205 chunks failed.** Lint (`oxlint`) clean, format (`oxfmt`) clean, types
(`tsgo`) clean across all 16 packages. New test file
`packages/coding-agent/test/bundled-skills.test.ts` (4 tests) covers discovery,
`skill://` reference resolution, materialization + pruning, and the codec round-trip.

### Phase 8 — Shipping

The push was a three-layer failure, each layer masking the next:

1. **Blobless partial clone** — the local repo had no blobs, so the push tried to
   lazy-fetch them mid-transfer (`could not fetch … from promisor remote`). Fixed with
   one bulk `git fetch --refetch upstream` (5m14s, after temporarily unsetting
   `remote.upstream.partialclonefilter` and `remote.upstream.promisor`).
2. **`HTTP 408` on a 592 MiB upload** — GitHub's push endpoint timing out. Fixed by
   chunking into 17 staged pushes to a temp `_sync` ref, each uploading only the delta
   since the last. Every chunk landed.
3. **The actual root cause, hiding behind #2:**
   ```
   refusing to allow an OAuth App to create or update workflow
   `.github/workflows/ci.yml` without `workflow` scope
   ```
   The `piyoyo2` token had `gist, read:org, repo` — `gh auth login` does not request
   `workflow` by default, and omp's history contains a workflow file from its first
   commit, so *every* push was rejected. The 408 was the rejection surfacing as a
   dropped connection. Fixed with `gh auth refresh -h github.com -s workflow`.

Afterwards: `_sync` had become the repo's default branch, so it had to be deleted via
the API (`PATCH /repos/piyoyo2/mop -f default_branch=main`) before it could be removed.

**Verified with a fresh clone:** HEAD at `55e910f1bf`, 32,868 commits, author
`piyoyo2 <Eousbelle@gmail.com>`, `packages/coding-agent/skills/` present in the tree.

### Phase 9 — Local setup (so mop is usable on this machine)

mop reads `~/.mop/`, not `~/.omp/`, so omp's providers had to be copied across:

```sh
cp ~/.omp/agent/models.yml ~/.mop/agent/models.yml
cp ~/.omp/agent/config.yml  ~/.mop/agent/config.yml   # then trimmed to modelRoles
mkdir -p ~/.mop/agent/lore/{worlds,voices,ideas}
cp packages/coding-agent/dist/mop ~/.local/bin/mop
```

`~/.mop/agent/models.yml` holds four custom providers (`local`, `bailucode`, `atria`,
`vyce`); `modelRoles.default` is `vyce/gpt-6-luna`. **This copy is manual and
first-run-hostile** — see "Next steps".

### Phase 10 — Milestone 2: the analyzer tools, and `AGENTS.md`

`AGENTS.md` was rewritten for mop: the domain, the skill system, the rebrand surface, the
upstream-merge policy, and the analyzer-tool conventions. Upstream's engineering rules
(Bun over Node, the logger, TUI sanitization, the KDL policy tree, the testing filter)
were kept — the internals are still omp's code.

Seven analyzer tools were ported from jclaw and registered as built-ins:
`card_budget`, `card_macro_check`, `tokenize`, `text_entropy`, `text_fingerprint`,
`ghost_phrase_scan`, `library_search`. They live in `packages/coding-agent/src/tools/card/`,
share their constants in `domain.ts` (the executable form of the skill reference files'
numbers), and are covered by 55 contract tests in `test/card-tools.test.ts`. All seven
were exercised end to end through the compiled binary.

The skills that use them now name them ("run `card_budget`", not "run the budget
check"), and each tool got a root doc under `docs/tools/` — the builtin-tool docs
coverage test requires one.

Details and the decisions that differ from jclaw are in §5, "Milestone 2".

**Verification:** `bun scripts/ci-test-ts.ts coding-agent-heavy` — 199 of 205 chunks passed.
All 6 failures are the ones milestone 1 already documented as pre-existing
(`status-line-context-cache`, `model-registry-default-config`, `move-completion`,
`bash-interceptor`) plus two browser tests that need Chrome, which this machine does not
have. The browser chunk is flaky under load — a second run showed 32 failures, all browser
timeouts. No new failures. `packages/utils` was 14 red before milestone 2 (stale
rebrand fixtures) and is green now. Lint, format, and types are clean across all packages.

---

## 3. Architecture reference

### File map (mop's own code)

```
packages/coding-agent/
  skills/                              13 skills, 32 files — the domain
  src/skills/
    skills-index.ts                    corpus codec (embed / disk / shipped)
    bundled.ts                         capability provider + materialization
  src/tools/card/                      the analyzer tools
    domain.ts                          shared constants — the executable form of
                                        the skill reference files' numbers
    tokenizer.ts                       native offline BPE counter
    card-budget.ts  card-macro-check.ts  tokenize.ts
    text-entropy.ts  text-fingerprint.ts  ghost-phrase-scan.ts
    library-search.ts  match-util.ts
  src/prompts/
    system/mop-system-prompt.md        the main agent skeleton
    agents/reader.md                   the read-only agent
    tools/card-*.md  tools/tokenize.md tool descriptions
  scripts/generate-skills-index.ts     build-time corpus generator
  test/bundled-skills.test.ts          4 contract tests
  test/card-tools.test.ts              55 contract tests
docs/tools/card_budget.md ...          one root doc per builtin tool
AGENTS.md                              mop's own development rules
```

### How a skill reaches the model

1. **Discovery** — `builtin.ts` registers the native provider (`.mop/skills/`,
   `~/.mop/agent/skills/`); `bundled.ts` registers `mop-bundled` (priority 110) and
   materializes the corpus to `~/.mop/skills/` first.
2. **Admission** — `extensibility/skills.ts` filters by the `skills.*` settings
   (`enabled`, `enablePiUser`, `includeSkills`, `ignoredSkills`, `excludeProviders`),
   then `resolveCollision` handles same-name skills: identical body+frontmatter
   collapses silently; a differing one is namespaced `<namespace>/<name>`.
3. **Listing** — the system prompt's `<skills>` block renders `name: description` for
   each. The description *is* the routing trigger.
4. **Loading** — the agent issues `read skill://<name>` for the router, then
   `read skill://<name>/references/<file>` for a reference. `skill-protocol.ts` resolves
   the path against `skill.baseDir` and contains it within the skill root.
5. **Reference files are real files** — this is why materialization exists.

### The domain model (what a card *is*)

A JanitorAI card has exactly four platform-fixed boxes:

| Box | Required | Permanent | Holds |
|---|---|---|---|
| Scenario | no | **yes** | the situation the card opens in |
| Personality | **yes** | **yes** | who the character is |
| Opening Messages | **yes** (1–10) | no | alternate openings; exactly one loads per chat |
| Example Dialogue | no | no | voice demonstration |

- "Description" is a synonym for Personality, not a fifth box. `Name` is a field, not a box.
- **Permanent budget = Scenario + Personality only.** They are in context every turn.
- The visibility line: *the backend boxes are index data; the Opening Message is full prose.*
- A lorebook is SillyTavern/Chub "World Info" JSON: an array of entries, one
  `constant: true` hub plus conditional entries, each with `key` / `keysRaw` /
  `keywordsRaw` set identically and `matchWholeWords: true`.
- Macros: `{{user}}`, `{{char}}`, `{{sub}}`, `{{obj}}`, `{{poss}}`, `{{ref}}` — and
  nothing else resolves.

### The lore library

```
~/.mop/agent/lore/
├── <topic>.md      topic notes
├── worlds/         authored worlds
├── voices/         voice profiles
└── ideas/          saved concepts
```

kebab-case, descriptive, no dates or version numbers. The `lore-library` skill
specifies the search-then-confirm protocol: search with the user's own words, **confirm
the match with the user before reading or using a candidate**, and report a miss rather
than guessing around it. The `library_search` tool makes that protocol executable: it
returns **candidates**, never a resolved file, and it matches file names before content.

### The analyzer tools

The skills describe checks in prose; the tools make them enforceable.

| Tool | Checks | Spec |
|---|---|---|
| `card_budget` | the token bands for the permanent pair, a lorebook hub, a lorebook entry | `budget-bands.md` |
| `card_macro_check` | spaced, unknown, and collapsed macros | `macro-reference.md` |
| `tokenize` | the exact token count | — |
| `text_entropy` | the entropy lens | `slop-scoring.md` |
| `text_fingerprint` | the fingerprint lens | `slop-scoring.md` |
| `ghost_phrase_scan` | the ghost-content lens | `slop-scoring.md` |
| `library_search` | the lore library | `library-layout.md` |

`domain.ts` holds the numbers, and cites the reference file each one comes from. When
the two disagree, the reference file is the spec and `domain.ts` is the bug.

---

## 4. What is not done

| # | Item | State |
|---|---|---|
| 1 | **Full reference-file content** | First pass only. The *facts* are right; jclaw's `peak.txt` prose (180 LOC) and the 13 lens prompts have not been ported. |
| 2 | **Agent roster trim** | The "2 agents" design is not enforced. `reader` ships alongside omp's inherited `scout`, `reviewer`, `security-reviewer`, `seance`, `task`, `sonic`. |
| 3 | **SDK package rename** | `sdk/{python,go,rust}/omp-rpc` still publish as `omp-rpc` — they would collide with upstream on PyPI/crates.io. |
| 4 | **Release pipeline** | No GitHub releases exist, so `curl \| sh` cannot work yet. The installer is correct but has nothing to fetch. `mop update` still points at a build service product named `mop` that does not exist. |
| 5 | **First-run provider migration** | mop starts with an empty `~/.mop/agent/models.yml`. The user has to copy omp's by hand (Phase 9). A `mop config migrate` that detects `~/.omp/agent/` and offers to import would remove a real papercut. |
| 6 | **Local provider** | `~/.mop/agent/models.yml` lists a `local` provider at `http://localhost:20128/v1`, which was not running during this session. Untested. |

`AGENTS.md` was rewritten for mop (no longer upstream's), and the analyzer tools landed
(Milestone 2). Both are done and no longer listed here.

---

## 5. What to do next

### Milestone 2 — the analyzer tools — **DONE**

Seven tools, ported from jclaw and verified in the compiled binary.

| Tool | What it does | Spec it implements |
|---|---|---|
| `card_budget` | bands the permanent pair, a lorebook hub, and a lorebook entry against the token bands | `skills/token-economics/references/budget-bands.md` |
| `card_macro_check` | finds spaced, unknown, and collapsed macros | `skills/macro-rules/references/macro-reference.md` |
| `tokenize` | exact token count | — |
| `text_entropy` | the entropy lens | `skills/forensics/references/slop-scoring.md` |
| `text_fingerprint` | the fingerprint lens | `skills/forensics/references/slop-scoring.md` |
| `ghost_phrase_scan` | the ghost-content lens | `skills/forensics/references/slop-scoring.md` |
| `library_search` | searches `~/.mop/agent/lore/` and returns **candidates**, never a resolved file | `skills/lore-library/references/library-layout.md` |

**Where they live:** `packages/coding-agent/src/tools/card/` — `domain.ts` (the shared
constants, the executable form of the reference files' numbers), `tokenizer.ts`, and one
file per tool. Descriptions are in `src/prompts/tools/`; root docs in `docs/tools/`.

**Decisions that differ from jclaw:**

- **The tokenizer is the native one.** jclaw used `gpt-tokenizer`; omp already ships the
  same OpenAI BPE tables as a Rust addon (`@oh-my-pi/pi-natives`, the `utok` port) — the one
  `mop toks` reports. Counts are identical (verified against `gpt-tokenizer` on CJK, emoji,
  and ASCII samples), the call is synchronous, and the compiled binary is 14 MB smaller
  without a JavaScript rank table in it. Do not add a JS tokenizer.
- **The macro set is the double-brace one only.** jclaw also accepted single-brace `{user}`
  as "a documented valid style"; mop's `macro-reference.md` says single braces are a
  different template syntax. The tool follows the reference file.
- **The macro check reports a spaced *and* an unknown finding for `{{my name}}`** — the
  name is not a macro at all, and the spacing is a second, independent defect. jclaw's
  regexes missed that span entirely.
- **An empty text scores 0 on every lens.** jclaw's score functions fed zeroed metrics into
  the sub-risk terms and returned 70/100 for an empty field.
- **The lore root is `~/.mop/agent/lore`** via a new `getLoreDir()` in
  `packages/utils/src/dirs.ts`.

**Tooling notes that cost time:**

- `omptype` forbids `?` plus `.default()`, and a defaulted key is *required* in the
  schema's inferred type. Declare a defaulted field optional (`"encoding?"`) and default it
  in code.
- A tool description containing a literal `{{user}}` must **not** go through
  `prompt.render` — the template engine swallows it. Static descriptions are used raw
  (`readonly description = someDescription`), the way `context-notes.ts` does it.
- Every builtin tool needs a root doc at `docs/tools/<name>.md`; the coverage test fails
  without it.
- The `mop` binary needs the native addon built (`bun run build:native`, needs ninja).

**Verified:** 55 contract tests in `packages/coding-agent/test/card-tools.test.ts`, and
all seven tools exercised end to end through the compiled binary (`mop -p`).

### Milestone 3 — the rest, in order

1. **Port the reference prose** from jclaw's `peak.txt` (180 LOC), `build.txt` (47),
   `review.txt` (53) and the 13 lens prompts into the existing reference files. The
   files already carry the right facts; this adds jclaw's voice and detail. Keep the
   router→reference split.
2. **Trim the agent roster.** Remove `scout`, `reviewer`, `security-reviewer`,
   `seance`, `sonic` from `EMBEDDED_AGENT_DEFS`. `task` stays (it is the `task` tool's
   default spawn agent). `seance` is the hard one — the `/seance` command,
   `seance-policy.ts`, and `structured-subagent.ts` all assume it exists; removing it
   means removing that machinery too. The prompt's `scoutAvailable` flag and
   `isScoutSpawnable` should become `readerAvailable` /
   `isReadOnlyAgentSpawnable("reader", …)`, and the tool-description templates
   (`glob.md`, `grep.md`, `ast-grep.md`, `task.md`,
   `task-specialization-advisory.md`) and `plan-mode-active.md` /
   `workflow-notice.md` lose their "scout" wording.
3. **First-run provider migration.** Detect `~/.omp/agent/models.yml` and offer to
   import it into `~/.mop/agent/`. This is a small, high-value UX fix.
4. **Release pipeline.** A GitHub Actions workflow that builds the binary for
   linux/macOS × x64/arm64 and publishes `mop-<version>-<target>` assets plus
   `.sha256` sidecars, matching what the installer expects. Then `mop update` can move
   off the build-service client.
5. **Rename the SDK packages** to `mop-rpc` (python, go, rust) so a published mop does
   not collide with upstream.

---

## 6. Tribal knowledge

Things that are not obvious from the code and cost time to rediscover.

**About the fork**

- The internal npm scope is still `@oh-my-pi/*` **on purpose**. Renaming it touched
  4,788 files for no user-visible gain. Do not rename it casually.
- `upstream` is `can1357/oh-my-pi`; `origin` is `piyoyo2/mop`. Merges upstream with
  `git merge upstream/main`.
- omp is an *active* repo — `upstream/main` had already moved 80 commits past our
  fork point when this handoff was written. `main` is `ahead 1, behind 80`.
- The `.omp` → `.mop` rename touched ~330 upstream test files. Those are the first
  thing that will conflict on an upstream merge. Expect it.

**About the skill system**

- Skill discovery is **non-recursive**: exactly one level under `skills/`. Nested
  taxonomies need `skills.customDirectories` pointed at the nested parent.
- The `description` frontmatter is the routing trigger, and it is **mandatory** for the
  native provider. A skill without one is silently skipped.
- `skill://<name>/<path>` resolves against `skill.baseDir`, which is derived from
  `skill.path` by stripping `/SKILL.md`. **Reference files must exist as real paths on
  disk** — which is the entire reason the corpus is materialized rather than served
  from memory.
- Skill names may not contain `/` — that namespace is reserved for collision
  resolution (`<namespace>/<name>`).
- `skills.excludeProviders` is mop's addition. It exists because the bundled corpus
  would otherwise appear in every test that asserts an exhaustive skill list.

**About the environment**

- `gh auth login` does **not** request the `workflow` scope. Any repo whose history
  contains `.github/workflows/*` will be rejected on push without it. Use
  `gh auth refresh -h github.com -s workflow`.
- Pushing 32k commits / 592 MiB to an empty GitHub repo needs chunking; the endpoint
  times out on a single large POST.
- The native Rust addon needs **ninja** (`brew install ninja`) — the `opus` voice crate
  builds via cmake and picks the Ninja generator. `bun run build:native` otherwise
  fails deep in the build with "CMake was unable to find a build program".
- This machine has no Chrome, so the browser/puppeteer tests cannot run here.
- `bun test` from the repo root is refused by the test runner; run it from
  `packages/coding-agent`.
- The token counters are the **native** ones (`@oh-my-pi/pi-natives`, the `utok` port).
  `mop toks` prints a table across every embedded encoding, and the same native
  `countTokens` backs the `tokenize` and `card_budget` tools. A JavaScript BPE
  tokenizer is a duplicate of something the repo already ships — do not add one.
- `bun install` re-resolves the whole tree when a **catalog** entry changes, and then
  fails on `@oh-my-pi/pi-coding-agent@18.12.3` ("published within minimum release age")
  because that version is newer than the repo's 3-day `minimumReleaseAge` policy. Edit
  `bun.lock` by hand for catalog churn instead of re-resolving.
- The `mop` binary needs the native addon built before it will run: `bun run build:native`
  (needs ninja), then `bun --cwd=packages/coding-agent run build`.
- **`packages/utils` had 14 stale test failures** left by the rebrand: the fixtures still
  expected the app to be named `omp` (log file names, XDG app dirs, profile roots) after
  the code had moved to `mop`. Fixed in milestone 2 — the package is green again. When the
  rebrand's sweep is redone upstream, expect the same class of drift elsewhere.

**About the domain**

- The card model is fixed by the platform: four boxes, no fifth. "Description" is
  Personality. `Name` is a field.
- Only Scenario and Personality are permanent. Everything else that a card needs can
  be offloaded into a lorebook entry behind a keyword.
- `{{char1}}` / `{{char2}}` do **not** resolve on the platform. They are not a way to
  address a second character.
- A lorebook entry's `key`, `keysRaw`, and `keywordsRaw` must be identical — they are
  three spellings of one trigger, and importers disagree if they are not.
- The lore library is the user's. Never delete from it, never overwrite without being
  asked, never save something they did not ask to save.

---

## 7. Cheatsheet

```sh
# build
bun install
bun run build:native                              # Rust addon (needs ninja)
bun --cwd=packages/coding-agent run build         # → packages/coding-agent/dist/mop
bun run dev                                       # run from source

# verify
bun run check                                     # lint + format + types + rust
bun --cwd=packages/coding-agent run test          # the test suite
cd packages/coding-agent && bun test test/bundled-skills.test.ts
cd packages/coding-agent && bun test test/card-tools.test.ts

# use
mop                                                 # TUI
mop -p "prompt"                                    # print mode
mop skills list                                    # what is available
mop read "skill://card-anatomy/references/four-box-model.md"
mop models                                         # providers and models

# ship
git fetch --refetch upstream                       # if the partial clone lost blobs
git merge upstream/main
git push origin main
```

**Where things are**

| | |
|---|---|
| Domain | `packages/coding-agent/skills/` |
| Main agent prompt | `packages/coding-agent/src/prompts/system/mop-system-prompt.md` |
| Read-only agent | `packages/coding-agent/src/prompts/agents/reader.md` |
| Skill delivery | `packages/coding-agent/src/skills/` |
| Analyzer tools | `packages/coding-agent/src/tools/card/` |
| Tool descriptions | `packages/coding-agent/src/prompts/tools/*.md` |
| Tool root docs | `docs/tools/<name>.md` |
| Development rules | `AGENTS.md` |
| Config | `~/.mop/agent/` (skills materialize to `~/.mop/skills/`) |
| Lore library | `~/.mop/agent/lore/` |
| jclaw (the predecessor) | `/Users/westin/Desktop/jclaw` |
