/**
 * spawn-attach-hook.test.ts — runtime policy for spawn_agent.
 *
 * Contract:
 *  - known cxc mentions are repaired on both v1 and v2 without inventing baselines.
 *  - normalization is LINE-BASED and conservative (090 escalation, maximal
 *    FAILSAFE-SPAN-01): bare tokens repair only on lines without backticks or
 *    brackets; links repair only as a standalone whole-line shape; every
 *    ambiguous/mixed line is protected verbatim — false negatives beat
 *    message corruption.
 *  - v2-shaped spawns (`task_name` or `fork_turns`) also get the leaf topology guard.
 *  - v1-shaped spawns also get model routing from `.codexclaw/subagents.json`.
 *  - no reasoning-effort inference happens here.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LEAF_GUARD_BLOCK,
  LEAF_GUARD_MARKER,
  SUBSPAWN_TOKEN,
  inferRole,
  isFullHistoryFork,
  isV2SpawnInput,
  mentionedFolders,
  normalizeSkillMentions,
  runSpawnAttachHook,
} from "../src/spawn-attach-hook.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = resolve(here, "..", "..", "..", "skills");

function canonicalSkillMention(folder: string): string {
  return `[$cxc-${folder}](skill://${join(SKILLS_DIR, folder, "SKILL.md")})`;
}

function tempCwd(prefix = "cxc-spawn-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function spawnPayload(toolInput: Record<string, unknown>): string {
  return JSON.stringify({
    hook_event_name: "PreToolUse",
    tool_name: "spawn_agent",
    cwd: tempCwd("cxc-spawn-noconfig-"),
    tool_input: toolInput,
  });
}

function subagentSpawnPayload(toolInput: Record<string, unknown>): string {
  return JSON.stringify({
    hook_event_name: "PreToolUse",
    tool_name: "spawn_agent",
    agent_id: "0199-child-thread",
    agent_type: "explorer",
    cwd: tempCwd("cxc-spawn-subagent-"),
    tool_input: toolInput,
  });
}

function spawnPayloadAt(cwd: string, toolInput: Record<string, unknown>): string {
  return JSON.stringify({
    hook_event_name: "PreToolUse",
    tool_name: "spawn_agent",
    cwd,
    tool_input: toolInput,
  });
}

function workspaceWithConfig(roles: Record<string, unknown>): string {
  const cwd = tempCwd("cxc-spawn-attach-");
  mkdirSync(join(cwd, ".codexclaw"), { recursive: true });
  writeFileSync(join(cwd, ".codexclaw", "subagents.json"), JSON.stringify({ roles }));
  return cwd;
}

function updatedInputOf(out: string): Record<string, unknown> {
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "allow");
  return parsed.hookSpecificOutput.updatedInput;
}

test("mention normalization: bare and plugin-prefixed known skills become canonical links", () => {
  const expected = canonicalSkillMention("dev");
  assert.equal(normalizeSkillMentions("use $cxc-dev now", SKILLS_DIR), `use ${expected} now`);
  assert.equal(normalizeSkillMentions("use $codexclaw:cxc-dev now", SKILLS_DIR), `use ${expected} now`);
});

test("mention normalization: unknown, boundary-extended, and mixed-case tokens stay verbatim", () => {
  for (const message of ["$cxc-not-a-real-skill", "$cxc-dev_extra", "$cxc-Dev", "$CXC-dev"]) {
    assert.equal(normalizeSkillMentions(message, SKILLS_DIR), message);
  }
});

test("mention normalization: complete links, inline code, and fenced code are protected", () => {
  const message = [
    "[label $cxc-dev](/target/$cxc-search)",
    "`$cxc-dev`",
    "```ts\n$cxc-dev\n```",
    "~~~text\n$codexclaw:cxc-dev\n~~~",
  ].join("\n");
  assert.equal(normalizeSkillMentions(message, SKILLS_DIR), message);
});

test("mention normalization: an inline delimiter inside a fence body does not close the fence", () => {
  // C-gate B2: only a line-anchored run >= the opening length closes a fence.
  const closed = "```\nbody with ``` inline\n$cxc-search must stay bare\n```\nafter $cxc-dev";
  assert.equal(
    normalizeSkillMentions(closed, SKILLS_DIR),
    `\`\`\`\nbody with \`\`\` inline\n$cxc-search must stay bare\n\`\`\`\nafter ${canonicalSkillMention("dev")}`,
  );

  const unclosed = "```\nstill protected ``` here\n$cxc-dev";
  assert.equal(normalizeSkillMentions(unclosed, SKILLS_DIR), unclosed);
});

test("mention normalization: a close-run line with trailing text does not close the fence", () => {
  // C-gate r2: the closing fence may carry ONLY spaces until end of line.
  const message = "```\n``` not a close\n$cxc-search protected\n```\nafter $cxc-dev";
  assert.equal(
    normalizeSkillMentions(message, SKILLS_DIR),
    `\`\`\`\n\`\`\` not a close\n$cxc-search protected\n\`\`\`\nafter ${canonicalSkillMention("dev")}`,
  );
});

test("mention normalization: indented fences close on the same prefix; drift protects to EOM", () => {
  // C-gate r5 B1 contract: the close must byte-match the opener's container
  // prefix. Same-prefix closes; "   " vs "  " drift leaves the fence open.
  const matched = "   ```\n$cxc-search protected\n   ```\nafter $cxc-dev";
  assert.equal(
    normalizeSkillMentions(matched, SKILLS_DIR),
    `   \`\`\`\n$cxc-search protected\n   \`\`\`\nafter ${canonicalSkillMention("dev")}`,
  );
  const drifted = "   ```\n$cxc-search protected\n  ```\nafter $cxc-dev";
  assert.equal(normalizeSkillMentions(drifted, SKILLS_DIR), drifted);
});

test("mention normalization: a block-quoted fence with an inline delimiter protects its body", () => {
  // C-gate r3: fence detection strips one container prefix level before the marker check.
  const message = "> ```\n> body ``` inline\n> $cxc-search stays\n> ```\nafter $cxc-dev";
  assert.equal(
    normalizeSkillMentions(message, SKILLS_DIR),
    `> \`\`\`\n> body \`\`\` inline\n> $cxc-search stays\n> \`\`\`\nafter ${canonicalSkillMention("dev")}`,
  );
});

test("mention normalization: CRLF fences close so mentions after the fence still normalize", () => {
  const message = "```\r\n$cxc-search protected\r\n```\r\nafter $cxc-dev";
  assert.equal(
    normalizeSkillMentions(message, SKILLS_DIR),
    `\`\`\`\r\n$cxc-search protected\r\n\`\`\`\r\nafter ${canonicalSkillMention("dev")}`,
  );
});

test("mention normalization: an escaped backtick is not an inline-code opener", () => {
  // C-gate r3: the scanner consumes \x pairs; no code-span state bleeds to EOM.
  const message = "escaped \\` backtick here\nthen $cxc-dev";
  assert.equal(
    normalizeSkillMentions(message, SKILLS_DIR),
    `escaped \\\` backtick here\nthen ${canonicalSkillMention("dev")}`,
  );
});

test("mention normalization: broken known-skill links are atomically repaired", () => {
  const expected = canonicalSkillMention("dev");
  assert.equal(normalizeSkillMentions("[$cxc-dev](/tmp/not-a-skill.txt)", SKILLS_DIR), expected);
  assert.equal(
    normalizeSkillMentions("[$codexclaw:cxc-dev](skill:///missing/dev/SKILL.md)", SKILLS_DIR),
    expected,
  );
  const unknown = "[$cxc-not-a-real-skill](/tmp/broken)";
  assert.equal(normalizeSkillMentions(unknown, SKILLS_DIR), unknown);
});

test("mention normalization: canonical and alternate existing SKILL.md targets stay verbatim", () => {
  const canonical = canonicalSkillMention("dev");
  assert.equal(normalizeSkillMentions(canonical, SKILLS_DIR), canonical);

  const alternateRoot = mkdtempSync(join(tmpdir(), "cxc-alt-skills-"));
  const alternatePath = join(alternateRoot, "dev", "SKILL.md");
  mkdirSync(dirname(alternatePath), { recursive: true });
  writeFileSync(alternatePath, "# alternate dev\n");
  try {
    const skillUri = `[$cxc-dev](skill://${alternatePath})`;
    const plainPath = `[$codexclaw:cxc-dev](${alternatePath})`;
    assert.equal(normalizeSkillMentions(skillUri, SKILLS_DIR), skillUri);
    assert.equal(normalizeSkillMentions(plainPath, SKILLS_DIR), plainPath);
  } finally {
    rmSync(alternateRoot, { recursive: true, force: true });
  }
});

test("mention normalization: angle-bracket and titled destinations are not the standalone shape and stay verbatim", () => {
  // 090 contract change: angle/titled destinations are ambiguous -> protected,
  // even when broken (previously repaired).
  const devPath = join(SKILLS_DIR, "dev", "SKILL.md");
  const untouched = [
    `[$cxc-dev](<${devPath}>)`,
    `[$cxc-dev](${devPath} "Dev skill")`,
    `[$cxc-dev](<skill://${devPath}> 'Dev skill')`,
    "[$cxc-dev](</missing/dev/SKILL.md>)",
    '[$cxc-dev](/missing/dev.txt "broken")',
  ];
  for (const link of untouched) {
    assert.equal(normalizeSkillMentions(link, SKILLS_DIR), link);
  }
});

test("mention normalization: a quoted-title link keeps its whole line protected", () => {
  // C-gate r2/r4: [$cxc-dev](<existing path> "(") is not the standalone shape;
  // 090 contract change: the mixed line is protected whole, so the trailing
  // bare mention stays bare (previously rewritten).
  const devPath = join(SKILLS_DIR, "dev", "SKILL.md");
  const link = `[$cxc-dev](${devPath} "(")`;
  assert.equal(normalizeSkillMentions(link, SKILLS_DIR), link);
  const mixed = `before ${link} after $cxc-dev`;
  assert.equal(normalizeSkillMentions(mixed, SKILLS_DIR), mixed);
});

test("mention normalization: a huge quoted-title link stays byte-identical, never nested-rewritten", () => {
  // FAILSAFE-SPAN-01 (r4 blocker): no tail parsing exists to overflow; the
  // line is simply not the standalone shape. 090 contract change: the mixed
  // line's trailing bare mention also stays bare (previously rewritten).
  const devPath = join(SKILLS_DIR, "dev", "SKILL.md");
  const link = `[$cxc-dev](${devPath} "${"t".repeat(1200)}")`;
  assert.equal(normalizeSkillMentions(link, SKILLS_DIR), link);
  const mixed = `${link} then $cxc-dev`;
  assert.equal(normalizeSkillMentions(mixed, SKILLS_DIR), mixed);
});

test("mention normalization: nested block-quote fences protect their body", () => {
  // r4 blocker: container tokens strip before the fence toggle.
  const message = "> > ```\n> > $cxc-search inside\n> > ```\nafter $cxc-dev";
  assert.equal(
    normalizeSkillMentions(message, SKILLS_DIR),
    `> > \`\`\`\n> > $cxc-search inside\n> > \`\`\`\nafter ${canonicalSkillMention("dev")}`,
  );
});

test("mention normalization: a literal quoted fence line inside a top-level fence does not close it", () => {
  // C-gate r5 B1: "> ```" has a different container prefix than the "" opener.
  const message = "```\n> ```\n$cxc-search still fenced\n```\nafter $cxc-dev";
  assert.equal(
    normalizeSkillMentions(message, SKILLS_DIR),
    `\`\`\`\n> \`\`\`\n$cxc-search still fenced\n\`\`\`\nafter ${canonicalSkillMention("dev")}`,
  );

  // A genuine "> ```"-opened fence still closes on "> ```".
  const quoted = "> ```\n> $cxc-search fenced\n> ```\nafter $cxc-dev";
  assert.equal(
    normalizeSkillMentions(quoted, SKILLS_DIR),
    `> \`\`\`\n> $cxc-search fenced\n> \`\`\`\nafter ${canonicalSkillMention("dev")}`,
  );
});

test("mention normalization: deep container nesting still opens fence protection", () => {
  // C-gate r5 B2: the fence-toggle container strip has no token cap, so five
  // quote levels cannot leak backtick-free body lines to bare normalization.
  const message = "> > > > > ```\n> > > > > $cxc-search body\nplain $cxc-search body\n> > > > > ```\nafter $cxc-dev";
  assert.equal(
    normalizeSkillMentions(message, SKILLS_DIR),
    `> > > > > \`\`\`\n> > > > > $cxc-search body\nplain $cxc-search body\n> > > > > \`\`\`\nafter ${canonicalSkillMention("dev")}`,
  );
});

test("mention normalization: an escaped destination is not the standalone shape and stays verbatim", () => {
  // r4 blocker: backslashes in targets are never unescaped-and-checked.
  const link = "[$cxc-dev](/tmp/pa\\th/SKILL.md)";
  assert.equal(normalizeSkillMentions(link, SKILLS_DIR), link);
});

test("mention normalization: a bare mention sharing a line with any link stays bare", () => {
  // 090 contract: lines containing brackets are never bare-token rewritten.
  const message = "see [docs](https://example.com) and $cxc-dev";
  assert.equal(normalizeSkillMentions(message, SKILLS_DIR), message);
});

test("mention normalization: container-prefixed standalone link lines are handled", () => {
  const canonical = canonicalSkillMention("dev");
  assert.equal(normalizeSkillMentions(`- ${canonical}`, SKILLS_DIR), `- ${canonical}`);
  assert.equal(normalizeSkillMentions("- [$cxc-dev](skill:///missing/dev/SKILL.md)", SKILLS_DIR), `- ${canonical}`);
  assert.equal(normalizeSkillMentions("> 1. [$cxc-dev](/tmp/broken.txt)\t", SKILLS_DIR), `> 1. ${canonical}\t`);
});

test("mention normalization: adversarial floods stay linear-time", () => {
  // C-gate B4 + r2: each >= 128 KiB input must normalize in < 1s (no recounting).
  const KIB_128 = 128 * 1024;
  const parenTitleUnit = '[$cxc-dev](/x "(") ';
  const repairUnit = "[$cxc-dev](/x)\n";
  const cases: Array<{ name: string; message: string; identity: boolean }> = [
    { name: 'unmatched "[" flood', message: "[".repeat(KIB_128), identity: true },
    { name: 'mid-line "~" flood', message: `x ${"~".repeat(KIB_128)}`, identity: true },
    {
      // 090 contract change: a mixed bracket line is protected, so this flood
      // is now identity instead of a repair pass.
      name: "repeated paren-in-title links",
      message: parenTitleUnit.repeat(Math.ceil(KIB_128 / parenTitleUnit.length)),
      identity: true,
    },
    {
      name: "repeated standalone broken-link lines",
      message: repairUnit.repeat(Math.ceil(KIB_128 / repairUnit.length)),
      identity: false,
    },
  ];
  for (const { name, message, identity } of cases) {
    assert.ok(message.length >= KIB_128, `${name} fixture must be >= 128 KiB`);
    const startedAt = performance.now();
    const result = normalizeSkillMentions(message, SKILLS_DIR);
    const elapsedMs = performance.now() - startedAt;
    assert.ok(elapsedMs < 1000, `${name} took ${elapsedMs.toFixed(1)}ms (budget 1000ms)`);
    if (identity) {
      assert.equal(result, message);
    } else {
      assert.ok(result.includes(canonicalSkillMention("dev")), `${name} should repair broken links`);
    }
    console.log(`perf smoke: ${name} (${message.length} chars) normalized in ${elapsedMs.toFixed(1)}ms`);
  }
});

test("mention normalization: messages over 256 KiB pass through untouched", () => {
  const message = `$cxc-dev ${"x".repeat(256 * 1024)}`;
  assert.equal(normalizeSkillMentions(message, SKILLS_DIR), message);
});

test("mention normalization: link-unsafe skill roots use the plugin-prefixed token", () => {
  const skillsDir = mkdtempSync(join(tmpdir(), "cxc skills "));
  mkdirSync(join(skillsDir, "dev"), { recursive: true });
  writeFileSync(join(skillsDir, "dev", "SKILL.md"), "# dev\n");
  try {
    assert.equal(normalizeSkillMentions("$cxc-dev", skillsDir), "$codexclaw:cxc-dev");
  } finally {
    rmSync(skillsDir, { recursive: true, force: true });
  }
});

test("mention normalization: plugin prefix is pinned to plugin.json name", () => {
  const manifest = JSON.parse(readFileSync(resolve(SKILLS_DIR, "..", ".codex-plugin", "plugin.json"), "utf8"));
  assert.equal(manifest.name, "codexclaw");
  assert.equal(
    normalizeSkillMentions(`$${manifest.name}:cxc-dev`, SKILLS_DIR),
    canonicalSkillMention("dev"),
  );
});

test("v2 leaf guard: subagent-issued spawn is denied without the token", () => {
  const out = runSpawnAttachHook(subagentSpawnPayload({ task_name: "child", message: "spawn with $cxc-dev" }));
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
  assert.match(parsed.hookSpecificOutput.permissionDecisionReason, /LEAF-TOPOLOGY-01/);
  assert.match(parsed.hookSpecificOutput.permissionDecisionReason, new RegExp(SUBSPAWN_TOKEN));
  assert.ok(!("updatedInput" in parsed.hookSpecificOutput), "D1 denial runs before normalization");
});

test("v2 leaf guard: subagent denial runs even when message is missing", () => {
  const parsed = JSON.parse(runSpawnAttachHook(subagentSpawnPayload({ task_name: "child" })));
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
});

test("v2 leaf guard: recursion token authorizes and skips rewrite", () => {
  const out = runSpawnAttachHook(
    subagentSpawnPayload({ task_name: "child", message: `${SUBSPAWN_TOKEN} spawn one summarizer` }),
  );
  assert.equal(out, "");
});

test("v2 leaf guard: root spawn gets only the guard, never model/effort/skills", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "kiro/claude-opus-4.6", effort: "high", promptOverride: null },
  });
  const out = runSpawnAttachHook(
    spawnPayloadAt(cwd, { task_name: "explorer_task", fork_turns: "none", message: "review the frontend diff" }),
  );
  const ui = updatedInputOf(out);
  assert.equal(ui.task_name, "explorer_task");
  assert.equal(ui.fork_turns, "none");
  assert.equal(ui.message, `${LEAF_GUARD_BLOCK}\n\nreview the frontend diff`);
  assert.ok(!("model" in ui));
  assert.ok(!("reasoning_effort" in ui));
  assert.doesNotMatch(ui.message as string, /Load and follow/);
});

test("v2 leaf guard: marker dedupes and token skips guard on root spawn", () => {
  const marked = runSpawnAttachHook(spawnPayload({ task_name: "t", message: `${LEAF_GUARD_MARKER} already guarded` }));
  assert.equal(marked, "");

  const tokened = runSpawnAttachHook(spawnPayload({ task_name: "t", message: `${SUBSPAWN_TOKEN} coordinator task` }));
  assert.equal(tokened, "");
});

test("v2 mention normalization emits an allow envelope even when the guard is already present", () => {
  // 090 contract change: the marker line contains brackets and is protected,
  // so the mention now sits on its own line to be repairable.
  const out = runSpawnAttachHook(
    spawnPayload({ task_name: "t", message: `${LEAF_GUARD_MARKER} guarded\nuse $cxc-dev`, trace_id: "keep-me" }),
  );
  const ui = updatedInputOf(out);
  assert.equal(ui.trace_id, "keep-me");
  assert.match(ui.message as string, /^\[CXC-LEAF-GUARD\] guarded\nuse \[\$cxc-dev\]\(skill:\/\//);
  assert.equal((ui.message as string).match(/\[CXC-LEAF-GUARD\]/g)?.length, 1);
});

test("v2 mention normalization composes with a newly prepended leaf guard", () => {
  const out = runSpawnAttachHook(spawnPayload({ task_name: "t", fork_turns: "none", message: "use $cxc-dev" }));
  const ui = updatedInputOf(out);
  assert.ok((ui.message as string).startsWith(`${LEAF_GUARD_BLOCK}\n\n`));
  assert.match(ui.message as string, /\[\$cxc-dev\]\(skill:\/\/.*\/dev\/SKILL\.md\)/);
});

test("v1 mention normalization composes with configured model routing", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "kiro/claude-opus-4.6", effort: "high", promptOverride: null },
  });
  const out = runSpawnAttachHook(
    spawnPayloadAt(cwd, { message: "$cxc-dev map the frontend codebase", agent_type: "explorer", trace_id: "keep" }),
  );
  const ui = updatedInputOf(out);
  assert.equal(ui.model, "kiro/claude-opus-4.6");
  assert.match(ui.message as string, /^\[\$cxc-dev\]\(skill:\/\//);
  assert.ok((ui.message as string).endsWith(" map the frontend codebase"));
  assert.equal(ui.trace_id, "keep");
  assert.ok(!("reasoning_effort" in ui));
});

test("v1 model routing: caller-picked model wins", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "kiro/claude-opus-4.6", promptOverride: null },
  });
  const out = runSpawnAttachHook(
    spawnPayloadAt(cwd, { message: "map the codebase", agent_type: "explorer", model: "gpt-5.5" }),
  );
  assert.equal(out, "");
});

test("v1 model routing: default mode and missing config are no-ops", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "default", model: null, effort: "high", promptOverride: null },
  });
  assert.equal(runSpawnAttachHook(spawnPayloadAt(cwd, { message: "map the codebase", agent_type: "explorer" })), "");
  assert.equal(runSpawnAttachHook(spawnPayload({ message: "map the codebase", agent_type: "explorer" })), "");
});

test("v1 model routing: review keywords route explorer spawns to reviewer config", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "default", model: null, promptOverride: null },
    reviewer: { mode: "model", model: "gpt-5.4-mini", promptOverride: null },
  });
  const out = runSpawnAttachHook(spawnPayloadAt(cwd, { message: "review the backend diff", agent_type: "explorer" }));
  assert.equal(updatedInputOf(out).model, "gpt-5.4-mini");
});

test("v1 model routing: items are preserved while model is injected", () => {
  const cwd = workspaceWithConfig({
    executor: { mode: "model", model: "deepseek/deepseek-v4", promptOverride: null },
  });
  const out = runSpawnAttachHook(
    spawnPayloadAt(cwd, {
      message: "implement it",
      agent_type: "worker",
      items: [{ type: "text", text: "TASK: implement it" }],
    }),
  );
  const ui = updatedInputOf(out);
  assert.equal(ui.model, "deepseek/deepseek-v4");
  assert.equal(ui.message, "implement it");
  assert.ok(Array.isArray(ui.items));
});

test("v1 full-history fork skips model routing", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "gpt-5.5", promptOverride: null },
  });
  const out = runSpawnAttachHook(
    spawnPayloadAt(cwd, { message: "summarize this thread", agent_type: "explorer", fork_context: true }),
  );
  assert.equal(out, "");
});

test("malformed, non-spawn, and missing message inputs are fail-open no-ops", () => {
  assert.equal(runSpawnAttachHook(""), "");
  assert.equal(runSpawnAttachHook("{not json"), "");
  assert.equal(runSpawnAttachHook(JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "spawn_agent" })), "");
  assert.equal(runSpawnAttachHook(spawnPayload({ agent_type: "explorer" })), "");
  assert.equal(runSpawnAttachHook(spawnPayload({ message: "   ", agent_type: "explorer" })), "");
  assert.equal(
    runSpawnAttachHook(
      JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "shell", tool_input: { message: "frontend" } }),
    ),
    "",
  );
});

test("inferRole: worker -> executor; review keywords -> reviewer; default explorer", () => {
  assert.equal(inferRole("worker", "review this"), "executor");
  assert.equal(inferRole("explorer", "audit the plan for blockers"), "reviewer");
  assert.equal(inferRole("explorer", "코드 검증 부탁"), "reviewer");
  assert.equal(inferRole("explorer", "map the codebase"), "explorer");
  assert.equal(inferRole(undefined, "map the codebase"), "explorer");
});

test("isV2SpawnInput and isFullHistoryFork classify spawn shapes", () => {
  assert.equal(isV2SpawnInput({ message: "x" }), false);
  assert.equal(isV2SpawnInput({ task_name: "t" }), true);
  assert.equal(isV2SpawnInput({ fork_turns: "none" }), true);

  assert.equal(isFullHistoryFork({ fork_context: true }), true);
  assert.equal(isFullHistoryFork({ fork_context: false }), false);
  assert.equal(isFullHistoryFork({ message: "x" }), false);
  assert.equal(isFullHistoryFork({ task_name: "t" }), true);
  assert.equal(isFullHistoryFork({ task_name: "t", fork_turns: "all" }), true);
  assert.equal(isFullHistoryFork({ task_name: "t", fork_turns: "  " }), true);
  assert.equal(isFullHistoryFork({ task_name: "t", fork_turns: "none" }), false);
  assert.equal(isFullHistoryFork({ task_name: "t", fork_turns: "3" }), false);
  assert.equal(isFullHistoryFork({ fork_turns: 3 }), false);
});

test("mentionedFolders recognizes all supported mention shapes", () => {
  const found = mentionedFolders(
    "$cxc-dev and $codexclaw:cxc-dev-testing and [$cxc-search](skill:///x/skills/search/SKILL.md)",
  );
  assert.deepEqual([...found].sort(), ["dev", "dev-testing", "search"]);
});
