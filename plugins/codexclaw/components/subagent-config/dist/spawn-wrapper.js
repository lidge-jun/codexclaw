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
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveSpawnConfig,                                     } from "./store.js";

/** Built-in codex agent_type each canonical role maps to (core/src/agent/role.rs). */
export const ROLE_AGENT_TYPE                                          = {
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
 * multi_agents_spec: v1 has items, v2 deny_unknown_fields has none), so attachment is a
 * v1-only capability — see structure/10 for the E3 follow-up.
 */














export const SURFACE_SKILL                          = {
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
};

/**
 * Per-role baseline skills always attached, independent of surface. The universal
 * `dev` discipline anchors every coding role; the reviewer additionally anchors on the
 * `dev-code-reviewer` review skill (it is read-only adversarial review). Risk surfaces
 * such as `dev-security` are attached per-surface via SURFACE_SKILL, not as a baseline.
 */
export const ROLE_BASE_SKILLS                             = {
  explorer: ["dev"],
  reviewer: ["dev", "dev-code-reviewer"],
  executor: ["dev"],
};

/** A `skill` spawn item: codex-rs UserInput::Skill { name, path }. */






/** A `text` spawn item: codex-rs UserInput::Text. */







/** Map a skill FOLDER name to its `cxc-*` display name + absolute SKILL.md path. */
export function skillItem(skillsDir        , folder        )                 {
  return { type: "skill", name: `cxc-${folder}`, path: join(skillsDir, folder, "SKILL.md") };
}

/**
 * PURE: compute the ordered, de-duplicated set of skill FOLDERS to attach for a role +
 * optional surfaces + optional explicit skill folders. Explicit skills win (appended
 * after, deduped); order is role-base, then surfaces, then explicit. An explicit folder
 * the user names verbatim (e.g. "search") is honored even if no surface maps to it.
 */
export function resolveAttachedSkillFolders(
  role          ,
  surfaces            = [],
  explicitFolders           = [],
)           {
  const out           = [];
  const push = (f        )       => {
    if (f && !out.includes(f)) out.push(f);
  };
  for (const f of ROLE_BASE_SKILLS[role]) push(f);
  for (const s of surfaces) push(SURFACE_SKILL[s]);
  for (const f of explicitFolders) push(f);
  return out;
}

/**
 * PURE: build the `items` array for a v1 spawn — one `skill` item per resolved skill
 * folder (filtered to those that exist on disk), then a trailing `text` item with the
 * task. Returns the items; the caller passes them as `spawn_agent({ items })`.
 */
export function buildSpawnItems(input





 )              {
  const folders = resolveAttachedSkillFolders(
    input.role,
    input.surfaces ?? [],
    input.explicitSkillFolders ?? [],
  );
  const items              = [];
  for (const folder of folders) {
    const item = skillItem(input.skillsDir, folder);
    // Only attach skills that actually exist on disk (a misnamed surface/explicit folder
    // must not produce a dangling skill path the runtime would reject).
    if (existsSync(item.path)) items.push(item);
  }
  items.push({ type: "text", text: `TASK: ${(input.task ?? "").trim()}` });
  return items;
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
export function parseRoleToml(text        )                 {
  const src = typeof text === "string" ? text : "";
  let model                = null;
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
export function readRoleToml(agentsDir        , role          )                 {
  try {
    const path = join(agentsDir, `${role}.toml`);
    if (!existsSync(path)) return { model: null, developerInstructions: "" };
    return parseRoleToml(readFileSync(path, "utf8"));
  } catch {
    return { model: null, developerInstructions: "" };
  }
}

/** Concrete Codex `spawn_agent` payload (the subset codexclaw controls). */
























/**
 * PURE builder: compose the spawn_agent payload. The effective role prompt is the
 * promptOverride when set, else the TOML developer_instructions. The model key is
 * included only for a non-default (model-mode) resolution with a real id.
 */
export function buildSpawnPayload(input                        )               {
  const { role, task, resolution, developerInstructions } = input;
  const agent_type = ROLE_AGENT_TYPE[role];
  const rolePrompt = (resolution.promptOverride ?? developerInstructions ?? "").trim();
  const taskText = (task ?? "").trim();
  const message = rolePrompt.length > 0 ? `${rolePrompt}\n\nTASK: ${taskText}` : `TASK: ${taskText}`;
  const payload               = { agent_type, message };
  if (!resolution.usesMainModel && typeof resolution.model === "string" && resolution.model.length > 0) {
    payload.model = resolution.model;
  }
  return payload;
}

/**
 * Production entry point: resolve the role config from `.codexclaw/subagents.json`,
 * read the role TOML developer_instructions, and build the spawn payload. Never throws.
 */
export function resolveSpawnPayload(cwd        , role          , task        , agentsDir        )               {
  const resolution = resolveSpawnConfig(cwd, role);
  const { developerInstructions } = readRoleToml(agentsDir, role);
  return buildSpawnPayload({ role, task, resolution, developerInstructions });
}

/**
 * L15 skill-routing builder entry: build the base payload (role prompt in `message`,
 * model from the store) and attach the resolved `cxc-*` skills + task as the v1 `items`
 * array. The role prompt stays in `message` (single source); `items` only carries skill
 * attachments + the task text, so the two channels never duplicate the prompt.
 *
 * NOTE: this is a builder the MAIN AGENT calls when it dispatches a v1 spawn — it is NOT
 * auto-invoked by a hook. A `^spawn_agent$` PreToolUse hook that calls this for the agent
 * (E3) is the L15.2 follow-up (structure/10); until then attachment depends on the agent
 * routing through this builder (E5 doctrine).
 */
export function resolveSpawnPayloadWithSkills(input







 )               {
  const base = resolveSpawnPayload(input.cwd, input.role, input.task, input.agentsDir);
  const items = buildSpawnItems({
    role: input.role,
    task: input.task,
    skillsDir: input.skillsDir,
    surfaces: input.surfaces,
    explicitSkillFolders: input.explicitSkillFolders,
  });
  return { ...base, items };
}

/**
 * lazygap_impl 020 — role x intent dispatch map. Specialization travels as a skill
 * attachment to one of the three base roles, never as a new role (the locked steering
 * principle). An intent names WHAT the dispatch is for; the map picks the role.
 */








/** Map a dispatch intent to one of the three base roles. */
export const INTENT_ROLE                           = {
  "red-team": "reviewer",
  review: "reviewer",
  implement: "executor",
  debug: "executor",
  investigate: "explorer",
  research: "explorer",
};

/**
 * PURE: turn a dispatch intent (+ optional surfaces / explicit skill folders) into the
 * role and the `items` attachment for a v1 spawn. This is the one call a dispatcher makes:
 *   routeDispatch({ intent: "red-team", surfaces: ["frontend"], task, skillsDir })
 *   -> role "reviewer", items [cxc-dev, cxc-dev-code-reviewer, cxc-dev-frontend, TASK:...]
 * An unknown intent is not representable (TS), but a defensive fallback maps to `explorer`
 * (read-only) so a loosened caller can never escalate privilege via a bad intent string.
 */
export function routeDispatch(input





 )                                         {
  const role = INTENT_ROLE[input.intent] ?? "explorer";
  const items = buildSpawnItems({
    role,
    task: input.task,
    skillsDir: input.skillsDir,
    surfaces: input.surfaces,
    explicitSkillFolders: input.explicitSkillFolders,
  });
  return { role, items };
}
