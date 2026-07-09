/**
 * spawn-wrapper.ts — production spawn payload builder (L9.1 / 091).
 *
 * Turns the shipped per-role config (resolveSpawnConfig) + a role TOML's
 * developer_instructions into a concrete Codex `spawn_agent` payload, closing the
 * L9 gap where the resolver existed but nothing consumed it at spawn time.
 *
 * Contract (omo B-opt2 parity, agents/README.md):
 *  - role -> built-in agent_type (explorer/reviewer -> "explorer", executor -> "worker");
 *    the wrapper NEVER invents a role name (codex plugins can't register roles).
 *  - the role prompt is injected INLINE in the message ("TASK: ..."), since plugin
 *    install dirs are not a config layer.
 *  - model selection comes from the STORE resolver, not the TOML: `model = "default"`
 *    in the TOML is a Phase-1 inherit sentinel; the durable per-role model lives in
 *    `.codexclaw/subagents.json`. So this module reads ONLY developer_instructions from
 *    the TOML and takes the effective model from `resolveSpawnConfig`.
 *  - default mode (usesMainModel) OMITS the `model` key so the subagent inherits the
 *    main Codex model; an explicit `promptOverride` REPLACES the TOML instructions.
 *
 * Zero third-party deps (node:* only) so the build's type-strip stays sound.
 */
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, isAbsolute, resolve as resolvePath } from "node:path";
import { resolveSpawnConfig, type RoleName, type SpawnResolution } from "./store.ts";

/** Built-in codex agent_type each canonical role maps to (core/src/agent/role.rs). */
export const ROLE_AGENT_TYPE: Record<RoleName, "explorer" | "worker"> = {
  explorer: "explorer",
  reviewer: "explorer",
  executor: "worker",
};

/**
 * L15 — surface -> codexclaw skill folder routing map. Used to attach the matching
 * `cxc-*` skill to a subagent spawn as a `skill` item, so a dispatched subagent loads
 * the discipline at launch instead of being merely told to read it in prose.
 *
 * Keys are coarse change-surfaces the dispatcher names; values are skill FOLDER names
 * under plugins/codexclaw/skills/. Only v1 spawn carries `items` (codex-rs
 * multi_agents_spec: v1 has items, v2 deny_unknown_fields has none); the portable
 * v1+v2 channel is the message-borne mention block (buildSkillMentionBlock), which the
 * always-on spawn-attach hook applies — see structure/10.
 */
export type Surface =
  | "architecture"
  | "backend"
  | "frontend"
  | "data"
  | "security"
  | "testing"
  | "debugging"
  | "code-review"
  | "uiux"
  | "scaffolding"
  | "devops"
  | "search"
  | "recall";

export const SURFACE_SKILL: Record<Surface, string> = {
  architecture: "dev-architecture",
  backend: "dev-backend",
  frontend: "dev-frontend",
  data: "dev-data",
  security: "dev-security",
  testing: "dev-testing",
  debugging: "dev-debugging",
  "code-review": "dev-code-reviewer",
  uiux: "dev-uiux-design",
  scaffolding: "dev-scaffolding",
  devops: "dev-devops",
  search: "search",
  recall: "recall",
};

/**
 * Per-role baseline skills always attached, independent of surface. The universal
 * `dev` discipline anchors every coding role; the reviewer additionally anchors on the
 * `dev-code-reviewer` review skill (read-only adversarial review) and `search`
 * (A-gate reviewers must verify references/versions/external claims through the
 * search ladder — SEARCH-ATTACH-01). Risk surfaces such as `dev-security` are
 * attached per-surface via SURFACE_SKILL, not as a baseline.
 */
export const ROLE_BASE_SKILLS: Record<RoleName, string[]> = {
  explorer: ["dev"],
  reviewer: ["dev", "dev-code-reviewer", "search"],
  executor: ["dev"],
};

/** A `skill` spawn item: codex-rs UserInput::Skill { name, path }. */
export interface SpawnSkillItem {
  type: "skill";
  name: string;
  path: string;
}

/** A `text` spawn item: codex-rs UserInput::Text. */
export interface SpawnTextItem {
  type: "text";
  text: string;
}

export type SpawnItem = SpawnSkillItem | SpawnTextItem;

/** 080.2: a resolved repo-path token for a dispatch (workspace path-hint). */
export interface PathHint {
  token: string;
  abs: string;
  /** true when the realpath escapes the repo root (symlink-out), a safety signal. */
  outsideRepo: boolean;
}

/**
 * 080.2 — PURE: resolve repo-path-looking tokens in a task string to absolute paths under
 * `cwd`, flagging any whose realpath escapes the repo root (symlink-escape). cli-jaw
 * `buildResolvedPathHints` parity: existsSync + realpathSync only, no network, no registry.
 * A token is path-like if it contains a `/` or ends in a common file extension and exists.
 */
export function buildPathHints(cwd: string, taskText: string): PathHint[] {
  const out: PathHint[] = [];
  const seen = new Set<string>();
  let repoReal: string;
  try {
    repoReal = realpathSync(cwd);
  } catch {
    repoReal = resolvePath(cwd);
  }
  const tokens = (taskText ?? "").split(/[\s,;:()'"`]+/).filter((t) => t.length > 0);
  for (const token of tokens) {
    // path-like heuristic: a slash, or a dotted filename; skip urls and flags
    if (/^https?:\/\//i.test(token) || token.startsWith("-")) continue;
    if (!token.includes("/") && !/\.[a-z0-9]{1,8}$/i.test(token)) continue;
    const abs = isAbsolute(token) ? token : resolvePath(cwd, token);
    if (seen.has(abs)) continue;
    if (!existsSync(abs)) continue;
    seen.add(abs);
    let outsideRepo = false;
    try {
      const real = realpathSync(abs);
      outsideRepo = !real.startsWith(repoReal);
    } catch {
      outsideRepo = false;
    }
    out.push({ token, abs, outsideRepo });
  }
  return out;
}

/** Render path hints as a single spawn text item, or null when there are none. */
export function pathHintItem(hints: PathHint[]): SpawnTextItem | null {
  if (hints.length === 0) return null;
  const lines = hints.map((h) => `${h.token} -> ${h.abs}${h.outsideRepo ? " (OUTSIDE REPO — symlink escape)" : ""}`);
  return { type: "text", text: `Resolved paths:\n${lines.join("\n")}` };
}

/** Map a skill FOLDER name to its `cxc-*` display name + absolute SKILL.md path. */
export function skillItem(skillsDir: string, folder: string): SpawnSkillItem {
  return { type: "skill", name: `cxc-${folder}`, path: join(skillsDir, folder, "SKILL.md") };
}

/**
 * PURE: compute the ordered, de-duplicated set of skill FOLDERS to attach for a role +
 * optional surfaces + optional explicit skill folders. Explicit skills win (appended
 * after, deduped); order is role-base, then surfaces, then explicit. An explicit folder
 * the user names verbatim (e.g. "search") is honored even if no surface maps to it.
 */
export function resolveAttachedSkillFolders(
  role: RoleName,
  surfaces: Surface[] = [],
  explicitFolders: string[] = [],
): string[] {
  const out: string[] = [];
  const push = (f: string): void => {
    if (f && !out.includes(f)) out.push(f);
  };
  for (const f of ROLE_BASE_SKILLS[role]) push(f);
  for (const s of surfaces) push(SURFACE_SKILL[s]);
  for (const f of explicitFolders) push(f);
  return out;
}

/**
 * WP1 (mention channel) — true when an absolute SKILL.md path can sit inside a
 * markdown link target without breaking the runtime mention parser (no whitespace
 * or parens). Paths that fail this fall back to the plain `$name` mention form.
 */
function linkSafePath(p: string): boolean {
  return !/[\s()]/.test(p);
}

/**
 * WP1 — render one skill mention for a spawn MESSAGE. Link form
 * `[$cxc-<folder>](skill://<abs SKILL.md path>)` is preferred: the runtime resolves it
 * by exact path, immune to duplicate-name ambiguity. When the path is not link-safe,
 * degrade to the plain `$cxc-<folder>` name mention (unique-name match).
 */
export function skillMention(skillsDir: string, folder: string): string {
  const item = skillItem(skillsDir, folder);
  return linkSafePath(item.path) ? `[$${item.name}](skill://${item.path})` : `$${item.name}`;
}

/**
 * WP1 — PURE: render the skill-mention block to prepend to a spawn `message`. This is
 * the surface-agnostic attachment channel: `message` exists on BOTH the v1 and v2
 * spawn schemas, and the child's first turn parses `$name` / `[$name](skill://path)`
 * mentions out of its UserInput text, injecting each SKILL.md body. Folders that do
 * not exist on disk are dropped; `excludeFolders` dedupes against mentions already
 * present in the outgoing message. Returns "" when nothing is left to attach.
 */
export function buildSkillMentionBlock(input: {
  role: RoleName;
  skillsDir: string;
  surfaces?: Surface[];
  explicitSkillFolders?: string[];
  excludeFolders?: string[];
}): string {
  const exclude = new Set(input.excludeFolders ?? []);
  const folders = resolveAttachedSkillFolders(
    input.role,
    input.surfaces ?? [],
    input.explicitSkillFolders ?? [],
  ).filter((f) => !exclude.has(f) && existsSync(join(input.skillsDir, f, "SKILL.md")));
  if (folders.length === 0) return "";
  const lines = folders.map((f) => `- ${skillMention(input.skillsDir, f)}`);
  return `Load and follow these codexclaw skills before working:\n${lines.join("\n")}`;
}

/**
 * PURE: build the `items` array for a v1 spawn — one `skill` item per resolved skill
 * folder (filtered to those that exist on disk), then a trailing `text` item with the
 * task. Returns the items; the caller passes them as `spawn_agent({ items })`.
 */
export function buildSpawnItems(input: {
  role: RoleName;
  task: string;
  skillsDir: string;
  surfaces?: Surface[];
  explicitSkillFolders?: string[];
  /** 080.2: when provided, repo-path tokens in the task resolve to a path-hint text item
   *  (placed BEFORE the trailing TASK item). Omitted -> no path-hint (back-compat). */
  cwd?: string;
}): SpawnItem[] {
  const folders = resolveAttachedSkillFolders(
    input.role,
    input.surfaces ?? [],
    input.explicitSkillFolders ?? [],
  );
  const items: SpawnItem[] = [];
  for (const folder of folders) {
    const item = skillItem(input.skillsDir, folder);
    // Only attach skills that actually exist on disk (a misnamed surface/explicit folder
    // must not produce a dangling skill path the runtime would reject).
    if (existsSync(item.path)) items.push(item);
  }
  // 080.2: opt-in workspace path-hint (only when cwd is supplied), placed before the task.
  if (typeof input.cwd === "string" && input.cwd.length > 0) {
    const hint = pathHintItem(buildPathHints(input.cwd, input.task ?? ""));
    if (hint) items.push(hint);
  }
  items.push({ type: "text", text: `TASK: ${(input.task ?? "").trim()}` });
  return items;
}

export interface RoleTomlFields {
  /** The TOML `model` value (usually the "default" inherit sentinel). Informational
   *  only — the store resolver owns the effective model. null when absent/empty. */
  model: string | null;
  /** The triple-quoted developer_instructions body (trimmed). "" when absent. */
  developerInstructions: string;
}

/**
 * Narrow field reader for a codexclaw role TOML — NOT a general TOML parser. Extracts
 * the simple `model = "..."` scalar and the `developer_instructions = """..."""`
 * triple-quoted block. Total: malformed/missing input yields safe defaults.
 *
 * The triple-quote split is safe because the role bodies never contain a literal
 * triple-quote (verified across explorer/reviewer/executor.toml); a future body that
 * needed one would have to escape it, which TOML forbids anyway.
 */
export function parseRoleToml(text: string): RoleTomlFields {
  const src = typeof text === "string" ? text : "";
  let model: string | null = null;
  // `model = "value"` — first occurrence at a line start (ignore trailing comments).
  const modelMatch = /^\s*model\s*=\s*"([^"]*)"/m.exec(src);
  if (modelMatch && modelMatch[1].length > 0) model = modelMatch[1];

  let developerInstructions = "";
  const open = src.indexOf('developer_instructions');
  if (open !== -1) {
    const firstTriple = src.indexOf('"""', open);
    if (firstTriple !== -1) {
      const bodyStart = firstTriple + 3;
      const closeTriple = src.indexOf('"""', bodyStart);
      if (closeTriple !== -1) {
        developerInstructions = src.slice(bodyStart, closeTriple).trim();
      }
    }
  }
  return { model, developerInstructions };
}

/** Read + parse `<agentsDir>/<role>.toml`. Missing file -> safe defaults (never throws). */
export function readRoleToml(agentsDir: string, role: RoleName): RoleTomlFields {
  try {
    const path = join(agentsDir, `${role}.toml`);
    if (!existsSync(path)) return { model: null, developerInstructions: "" };
    return parseRoleToml(readFileSync(path, "utf8"));
  } catch {
    return { model: null, developerInstructions: "" };
  }
}

/**
 * 260709 dev2 switch — derive a v2-legal `task_name` (`[a-z0-9_]+`, required by the
 * v2 spawn schema) from the role + leading task words. PURE + deterministic:
 * sanitize to lowercase `[a-z0-9_]`, collapse repeats, trim, cap length; non-ASCII
 * tasks degrade to the `${role}_task` fallback.
 */
export function taskNameForRole(role: RoleName, task: string): string {
  const words = (task ?? "")
    .toLowerCase()
    .split(/\s+/)
    .slice(0, 3)
    .join("_")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  const base = words.length > 0 ? `${role}_${words}` : `${role}_task`;
  return base.slice(0, 40).replace(/_$/, "");
}

/**
 * Concrete Codex `spawn_agent` payload (the subset codexclaw controls).
 * V1 is the default surface; when V2 is enabled manually, the builder also emits
 * `task_name` and `fork_turns` for V2 compatibility. `fork_turns` is pinned to
 * "none" because the V2 default ("all", full-history fork) REJECTS
 * agent_type/model/reasoning_effort overrides. codexclaw role dispatches are
 * fresh-context spawns: the role prompt + task travel in `message`.
 */
export interface SpawnPayload {
  agent_type: "explorer" | "worker";
  message: string;
  /** v2 spawn schema: required task name, `[a-z0-9_]+`. Present when V2 is active. */
  task_name?: string;
  /** Pinned to "none" on V2: keeps agent_type/model/effort overrides legal (see above). */
  fork_turns?: "none";
  /** Present ONLY when a non-default model was configured; absent = inherit main model. */
  model?: string;
  /** Present ONLY when an effort override was configured; absent = inherit parent effort. */
  reasoning_effort?: string;
  /**
   * DEPRECATED (260709 dev2 switch): v1-only channel — the v2 spawn schema is
   * `deny_unknown_fields` and REJECTS `items`. No codexclaw builder sets this
   * anymore; the skill channel is the message-borne mention block
   * (buildSkillMentionBlock / the always-on spawn-attach hook — structure/10).
   * Kept typed only so a legacy v1 caller remains representable.
   */
  items?: SpawnItem[];
}

export interface BuildSpawnPayloadInput {
  role: RoleName;
  /** The concrete task text the subagent must perform. */
  task: string;
  /** Output of resolveSpawnConfig (owns the effective model + promptOverride). */
  resolution: SpawnResolution;
  /** developer_instructions from the role TOML (used unless promptOverride replaces it). */
  developerInstructions: string;
}

/**
 * PURE builder: compose the spawn_agent payload. The effective role prompt is the
 * promptOverride when set, else the TOML developer_instructions. The model key is
 * included only for a non-default (model-mode) resolution with a real id.
 */
export function buildSpawnPayload(input: BuildSpawnPayloadInput): SpawnPayload {
  const { role, task, resolution, developerInstructions } = input;
  const agent_type = ROLE_AGENT_TYPE[role];
  const rolePrompt = (resolution.promptOverride ?? developerInstructions ?? "").trim();
  const taskText = (task ?? "").trim();
  const message = rolePrompt.length > 0 ? `${rolePrompt}\n\nTASK: ${taskText}` : `TASK: ${taskText}`;
  const payload: SpawnPayload = {
    agent_type,
    message,
    task_name: taskNameForRole(role, taskText),
    fork_turns: "none",
  };
  if (!resolution.usesMainModel && typeof resolution.model === "string" && resolution.model.length > 0) {
    payload.model = resolution.model;
  }
  // Effort is mode-independent: it can override on a main-model spawn too. The store
  // validated it against the codex wire enum (an invalid effort hard-fails the spawn).
  if (typeof resolution.effort === "string" && resolution.effort.length > 0) {
    payload.reasoning_effort = resolution.effort;
  }
  return payload;
}

/**
 * Production entry point: resolve the role config from `.codexclaw/subagents.json`,
 * read the role TOML developer_instructions, and build the spawn payload. Never throws.
 */
export function resolveSpawnPayload(cwd: string, role: RoleName, task: string, agentsDir: string): SpawnPayload {
  const resolution = resolveSpawnConfig(cwd, role);
  const { developerInstructions } = readRoleToml(agentsDir, role);
  return buildSpawnPayload({ role, task, resolution, developerInstructions });
}

/**
 * L15 skill-routing builder entry (260709 dev2 switch: v2-legal). Build the base
 * payload (role prompt in `message`, model from the store) and attach the resolved
 * `cxc-*` skills as a MENTION BLOCK prepended to `message` — the v2 spawn schema
 * rejects `items` (`deny_unknown_fields`), and the child's first turn parses
 * `[$name](skill://path)` mentions out of its UserInput text. Optional path hints
 * (080.2) ride the same message.
 *
 * NOTE: this is a builder the MAIN AGENT calls when it dispatches a spawn — it is NOT
 * auto-invoked by a hook. The shipped `^spawn_agent$` PreToolUse hook (spawn-attach-hook)
 * covers dispatches that skip this builder by prepending $cxc mentions to the message
 * (deduping against mentions already present), so the two channels never stack.
 */
export function resolveSpawnPayloadWithSkills(input: {
  cwd: string;
  role: RoleName;
  task: string;
  agentsDir: string;
  skillsDir: string;
  surfaces?: Surface[];
  explicitSkillFolders?: string[];
}): SpawnPayload {
  const base = resolveSpawnPayload(input.cwd, input.role, input.task, input.agentsDir);
  const mentionBlock = buildSkillMentionBlock({
    role: input.role,
    skillsDir: input.skillsDir,
    surfaces: input.surfaces,
    explicitSkillFolders: input.explicitSkillFolders,
  });
  const hint = pathHintItem(buildPathHints(input.cwd, input.task ?? ""));
  const prefix = [mentionBlock, hint?.text].filter((s): s is string => !!s && s.length > 0);
  if (prefix.length === 0) return base;
  return { ...base, message: `${prefix.join("\n\n")}\n\n${base.message}` };
}

/**
 * lazygap_impl 020 — role x intent dispatch map. Specialization travels as a skill
 * attachment to one of the three base roles, never as a new role (the locked steering
 * principle). An intent names WHAT the dispatch is for; the map picks the role.
 */
export type Intent =
  | "red-team"
  | "review"
  | "implement"
  | "debug"
  | "investigate"
  | "research";

/** Map a dispatch intent to one of the three base roles. */
export const INTENT_ROLE: Record<Intent, RoleName> = {
  "red-team": "reviewer",
  review: "reviewer",
  implement: "executor",
  debug: "executor",
  investigate: "explorer",
  research: "explorer",
};

/**
 * lazygap_impl 070 — per-intent EXTRA skill folders appended on top of the role base.
 * This is how a `research` dispatch rides the deep-research protocol WITHOUT a new role:
 * the base `explorer` also gets `cxc-search` + `cxc-ultraresearch`. Other intents add
 * nothing here (their specialization comes from role base + surfaces). Folders are only
 * attached if they exist on disk (buildSpawnItems filters via existsSync), so a missing
 * skill silently degrades rather than producing a dangling path.
 */
export const INTENT_EXTRA_SKILL_FOLDERS: Partial<Record<Intent, string[]>> = {
  research: ["search", "ultraresearch"],
};

/**
 * PURE (260709 dev2 switch: v2-legal): turn a dispatch intent (+ optional surfaces /
 * explicit skill folders) into the role and a v2-shaped spawn fragment. This is the
 * one call a dispatcher makes:
 *   routeDispatch({ intent: "red-team", surfaces: ["frontend"], task, skillsDir })
 *   -> role "reviewer", task_name "reviewer_...", fork_turns "none",
 *      message "<skill mention block>\n\n<path hints>\n\nTASK: ..."
 * An unknown intent is not representable (TS), but a defensive fallback maps to `explorer`
 * (read-only) so a loosened caller can never escalate privilege via a bad intent string.
 */
export function routeDispatch(input: {
  intent: Intent;
  task: string;
  skillsDir: string;
  surfaces?: Surface[];
  explicitSkillFolders?: string[];
  /** 080.2: opt-in workspace path-hint resolution root. */
  cwd?: string;
}): { role: RoleName; task_name?: string; fork_turns?: "none"; message: string } {
  const role = INTENT_ROLE[input.intent] ?? "explorer";
  // 070: fold in any per-intent extra skill folders (e.g. research -> search + ultraresearch)
  // ahead of caller-supplied explicit folders; resolveAttachedSkillFolders dedups + orders.
  const intentExtras = INTENT_EXTRA_SKILL_FOLDERS[input.intent] ?? [];
  const explicitSkillFolders = [...intentExtras, ...(input.explicitSkillFolders ?? [])];
  const mentionBlock = buildSkillMentionBlock({
    role,
    skillsDir: input.skillsDir,
    surfaces: input.surfaces,
    explicitSkillFolders,
  });
  const taskText = (input.task ?? "").trim();
  const parts: string[] = [];
  if (mentionBlock.length > 0) parts.push(mentionBlock);
  if (typeof input.cwd === "string" && input.cwd.length > 0) {
    const hint = pathHintItem(buildPathHints(input.cwd, taskText));
    if (hint) parts.push(hint.text);
  }
  parts.push(`TASK: ${taskText}`);
  return {
    role,
    task_name: taskNameForRole(role, taskText),
    fork_turns: "none",
    message: parts.join("\n\n"),
  };
}
