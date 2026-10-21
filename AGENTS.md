# Development Rules

## Default Context

**mop** is a character-card authoring agent: it builds and revises JanitorAI-style
character cards, their lorebooks, and the worldbuilding they rest on. It is a fork of
[oh-my-pi](https://github.com/can1357/oh-my-pi) (`upstream`), rebranded and re-domained.

This repo contains multiple packages, but **`packages/coding-agent/`** is the primary focus.
Unless otherwise specified, assume work refers to this package.

**Terminology**: When the user says "agent" or asks "why is agent doing X", they mean the
**coding-agent package implementation**, not you (the assistant). The coding-agent is a CLI
tool — questions about its behavior refer to code in `packages/coding-agent/`, not to your
current session.

### Package Structure

| Package                 | Description                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `packages/ai`           | Multi-provider LLM client with streaming support                                        |
| `packages/catalog`      | Model catalog: bundled models.json, provider descriptors, model identity/classification |
| `packages/agent`        | Agent runtime with tool calling and state management                                    |
| `packages/coding-agent` | Main CLI application (primary focus)                                                    |
| `packages/tui`          | Terminal UI library with differential rendering                                         |
| `packages/natives`      | Bindings for native text/image/grep operations                                          |
| `packages/stats`        | Local observability dashboard (`mop stats`)                                              |
| `packages/omptype`      | ArkType-compatible schema validation with a lazy JIT runtime                            |
| `packages/utils`        | Shared utilities (logger, streams, temp files)                                          |
| `crates/pi-natives`     | Rust crate for performance-critical text/grep ops                                       |

**Catalog import convention**: code in this repo imports catalog _values_ (bundled models,
model-thinking helpers, identity, descriptors, model manager/cache) from
`@oh-my-pi/pi-catalog/<module>` — never via `@oh-my-pi/pi-ai`. The pi-ai barrel re-exports
only the model/effort _types_ its own signatures use (`Model`, `Api`, `ThinkingConfig`,
`Effort`, …); type-only imports of those from `@oh-my-pi/pi-ai` are fine.

---

## The domain

### The design rule

> **The prompt stays small. The domain lives in skills. The heavy material lives in
> reference files, loaded only when the agent reaches that step.**

mop's domain knowledge is **not** in an agent prompt. It is in `packages/coding-agent/skills/`:
one `SKILL.md` router per skill (the *retrieval trigger* — its `description` is what the
model matches against) plus reference files the router names (the *content*).

**Do not duplicate domain content into code.** If a tool needs a threshold, a macro list, or
a banned-phrase set, the numbers live in the skill's reference file and the tool is the
executable form of that same file. If the two disagree, the reference file is the spec and
the tool is the bug.

### The card model (what a card *is*)

A JanitorAI card has exactly four platform-fixed boxes. This is a platform fact, not a
mop choice — never invent a fifth box or restructure the schema.

| Box | Required | Permanent | Holds |
|---|---|---|---|
| Scenario | no | **yes** | the situation the card opens in |
| Personality | **yes** | **yes** | who the character is |
| Opening Messages | **yes** (1–10) | no | alternate openings; exactly one loads per chat |
| Example Dialogue | no | no | voice demonstration |

- "Description" is a synonym for Personality, not a fifth box. `Name` is a field, not a box.
- **Permanent budget = Scenario + Personality only.** They are in context every turn.
- The visibility line: *the backend boxes are index data; the Opening Message is full prose.*
- Macros: `{{user}}`, `{{char}}`, `{{sub}}`, `{{obj}}`, `{{poss}}`, `{{ref}}` — and nothing
  else resolves. `{{char1}}` / `{{char2}}` do **not** resolve on the platform.
- A lorebook is SillyTavern/Chub "World Info" JSON: an array of entries, one
  `constant: true` hub plus conditional entries. An entry's `key`, `keysRaw`, and
  `keywordsRaw` must be **identical** — they are three spellings of one trigger, and
  importers disagree if they are not.

The authoritative version of all of this, with the exact values, is
`skills/card-anatomy/references/four-box-model.md` and
`skills/macro-rules/references/macro-reference.md`. Read them; do not work from memory.

### The lore library

```
~/.mop/agent/lore/
├── <topic>.md      topic notes
├── worlds/         authored worlds
├── voices/         voice profiles
└── ideas/          saved concepts
```

kebab-case, descriptive, no dates or version numbers. Protocol (from
`skills/lore-library/references/save-protocol.md`): search with the user's own words,
**confirm the match with the user before reading or using a candidate**, and report a miss
rather than guessing around it.

**The lore library is the user's.** Never delete from it, never overwrite without being
asked, never save something they did not ask to save.

---

## Repository map

### mop's own code

```
packages/coding-agent/
  skills/                              13 skills, 32 files — the domain
  src/skills/
    skills-index.ts                    corpus codec (embed / disk / shipped)
    bundled.ts                         capability provider + materialization
  src/tools/card/                      the analyzer tools (see below)
  src/prompts/
    system/mop-system-prompt.md        the main agent skeleton
    agents/reader.md                   the read-only agent
    tools/card-*.md, tools/tokenize.md  tool descriptions
  scripts/generate-skills-index.ts     build-time corpus generator
  test/bundled-skills.test.ts          contract tests for skill delivery
  test/card-tools.test.ts              contract tests for the analyzer tools
docs/tools/card_budget.md             one root doc per builtin tool
```

### The rebrand surface

The **user-facing** surface was renamed. The internals deliberately were not.

| Surface | Before | After |
|---|---|---|
| Binary | `omp` | `mop` |
| Config root | `~/.omp/` | `~/.mop/` |
| Project config | `.omp/` | `.mop/` |
| Internal URL scheme | `omp://` | `mop://` |
| Published package | `@oh-my-pi/pi-coding-agent` | `@mop/pi-coding-agent` |
| Natives package | `@oh-my-pi/pi-natives` | `@mop/pi-natives` |
| Log files | `omp.<date>.<pid>.log` | `mop.<date>.<pid>.log` |

**The `@oh-my-pi/*` npm scope is unchanged on purpose.** Renaming it touched 4,788 files and
created permanent merge friction for zero user-visible benefit. Do not rename it casually.
Same for internal identifiers like the `__omp_worker_*` argv selectors and the
`PI_*` environment variables — they are internal plumbing, not user surface.

### Working with upstream

`upstream` is `can1357/oh-my-pi`; `origin` is `piyoyo2/mop`. Upstream is an **active** repo —
expect it to move.

- Merge with `git merge upstream/main`. Resolve the `.omp` → `.mop` path-segment renames
  in upstream's test fixtures by accepting ours; they are the first thing that conflicts.
- A blobless local clone may need `git fetch --refetch upstream` before a push works.
- `gh auth login` does **not** request the `workflow` scope. Any repo whose history
  contains `.github/workflows/*` is rejected on push without it —
  `gh auth refresh -h github.com -s workflow`.

---

## Skills

The skill corpus is mop's primary deliverable. When you change it, you are changing the
agent's behavior.

### Anatomy of a skill

```
skills/<name>/SKILL.md                 router: frontmatter + when it applies + workflow
skills/<name>/references/<file>.md     heavy material, loaded on demand
```

`SKILL.md` frontmatter is `name` (must equal the directory name) and `description` — the
routing trigger, and **mandatory** for the native provider (a skill without one is silently
skipped). The body follows a fixed shape: *When this applies* → *Workflow* → *Reference
files* → *Sibling skills*.

### Rules for authoring

- The router says **when** the skill applies and **which reference file to read at which
  step**. It does not restate the reference content. If a router paragraph duplicates a
  reference paragraph, the router is wrong.
- Reference files are loaded *at the step that needs them*. Name the step explicitly
  ("MUST read `four-box-model.md` before writing content into any box").
- Discovery is **non-recursive**: exactly one level under `skills/`. A nested taxonomy needs
  `skills.customDirectories` pointed at the nested parent.
- Skill names may not contain `/` — that namespace is reserved for collision resolution
  (`<namespace>/<name>`).
- Keep a skill's material out of the system prompt. `mop-system-prompt.md` is a skeleton:
  role, craft principles, workflow, tool policy. Domain facts belong in skills.
- After changing a skill, name the tools it uses in the router — "run `card_budget`", not
  "run the budget check" — so the agent reaches for a real check.

### Delivery

`src/skills/bundled.ts` registers the `mop-bundled` provider (priority **110**, above the
native provider's 100, so mop's domain skills keep the canonical names). It **materializes**
the corpus to `~/.mop/skills/` — reference files must exist as real paths for `skill://`
resolution and the `read` tool — then scans it with `scanSkillsFromDir`. Materialization is
idempotent: identical files are skipped, and files the corpus dropped are pruned.

Resolution order for the corpus itself: build-time embed (`PI_SKILLS_EMBED`) → the on-disk
`skills/` directory → the shipped `dist/skills-index.generated.txt`. The directory wins over
the shipped embed, so a source checkout always serves the files you are editing.

`skills.excludeProviders` is mop's addition to the settings — it exists so the bundled
corpus can be switched off (and so upstream tests asserting an exhaustive skill list can
exclude it).

---

## Analyzer tools

The skills describe checks in prose; the tools make them **executable**. A skill that says
"check the macro set" must be backed by a tool the agent can actually run, or the claim is
unverifiable.

| Tool | What it checks | Spec |
|---|---|---|
| `card_budget` | token bands for the permanent pair, a lorebook hub, a lorebook entry | `skills/token-economics/references/budget-bands.md` |
| `card_macro_check` | spaced, unknown, and collapsed macros | `skills/macro-rules/references/macro-reference.md` |
| `tokenize` | exact token count, real BPE | — |
| `text_entropy` | the entropy lens | `skills/forensics/references/slop-scoring.md` |
| `text_fingerprint` | the fingerprint lens | `skills/forensics/references/slop-scoring.md` |
| `ghost_phrase_scan` | the ghost-content lens | `skills/forensics/references/slop-scoring.md` |
| `library_search` | the lore library | `skills/lore-library/references/library-layout.md` |

They live in `src/tools/card/`, share the constants in `src/tools/card/domain.ts`, and count
tokens with the repo's native offline BPE counter (`@oh-my-pi/pi-natives` — the same one
`mop toks` reports) via `src/tools/card/tokenizer.ts`. Do not add a JavaScript tokenizer.

### Conventions

- Tools are classes implementing `AgentTool<TParameters>`
  (`packages/agent/src/types.ts`) with
  `execute(toolCallId, params, signal, onUpdate, context)`. There is no `Tool.Def` object.
- Register the name in `src/tools/builtin-names.ts` (`BUILTIN_TOOL_NAMES`) and the
  implementation in `src/tools/index.ts` (`BUILTIN_TOOLS` factory map). A tool that is not
  in `BUILTIN_TOOL_NAMES` does not exist.
- **Descriptions live in `src/prompts/tools/*.md`** — never inline a description string in
  code. Import with `import description from "./prompt.md" with { type: "text" }`.
  A static description is used as raw text, not rendered — rendering it would swallow the
  literal `{{user}}` in the macro tool's description.
- Use `omptype` for parameter schemas, per the house style. A defaulted field is declared
  optional (`"encoding?"`) and defaulted in code: omptype forbids `?` plus `.default()`,
  and a defaulted key is required in the schema's inferred type.
- Tool output is user-visible: it goes through TUI sanitization
  (`replaceTabs`, `truncateToWidth`, `shortenPath`, `PREVIEW_LIMITS`).
- Never `console.log` from a tool — use the centralized logger.
- **Every builtin tool needs a root doc** at `docs/tools/<name>.md` (underscores or hyphens
  both pass the coverage test), served over `mop://`.

### Rules

- **Thresholds come from the skill reference files.** The budget bands live in
  `skills/token-economics/references/budget-bands.md`; the macro set in
  `skills/macro-rules/references/macro-reference.md`; the banned lists in
  `skills/anti-slop/references/banned-phrases.md`; the scoring weights in
  `skills/forensics/references/slop-scoring.md`. `src/tools/card/domain.ts` is the
  executable form of those numbers and cites each one — when the two disagree, the
  reference file is the spec and `domain.ts` is the bug.
- A check tool **reports**; it does not rewrite. The agent decides, the user approves.
- `library_search` is the exception that changes behavior: it returns **candidates**, never
  resolves a file for the agent. The "search, then confirm the match" protocol only works
  if the tool refuses to guess.

---

## GitHub

- Before posting a GitHub comment or creating an issue, MUST show the target and proposed
  text and obtain user confirmation. An explicit instruction to post supplied text to a
  specified target already counts as confirmation.
- A request to address or fix PR feedback permits drafting replies, not posting them without
  confirmation. A request only to get or check comments is read-only.
- When authorized to resolve review feedback, MUST verify the fix, obtain approval for a
  factual reply citing the change and verification, and post it in the existing thread
  before resolving. NEVER resolve if the reply is unapproved or posting fails.
- Permission to work on a PR does not authorize unrelated comments or issue creation.

### Pull requests

When authorized to create or edit a contributor-submitted PR, follow the checklist below.

- MUST read `CONTRIBUTING.md` and `.github/PULL_REQUEST_TEMPLATE.md` first. Preserve the
  template sections and checklist, including when shortening an existing description.
- MUST obtain at least one sentence written by the contributor in their own words explaining
  what changed and why, as required by `CONTRIBUTING.md`. If it is missing, ask the
  contributor; NEVER generate a substitute. Preserve that sentence during edits.
- For user-facing changes, MUST follow the [Changelog](#changelog) attribution rules.
  Internal issue fixes keep their issue links. For external contributions, add the PR link
  and contributor credit after GitHub assigns the number, then push the entry before marking
  the changelog checklist item complete.
- MUST read back the published PR description after creating or editing it. Check only
  verified checklist items; explain skipped or inapplicable checks in `Testing`.

---

## Code Quality

- No `any` unless absolutely necessary.
- **NEVER use `ReturnType<>`** — use the actual type name.
- **NEVER use inline imports** — no `await import()`, no `import("pkg").Type` in type
  positions, no dynamic type imports. Always top-level.
  - The one exception is **lazy-loading a heavy optional module at the point of use** —
    `await import("puppeteer-core")`, `await import("@oh-my-pi/pi-utils/dom")` — so a
    session that never touches it never pays for it. Never for types, and never to dodge a
    static import of a light module.
- Check `node_modules` for external API types instead of guessing.
- **Barrel exports**: prefer `export * from "./module"` over named re-exports, including
  `export type { ... } from`. In pure `index.ts` barrels, use star re-exports even for
  single-specifier cases. If stars create ambiguity, remove the redundant export path; do
  not keep duplicates.
- **Class privacy**: use ES `#private` fields; leave externally accessible members bare.
  **No `private`/`protected`/`public` keyword on fields or methods**, except on
  **constructor parameter properties** where TypeScript requires it (e.g.
  `constructor(private readonly session: ToolSession)`).
- **Promises**: use `Promise.withResolvers()` instead of
  `new Promise((resolve, reject) => ...)`.
- **Prompts**: never build prompts in code (no inline strings, template literals, or
  concatenation). Prompts live in static `.md` files; use Handlebars for dynamic content.
  Import them via `import content from "./prompt.md" with { type: "text" }` — not `readFile`.
- **Judge questions**: one JSON file per feature (`src/prompts/judge/<feature>.json`) maps
  question ids to `{ instructions, criteria? }`. Load it with `judgeQuestions(file)` from
  `@oh-my-pi/pi-ai`; fill Handlebars instructions with `renderQuestion(question, context)`.
  `criteria` sets the kind: a list of levels → score, omitted or `true`/`false` keys only →
  yes/no, any other labels → choice (`{}` when the caller supplies the labels). Choice labels
  and answer types come from the JSON keys.
- **Worker scripts**: workers re-enter the CLI entrypoint; never spawn separate worker entry
  modules. `cli.ts` declares itself as the worker host at startup (`declareWorkerHostEntry()`
  from `@oh-my-pi/pi-utils/env`) and dispatches hidden argv selectors
  (`__omp_worker_stats_sync`, `__omp_worker_tab`, `__omp_worker_js_eval`,
  `__omp_worker_tiny_inference`) before loading the command registry. Spawn sites use:
  ```ts
  import { workerHostEntry } from "@oh-my-pi/pi-utils";
  const hostEntry = workerHostEntry();
  const worker = hostEntry
  	? new Worker(hostEntry, { type: "module", argv: ["__omp_worker_<name>"] })
  	: new Worker(new URL("./<worker>.ts", import.meta.url).href, { type: "module" });
  ```
  When the process was started from the mop CLI — source `cli.ts`, npm-bundle `dist/cli.js`,
  or compiled binary — `workerHostEntry()` is `Bun.main` and the worker re-enters the single
  entry module, so no per-worker `--compile` entrypoints or bundle entries exist. Outside a
  CLI host (`bun test`, SDK embedding, standalone `mop-stats`) it returns `null` and the
  direct-module fallback loads the worker source. New worker kinds MUST add their selector to
  the dispatch table in `cli.ts` and keep the fallback branch.
  History: `with { type: "file" }` only copied the entry as a raw asset (workers crashed
  silently in compiled binaries — issues #1011, #1027), and the later literal-path +
  extra-entrypoint pattern required keeping spawn literals and two build scripts in sync
  (issue #1150). The smoke probe below is the live validation of this contract.
  Validate any new worker with the dedicated smoke probe: `mop --smoke-test` spawns the
  stats sync worker and the tiny-model subprocess, pings them, and exits — it's wired into
  `ci:test:smoke` and `scripts/install-tests/run-ci.sh` so binary, source-link, and tarball
  installs all exercise it. Add a sibling smoke if the new worker is on a different module
  graph.

## Central Utilities

Before writing a helper, check whether one already exists — `packages/coding-agent/src/utils/`,
`@oh-my-pi/pi-utils`, `@oh-my-pi/pi-tui`, and the domain modules next to your callsite. This
applies to **everything**: VCS wrappers, formatting/truncation/path-display helpers, image
handling, clipboard, streams, temp files, caching. The central versions carry hardening a
fresh copy always loses (timeouts, output caps, non-interactive env, lock avoidance, caching,
TUI sanitization).

- Search first: `grep` for the operation before implementing it. Two implementations of the
  same thing is a bug even when both work.
- Examples of the pattern: `@oh-my-pi/pi-natives/vcs` and `src/utils/active-repo-context.ts`
  are the only sanctioned way to run git/jj (`import * as vcs from "@oh-my-pi/pi-natives/vcs"`
  — never hand-spawn via `$`/`Bun.spawn`); rendering goes through the helpers in TUI
  Sanitization below (`replaceTabs`, `truncateToWidth`, `shortenPath`, `PREVIEW_LIMITS`)
  rather than ad-hoc string math.
- Missing capability? Extend the central helper (new option, new sub-function on the
  namespace) and call it — don't fork its logic locally.

## Bun Over Node

Use Bun APIs where they provide a cleaner alternative; fall back to `node:*` only for what Bun
doesn't cover. **Never spawn shell commands for operations with proper APIs** (e.g., don't
`Bun.spawnSync(["mkdir", "-p", dir])` — use `mkdirSync`).

### Quick reference

| Operation       | Use                                       | Not                                |
| --------------- | ----------------------------------------- | ---------------------------------- |
| File read/write | `Bun.file()`, `Bun.write()`               | `readFileSync`, `writeFileSync`    |
| Spawn process   | `` $`cmd` ``, `Bun.spawn()`               | `child_process`                    |
| Sleep           | `Bun.sleep(ms)`                           | `setTimeout` promise               |
| Binary lookup   | `$which("git")` from `@oh-my-pi/pi-utils` | `spawnSync(["which", "git"])`      |
| HTTP server     | `Bun.serve()`                             | `http.createServer()`              |
| SQLite          | `bun:sqlite`                              | `better-sqlite3`                   |
| Hashing         | `Bun.hash()`, `Bun.password.*`, WebCrypto | `node:crypto`                      |
| Path resolution | `import.meta.dir`, `import.meta.path`     | `fileURLToPath` dance              |
| JSON5           | `Bun.JSON5.parse()` / `.stringify()`      | `json5` package                    |
| JSONL           | `Bun.JSONL.parse()` / `.parseChunk()`     | `text.split("\n").map(JSON.parse)` |
| String width    | `Bun.stringWidth()`                       | `get-east-asian-width`, custom     |
| Text wrapping   | `Bun.wrapAnsi()`                          | custom ANSI-aware wrappers         |

### Process execution

Prefer Bun Shell (`` $`cmd` ``) for simple commands:

```typescript
import { $ } from "bun";

const result = await $`git status`.cwd(dir).quiet().nothrow();
if (result.exitCode === 0) {
	const text = result.text();
}

$`do-stuff ${tmpFile}`.quiet().nothrow(); // fire and forget
```

Methods: `.quiet()`, `.nothrow()`, `.text()`, `.cwd(path)`.

Use `Bun.spawn`/`Bun.spawnSync` only for: long-running processes (LSP, kernels), streaming
stdin/stdout/stderr (SSE, JSON-RPC), or process control (signals, kill, complex lifecycle).

When using `pipe` mode, cast the stream:

```typescript
const child = Bun.spawn(["cmd"], { stdout: "pipe", stderr: "pipe" });
const reader = (child.stdout as ReadableStream<Uint8Array>).getReader();
```

### Node module imports

Always use **namespace imports** for `node:fs`, `node:path`, `node:os`:

```typescript
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
```

- Async-only file → `node:fs/promises`.
- Needs both sync and async → `node:fs`, then `fs.promises.xxx` for async.

### File I/O

Prefer Bun:

```typescript
const text = await Bun.file(path).text();
const data = await Bun.file(path).json();
await Bun.write(path, data); // auto-creates parent dirs
```

Use `node:fs/promises` for directory ops (`fs.mkdir`, `fs.rm`, `fs.readdir`) — Bun has no
native directory APIs. Avoid sync APIs in async flows; use sync only when forced by a
synchronous interface.

**Anti-patterns:**

- `existsSync`/`readFileSync`/`writeFileSync` in async code → `Bun.file()` APIs.
- `mkdir(dirname(path), …)` before `Bun.write(path, …)` → redundant; `Bun.write` handles it.
- `if (await file.exists()) { await file.json() }` → two syscalls plus race. Use try-catch
  with `isEnoent`:
  ```typescript
  import { isEnoent } from "@oh-my-pi/pi-utils";
  try {
  	return await Bun.file(path).json();
  } catch (err) {
  	if (isEnoent(err)) return null;
  	throw err;
  }
  ```
- Multiple `Bun.file(path)` handles for the same path (including across `checkX`/`loadX`
  helpers).
- `Buffer.from(await Bun.file(x).arrayBuffer())` → `await fs.readFile(path)`.
- Existence check + try-catch around the same read → drop the existence check.

### Streams

Prefer centralized helpers:

```typescript
import { readStream, readLines } from "./utils/stream";
const text = await readStream(child.stdout);
for await (const line of readLines(stream)) {
	/* ... */
}
```

Manual reader loops only when the protocol requires it (SSE, streaming JSON-RPC).

### Misc

- **Sleep**: `await Bun.sleep(ms)`, never `new Promise(r => setTimeout(r, ms))`.
- **Password hashing**: `Bun.password.hash(pw, "bcrypt")` / `Bun.password.verify(pw, hash)`.
- **String width**: `Bun.stringWidth(text, { countAnsiEscapeCodes?: false })`.
- **Wrapping**: `Bun.wrapAnsi(text, width, { wordWrap, hard, trim })`.

## Model/Provider Policy Lives in KDL

**NEVER hard-code model- or provider-conditional policy in TypeScript.** No
`id.includes("claude")`, no model-name regexes, no per-model lookup tables (effort ladders,
pricing, context windows, modalities, API routing, quirk flags). All of it belongs in the KDL
rule tree at `packages/catalog/src/compat/rules/`, compiled by `bun run gen:compat` into the
committed `rules.json` and resolved at build time via `resolveModelPolicy`/`buildModel`.

Ownership strata (see `src/compat/rules/README.md`):

- `taxonomy/*.kdl` — identity: class membership, families, revision extraction, reviewed
  overrides, suffix collapse.
- `classes/*.kdl` — model-lineage truths (behavior inherent to a model line, on any host).
- `providers/*.kdl` — deployment contracts (behavior a host imposes), plus documented
  exact-id residue.
- `runtime/behavior.kdl` — heuristics that run before/outside exact model lookup
  (`api-routes`, `model-limits`, `exclude-models`, `pricing-peer`, hosted defaults).

Rules for TS code:

- Branching on model identity in TS is allowed **only** through structured facts from
  `classifyModel()` (`class`/`family`/`revision`/effort facts) — never through string
  matching on ids, and prefer a KDL axis when one can express the policy.
- Discovery mappers map authoritative upstream fields as reported; seed neutral values only
  for fields the upstream omits or misreports **and** KDL explicitly owns via a correction
  axis (`input-modalities`, `cost-patch`, `limits-patch`, `context-window-floor`, thinking
  axes). Assert rule-owned corrections through `buildModel`; raw discovery specs remain the
  right assertion surface for parsing/normalization contracts.
- An id that no selector can isolate gets an exact-id `models` residue rule with a comment —
  never a special case in TS.
- Equal-rank rule overlaps throw `AmbiguousOverlapError` at resolve time; fix with an
  explicit `priority=` in KDL, not code.
- After editing rules: `bun run gen:compat` and commit `rules.json` alongside the `.kdl`
  change.

## Generated Files

**NEVER edit `packages/catalog/src/models.json` directly.** It is generated from upstream
sources (stencil.so, provider catalog discovery, OpenCode docs) by
`packages/catalog/scripts/generate-models.ts` and the descriptors/resolvers in
`packages/catalog/src/provider-models/`. Hand-edits get overwritten on the next regen. The
same applies to `packages/catalog/src/compat/rules.json`, compiled from the KDL tree by
`bun run gen:compat`.

To change an entry, fix the source:

- **Model/provider policy** (identity, thinking ladders, wire quirks, modality/limit/pricing
  corrections, API routing, roster exclusions) → the KDL tree in
  `packages/catalog/src/compat/rules/` (see the section above).
- **Provider catalog entries** (default model, discovery factory/flags) → the
  `CATALOG_PROVIDERS` table in `packages/catalog/src/provider-models/descriptors.ts`.
- **Discovery/request plumbing** (endpoint shapes, auth, response parsing) → the mappers in
  `packages/catalog/src/provider-models/openai-compat.ts`.
- **Generator wiring** (upstream merges, premium multipliers, post-processing order) →
  `packages/catalog/scripts/generate-models.ts`.

Regenerate with `bun run gen:compat` and/or `bun run gen:models` and commit the generated
files alongside the source change. Add a regression test against the
**rule/descriptor/mapper**, not the bundled JSON, so it survives upstream metadata shifts.

**`packages/coding-agent/skills/` is NOT generated.** It is source. The build-time generator
(`scripts/generate-skills-index.ts`) only packs it; the packed form is not committed.

## Logging and CLI Output

Code that may run while the TUI, RPC, SDK, workers, or background runtimes are active MUST
NOT use `console.log`/`error`/`warn`; it corrupts rendering or protocols. Use the centralized
logger:

```typescript
import { logger } from "@oh-my-pi/pi-utils";

logger.error("MCP request failed", { url, method });
logger.warn("Theme file invalid, using fallback", { path });
logger.debug("LSP fallback triggered", { reason });
```

Logs go to `~/.mop/logs/mop.YYYY-MM-DD.<pid>.log` with automatic rotation; `bun test`
processes write theirs to a per-user `mop-test-logs-<uid>/` under the OS temp dir instead.
Standalone CLI commands that exit without entering the TUI MAY use `console.*` or process
streams for intentional user-facing output. Keep structured stdout clean. This exception is
semantic, not filename-based; shared code must use `logger` or an explicit output sink.

## TUI Sanitization

All text displayed in tool renderers must be sanitized. Raw content (file contents, error
messages, tool output) breaks terminal rendering: tabs → visual holes, long lines → overflow,
paths → leak home directory.

**Rules:**

- **Tabs → spaces** via `replaceTabs()` (from `@oh-my-pi/pi-tui` or `../tools/render-utils`).
- **Truncate** lines with `truncateToWidth()` / `ui.truncate()`. Use `TRUNCATE_LENGTHS`
  constants.
- **Shorten paths** with `shortenPath()` (replaces home with `~`).
- **Preview limits** from `PREVIEW_LIMITS`. No ad-hoc numbers.

**Apply to every render path**, not just the happy one:

- Success output (file previews, command output, search results).
- **Error messages** — these often embed file content (e.g., patch failure messages include
  unmatched lines). If a message contains file content, it needs `replaceTabs()`.
- Diff content (added and removed).
- Streaming previews.

### Streaming tool previews

Tool-call previews can have **multiple render paths**. If you add preview-only fields or
depend on partially streamed args, update every path — not only the final renderer. Streamed
argument buffers decode into display args via `decodeStreamedToolArgs` /
`ToolArgsRevealController` (`modes/controllers/tool-args-reveal.ts`); both the live event
path and transcript rebuilds must go through them — never spread provider-parsed `arguments`
next to a raw `__partialJson` (parsed args lag the stream by a throttled parse window).

For the bash tool specifically:

- The pending preview may need raw `partialJson`, not just parsed `arguments`. Parsed args lag
  until a JSON object closes, which makes inline env assignments appear only at the end.
- Preserve preview-only fields (e.g. `__partialJson`) through `event-controller.ts`, transcript
  rebuilds in `ui-helpers.ts`, and merged call/result rendering in `tool-execution.ts`. Missing
  one path causes inconsistent previews.
- `ToolExecutionComponent.#buildRenderContext()` for bash must work even before a result
  exists — the renderer uses call args plus render context to show the command preview while
  streaming.
- Verify both live streaming and rebuilt transcript paths after any bash preview change. A fix
  in one path does not fix the other.

## Commands

- NEVER commit unless asked.
- Never use `tsc`/`npx tsc` — always `bun check`.
- Never run `cargo test` directly for Rust tests — use `bun run test:rs`. It runs
  `cargo nextest run` (config: `.config/nextest.toml`) followed by a `cargo test --doc` pass,
  because nextest does not execute doctests. The doctest pass runs every runnable doctest in
  the workspace's lib crates; today that is tree-sitter-go's one example (pi-natives is a
  `cdylib`, which rustdoc skips; pi-builtins' examples are `ignore`d vendored uutils docs).
- `bun test` from the repo root is refused by the test runner — run it from
  `packages/coding-agent`.
- The native Rust addon needs **ninja** (`brew install ninja`) — `bun run build:native`
  otherwise fails with "CMake was unable to find a build program".
- Merge commits (maintainer merges of PRs) follow:
  `Merge PR #<number>: <conventional PR subject> (@<author>)`.

## Rust Build Profiles

Profiles live in the root `Cargo.toml`; `.cargo/config.toml` carries the settings Cargo.toml
cannot express. Both are committed, so no local `~/.cargo/config.toml` is required.

| Profile | Use |
| --- | --- |
| `dev` | Default. Line tables for our crates, no debuginfo for deps, deps at `opt-level = 2`. |
| `release` | Shipping build: fat LTO, 1 codegen unit, stripped. |
| `local` | Fast local release iteration: thin LTO, 16 codegen units, incremental. |
| `profiling` | `release` codegen with symbols kept, for `perf`/`samply`/Instruments. |
| `ci` | Thin LTO, no debuginfo, stripped. |

**Never set `split-debuginfo = "off"` on a profile that has debuginfo.** On Mach-O the linker
never merges DWARF into the executable — it writes a debug map (`N_OSO`) pointing at the `.o`
files, and `"unpacked"` is what keeps those files. With `"off"` every backtrace frame in our
own crates silently loses `file:line`; the `panicked at foo.rs:3` header still prints (that is
`#[track_caller]`, not debuginfo), which makes the loss easy to miss. `ci` may use `"off"`
only because it sets `debug = false`.

`embed-metadata = false` (in `.cargo/config.toml`) keeps crate metadata in `.rmeta` instead of
duplicating it into every rlib — measured 196 MB → 130 MB on a reqwest-sized graph at
identical build times. Its accepted spelling is toolchain-coupled; keep it in sync with
`rust-toolchain.toml`.

Rejected, with measurements, so nobody re-litigates them: **sccache** (cannot cache
incremental, bin, or proc-macro crates — measured slower than not using it), **mold**
(ELF-only; no Mach-O support), and **`panic = "abort"` on `dev`** (Cargo ignores `panic` for
the test profile, so the whole dep graph builds twice — 131 MB → 214 MB).

## Testing Guidance

Test the contract the system exposes — not the easiest internal detail to assert.

- Every new test must defend one **concrete, externally observable contract**: behavior,
  output shape, state transition, error mapping, or a regression-prone parsing boundary. If
  you cannot name the contract, do not add the test.

### Good vs. bad test filter

- **Name the failure mode.** Every test MUST state what a consumer observes if it regresses.
  Cannot name one? NEVER add it.
- **Good: transformation.** One fixture MAY prove parse/render/normalize/encode/resolve
  behavior when output is computed, not echoed.
- **Good: branch or boundary.** Distinct inputs, empty values, malformed input,
  version/provider routing, and state transitions MUST prove distinct outcomes.
- **Good: external contract.** Exact bytes/shape MAY be asserted when a provider, parser,
  protocol, or persisted consumer reads them.
- **Good: precedence or negative contract.** Keep explicit `false`/override-wins assertions
  and required absence only when they prevent a documented leak, downgrade, 400, or
  incompatible wire field.
- **Good: regression.** A repro MUST trigger the prior real failure path and assert the
  corrected observable result.
- **Bad: static echo.** NEVER test a constructor/builder merely copied a fixture or baked
  constant into an in-memory config/metadata field.
- **Bad: success passthrough.** NEVER assert `fn(x) === x` when `x` was already
  supplied/declared valid; assert a transform, rejection, or downstream effect instead.
- **Bad: wording/defaults.** NEVER assert prompt/UI boilerplate, a default literal, object
  existence, non-empty output, or length growth without a consumer contract.
- **Bad: duplicate rows.** Parameterized/loop rows MUST each cover a distinct branch,
  provider/model path, or consumer contract; delete same-path duplicates.
- **Metadata exception.** Exact metadata, identity, ordering, or `undefined` MAY remain only
  when a downstream consumer depends on it and the test establishes branch, precedence,
  negative-contract, wire, or regression evidence.
- **Termination exception.** For cyclic/large inputs, assert a bounded output, surfaced error,
  or state change; bare `not.toThrow()` is insufficient.
- No placeholder tests, tautologies, or "the code ran" assertions (`expect(true).toBe(true)`,
  bare `not.toThrow()`, non-empty string checks, length-grew checks, "prompt exists" checks
  without semantic assertion).
- Prefer contract-level tests over implementation details. Avoid asserting internal helper
  wiring, field assignment, singleton identity, incidental ordering, prompt boilerplate, or
  passthrough option forwarding unless another component depends on that exact detail.
- Don't duplicate coverage across abstraction levels. If an integration test already proves
  the behavior, drop the narrower unit test that restates it through mocks.
- Tests **must be full-suite safe**, not just file-local safe. No long-lived file-wide
  mutations of `Bun.*`, `process.platform`, `process.env`, or `Bun.env` when a narrower seam
  exists. Prefer per-test `vi.spyOn(...)` with `vi.restoreAllMocks()` in `afterEach`. A test
  that passes alone but poisons later files is broken.
- **Never use `mock.module()`**. Bun's `mock.module()` mutates the global module registry and
  leaks across files ([oven-sh/bun#12823](https://github.com/oven-sh/bun/issues/12823)). Use
  `spyOn` on the imported module object instead. For pass deps, import the pass and spy on
  `.run`. For package deps, namespace-import and spy on the exported function.
- For lifecycle/stateful code, prefer one test per invariant or transition over several tiny
  tests asserting one field each from the same transition.
- For error handling, trigger the real failure path and assert the surfaced contract — don't
  instantiate error classes directly or inspect internal metadata.
- Smoke tests are acceptable only when they catch a failure mode narrower tests would miss.
  "Package boots" or "command starts" alone is not enough.
- Assert exact strings, ordering, and formatting only when downstream code parses or depends
  on the exact bytes. Otherwise assert semantic content.
- Compile-time guarantees → type checks/type tests, not runtime placeholders.
- **Never source-grep.** A test that reads an implementation file (`.ts`/`.rs`/build script) and
  asserts on its _text_ — `expect(src).toContain("someCall()")`,
  `.toMatch(/import .../)`, `.not.toContain("oldName")`, or "comment must say X" — is banned. It
  tests how code _looks_, not what it _does_: it breaks on harmless refactors (comment
  reflow, rename, import reorder) and passes while the behavior is broken. Assert the
  observable contract instead (run the code, check output/state/error), use the runtime smoke
  probe for wiring you cannot exercise in-process, and enforce structural invariants (no
  value-import of X, no self-import) with a type test or an oxlint rule — never a string scan
  of the source. (Reading a file your code _wrote_ — apply-patch result, generated bundle, temp
  fixture — and asserting on that output is fine; that is behavior, not a source grep.)
- Don't add tests for tiny low-risk changes unless they protect a real contract or fix a
  regression-prone edge case.
- Prefer focused package-local verification for the changed area.

### Testing the skills

`packages/coding-agent/test/bundled-skills.test.ts` covers skill delivery: discovery,
`skill://` reference resolution, materialization + pruning, and the codec round-trip. Extend
it when you change `src/skills/`.

A skill's *content* is prose, so it is not unit-tested — but the corpus's *shape* is: a
reference file named by a router must exist, or the agent will try to read a file that isn't
there. If you add a reference file, wire it into the router that names it.

## Changelog

Location: `packages/*/CHANGELOG.md` (per package).

**Format** — sections under `## [Unreleased]`:

- `### Breaking Changes` (first if present)
- `### Added`
- `### Changed`
- `### Fixed`
- `### Removed`

**Rules:**

- New entries always go under `## [Unreleased]`.
- Entries are one line, brief, and user-facing: lead with what the user will see or can now
  do. Root-cause narration and implementation detail belong in the commit/PR, not the
  changelog.
- Never modify already-released sections (e.g., `## [0.12.2]`) — they are immutable.
- Don't flag changelog section order or formatting in reviews or PRs — `bun run release` runs
  `fix-changelogs` which normalizes everything automatically.

**Attribution:**

- Internal (from issues): `Fixed foo bar ([#123](https://github.com/piyoyo2/mop/issues/123))`.
- External contributions: `Added feature X ([#456](https://github.com/piyoyo2/mop/pull/456) by [@username](https://github.com/username))`.

## Releasing

1. Ensure all changes since last release are in each affected package's `[Unreleased]` section.
2. Run `bun run release`.

The script handles version bump, CHANGELOG finalization, commit, tag, publish, and adding new
`[Unreleased]` sections.

## Where things are

| | |
|---|---|
| Domain | `packages/coding-agent/skills/` |
| Main agent prompt | `packages/coding-agent/src/prompts/system/mop-system-prompt.md` |
| Read-only agent | `packages/coding-agent/src/prompts/agents/reader.md` |
| Skill delivery | `packages/coding-agent/src/skills/` |
| Tool registry | `packages/coding-agent/src/tools/builtin-names.ts`, `src/tools/index.ts` |
| Tool descriptions | `packages/coding-agent/src/prompts/tools/*.md` |
| Config | `~/.mop/agent/` (skills materialize to `~/.mop/skills/`) |
| Lore library | `~/.mop/agent/lore/` |
| Project history | `HANDOFF.md` |
