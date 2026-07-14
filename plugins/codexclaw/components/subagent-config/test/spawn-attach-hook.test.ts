/**
 * spawn-attach-hook.test.ts — runtime policy for spawn tools (v1 + v2 parity).
 *
 * Contract:
 *  - known cxc mentions are repaired on both v1 and v2 without inventing baselines.
 *  - normalization is LINE-BASED and conservative (090 escalation, maximal
 *    FAILSAFE-SPAN-01): bare tokens repair only on lines without backticks or
 *    brackets; links repair only as a standalone whole-line shape; every
 *    ambiguous/mixed line is protected verbatim — false negatives beat
 *    message corruption.
 *  - the leaf topology guard (D1 deny + D2 block) applies to BOTH surfaces.
 *  - model AND reasoning_effort routing from `.codexclaw/subagents.json` applies to
 *    BOTH surfaces, decided independently per field, skipped on full-history forks.
 *  - v2-shaped spawns additionally get SKILL.md body inlining (atomic overflow).
 *  - native V2 hook names (collaborationspawn_agent) are accepted.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  INLINE_SKILL_OPEN,
  LEAF_GUARD_BLOCK,
  LEAF_GUARD_BLOCK_COORDINATOR,
  LEAF_GUARD_MARKER,
  SCOPE_GUARD_MARKER,
  SKILL_AFFORDANCE_MARKER,
  SUBSPAWN_TOKEN,
  V1_SCOPE_BLOCK,
  V1_SCOPE_BLOCK_COORDINATOR,
  inferRole,
  inlineSkillBodies,
  isCollaborationToolName,
  isFullHistoryFork,
  isSpawnToolName,
  isV2SpawnInput,
  mentionedFolders,
  normalizeSkillMentions,
  runSpawnAttachHook,
  skillAffordanceBlock,
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

test("leaf guard text does not contain the literal recursion token name", () => {
  assert.ok(!LEAF_GUARD_BLOCK.includes(SUBSPAWN_TOKEN));
  assert.ok(!LEAF_GUARD_BLOCK_COORDINATOR.includes(SUBSPAWN_TOKEN));
});

test("v2 leaf guard: subagent-issued spawn is denied without the token", () => {
  const out = runSpawnAttachHook(subagentSpawnPayload({ task_name: "child", message: "spawn with $cxc-dev" }));
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
  assert.match(parsed.hookSpecificOutput.permissionDecisionReason, /LEAF-TOPOLOGY-01/);
  assert.match(parsed.hookSpecificOutput.permissionDecisionReason, /recursion grant token/);
  assert.ok(!("updatedInput" in parsed.hookSpecificOutput), "D1 denial runs before normalization");
});

test("RECURSE_DENY_REASON does not contain the literal token name", () => {
  const out = runSpawnAttachHook(subagentSpawnPayload({ task_name: "child", message: "spawn a helper" }));
  const parsed = JSON.parse(out);
  assert.ok(!parsed.hookSpecificOutput.permissionDecisionReason.includes(SUBSPAWN_TOKEN));
});

test("v2 leaf guard: subagent denial runs even when message is missing", () => {
  const parsed = JSON.parse(runSpawnAttachHook(subagentSpawnPayload({ task_name: "child" })));
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
});

test("recursion grant token allows spawn from a subagent context", () => {
  const out = runSpawnAttachHook(
    subagentSpawnPayload({ task_name: "child", message: `${SUBSPAWN_TOKEN} spawn one summarizer` }),
  );
  const ui = updatedInputOf(out);
  assert.equal(ui.task_name, "child");
  assert.match(ui.message as string, /Recursion is authorized for this task/);
});

test("v2 root spawn: guard + configured model/effort injected on a non-full fork", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "kiro/claude-opus-4.6", effort: "high", promptOverride: null },
  });
  const out = runSpawnAttachHook(
    spawnPayloadAt(cwd, { task_name: "explorer_task", fork_turns: "none", message: "review the frontend diff" }),
  );
  const ui = updatedInputOf(out);
  assert.equal(ui.task_name, "explorer_task");
  assert.equal(ui.fork_turns, "none");
  // WP2 cr3: a mention-less V2 message now carries the self-load affordance too.
  assert.equal(
    ui.message,
    `${LEAF_GUARD_BLOCK}\n\nreview the frontend diff\n\n${skillAffordanceBlock(SKILLS_DIR)}`,
  );
  // 260710 parity: v2 spawns now honor .codexclaw/subagents.json like v1 (the
  // "review" keyword routes this explorer spawn to the reviewer role, which has
  // no config here, so the explorer config does NOT apply — assert via a
  // non-review message instead below; this payload keeps the explorer wording).
  assert.doesNotMatch(ui.message as string, /Load and follow/);
});

test("v2 model+effort routing: injected independently on fork_turns none/integer", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "kiro/claude-opus-4.6", effort: "high", promptOverride: null },
  });
  for (const fork of ["none", "3"]) {
    const ui = updatedInputOf(
      runSpawnAttachHook(spawnPayloadAt(cwd, { task_name: "t", fork_turns: fork, message: "map the frontend codebase" })),
    );
    assert.equal(ui.model, "kiro/claude-opus-4.6", `fork_turns=${fork}`);
    assert.equal(ui.reasoning_effort, "high", `fork_turns=${fork}`);
  }
});

test("v2 full-history fork (omitted or all) skips model/effort but still guards", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "kiro/claude-opus-4.6", effort: "high", promptOverride: null },
  });
  for (const toolInput of [
    { task_name: "t", message: "map the frontend codebase" },
    { task_name: "t", fork_turns: "all", message: "map the frontend codebase" },
  ]) {
    const ui = updatedInputOf(runSpawnAttachHook(spawnPayloadAt(cwd, toolInput)));
    assert.ok((ui.message as string).startsWith(`${LEAF_GUARD_BLOCK}\n\n`));
    assert.ok(!("model" in ui));
    assert.ok(!("reasoning_effort" in ui));
  }
});

test("independent field routing: caller model keeps configured effort injection and vice versa", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "kiro/claude-opus-4.6", effort: "high", promptOverride: null },
  });
  // caller picked model -> only effort injected
  const a = updatedInputOf(
    runSpawnAttachHook(spawnPayloadAt(cwd, { task_name: "t", fork_turns: "none", model: "gpt-5.5", message: "map it" })),
  );
  assert.equal(a.model, "gpt-5.5");
  assert.equal(a.reasoning_effort, "high");
  // caller picked effort -> only model injected
  const b = updatedInputOf(
    runSpawnAttachHook(
      spawnPayloadAt(cwd, { task_name: "t", fork_turns: "none", reasoning_effort: "low", message: "map it" }),
    ),
  );
  assert.equal(b.model, "kiro/claude-opus-4.6");
  assert.equal(b.reasoning_effort, "low");
});

test("default-mode role with configured effort injects effort only", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "default", model: null, effort: "high", promptOverride: null },
  });
  const ui = updatedInputOf(
    runSpawnAttachHook(spawnPayloadAt(cwd, { task_name: "t", fork_turns: "none", message: "map it" })),
  );
  assert.ok(!("model" in ui));
  assert.equal(ui.reasoning_effort, "high");
});

test("v2 leaf guard: marker dedupes guard on root spawn", () => {
  // WP2 cr3: the guard dedupes, but the mention-less V2 message still gains the
  // affordance block — so the hook emits an envelope (guard NOT duplicated).
  const marked = runSpawnAttachHook(spawnPayload({ task_name: "t", message: `${LEAF_GUARD_MARKER} already guarded` }));
  const ui = updatedInputOf(marked);
  assert.equal((ui.message as string).match(/\[CXC-LEAF-GUARD\]/g)?.length, 1, "guard deduped");
  assert.ok((ui.message as string).includes(SKILL_AFFORDANCE_MARKER));
  // Both markers present -> a second pass is a full no-op.
  assert.equal(runSpawnAttachHook(spawnPayload({ task_name: "t", message: ui.message as string })), "");
});

test("recursion grant token keeps non-recursion leaf constraints", () => {
  const message = `${SUBSPAWN_TOKEN} coordinator task`;
  const ui = updatedInputOf(runSpawnAttachHook(spawnPayload({ task_name: "t", message })));
  assert.equal(
    ui.message,
    `${LEAF_GUARD_BLOCK_COORDINATOR}\n\n${message}\n\n${skillAffordanceBlock(SKILLS_DIR)}`,
  );
  assert.match(ui.message as string, /Do NOT run cxc orchestrate, cxc loop, or goal commands/);
  assert.match(ui.message as string, /Stay inside the task's stated\nfile\/write scope/);
  assert.doesNotMatch(ui.message as string, /Do NOT spawn/);
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

test("v1 mention normalization composes with guard, model routing, and effort", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "kiro/claude-opus-4.6", effort: "high", promptOverride: null },
  });
  const out = runSpawnAttachHook(
    spawnPayloadAt(cwd, { message: "$cxc-dev map the frontend codebase", agent_type: "explorer", trace_id: "keep" }),
  );
  const ui = updatedInputOf(out);
  assert.equal(ui.model, "kiro/claude-opus-4.6");
  assert.ok((ui.message as string).startsWith(`${V1_SCOPE_BLOCK}\n\n`));
  assert.match(ui.message as string, /\[\$cxc-dev\]\(skill:\/\//);
  assert.ok((ui.message as string).endsWith(" map the frontend codebase"));
  assert.equal(ui.trace_id, "keep");
  assert.equal(ui.reasoning_effort, "high", "260710 parity: configured effort is injected");
});

test("v1 model routing: caller-picked model wins", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "kiro/claude-opus-4.6", promptOverride: null },
  });
  const out = runSpawnAttachHook(
    spawnPayloadAt(cwd, { message: "map the codebase", agent_type: "explorer", model: "gpt-5.5" }),
  );
  const ui = updatedInputOf(out);
  assert.equal(ui.model, "gpt-5.5", "caller-picked model wins");
  assert.ok(!("reasoning_effort" in ui), "no configured effort -> none injected");
  assert.ok((ui.message as string).startsWith(`${V1_SCOPE_BLOCK}\n\n`));
});

test("v1 model routing: default mode injects no model; guard still applies", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "default", model: null, effort: "high", promptOverride: null },
  });
  const ui = updatedInputOf(
    runSpawnAttachHook(spawnPayloadAt(cwd, { message: "map the codebase", agent_type: "explorer" })),
  );
  assert.ok(!("model" in ui));
  assert.equal(ui.reasoning_effort, "high");
  const noConfig = updatedInputOf(runSpawnAttachHook(spawnPayload({ message: "map the codebase", agent_type: "explorer" })));
  assert.ok(!("model" in noConfig));
  assert.ok(!("reasoning_effort" in noConfig));
  assert.ok((noConfig.message as string).startsWith(`${V1_SCOPE_BLOCK}\n\n`));
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
  assert.equal(ui.message, `${V1_SCOPE_BLOCK}\n\nimplement it`);
  assert.ok(Array.isArray(ui.items));
});

test("v1 full-history fork skips model/effort but still guards", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "gpt-5.5", effort: "high", promptOverride: null },
  });
  const out = runSpawnAttachHook(
    spawnPayloadAt(cwd, { message: "summarize this thread", agent_type: "explorer", fork_context: true }),
  );
  const ui = updatedInputOf(out);
  assert.ok(!("model" in ui));
  assert.ok(!("reasoning_effort" in ui));
  assert.ok((ui.message as string).startsWith(`${V1_SCOPE_BLOCK}\n\n`));
});

test("v1 spawns receive V1_SCOPE_BLOCK, not LEAF_GUARD_BLOCK", () => {
  const ui = updatedInputOf(
    runSpawnAttachHook(spawnPayload({ agent_type: "worker", message: "implement it" })),
  );
  assert.ok((ui.message as string).startsWith(`${V1_SCOPE_BLOCK}\n\n`));
  assert.ok((ui.message as string).includes(SCOPE_GUARD_MARKER));
  assert.ok(!(ui.message as string).includes(LEAF_GUARD_MARKER));
});

test("v2 spawns still receive LEAF_GUARD_BLOCK", () => {
  const ui = updatedInputOf(
    runSpawnAttachHook(spawnPayload({ task_name: "t", fork_turns: "none", message: "implement it" })),
  );
  assert.ok((ui.message as string).startsWith(`${LEAF_GUARD_BLOCK}\n\n`));
});

test("v1 coordinator receives V1_SCOPE_BLOCK_COORDINATOR", () => {
  const message = `${SUBSPAWN_TOKEN} coordinate this task`;
  const ui = updatedInputOf(
    runSpawnAttachHook(spawnPayload({ agent_type: "worker", message })),
  );
  assert.equal(ui.message, `${V1_SCOPE_BLOCK_COORDINATOR}\n\n${message}`);
});

test("promptOverride is injected between guard and task for configured role", () => {
  const promptOverride = "Always use TypeScript strict mode.";
  const cwd = workspaceWithConfig({
    executor: { mode: "default", model: null, promptOverride },
  });
  const ui = updatedInputOf(
    runSpawnAttachHook(spawnPayloadAt(cwd, { agent_type: "worker", message: "implement it" })),
  );
  assert.equal(ui.message, `${V1_SCOPE_BLOCK}\n\n${promptOverride}\n\nimplement it`);
});

test("promptOverride is NOT injected when null", () => {
  const promptOverride = "Always use TypeScript strict mode.";
  const cwd = workspaceWithConfig({
    executor: { mode: "default", model: null, promptOverride: null },
  });
  const ui = updatedInputOf(
    runSpawnAttachHook(spawnPayloadAt(cwd, { agent_type: "worker", message: "implement it" })),
  );
  assert.ok(!(ui.message as string).includes(promptOverride));
});

test("promptOverride IS injected on full-history forks (message text, not a rejected field)", () => {
  const promptOverride = "Always use TypeScript strict mode.";
  const cwd = workspaceWithConfig({
    executor: { mode: "default", model: null, promptOverride },
  });
  const ui = updatedInputOf(
    runSpawnAttachHook(
      spawnPayloadAt(cwd, { agent_type: "worker", fork_context: true, message: "implement it" }),
    ),
  );
  // promptOverride modifies message text (like guards/affordances), not a separate
  // JSON field. codex-rs only rejects model/reasoning_effort on full-history forks,
  // not message changes. So promptOverride must still be injected.
  assert.ok((ui.message as string).includes(promptOverride));
});

test("promptOverride is injected on v2 spawns too", () => {
  const promptOverride = "Always use TypeScript strict mode.";
  const cwd = workspaceWithConfig({
    explorer: { mode: "default", model: null, promptOverride },
  });
  const ui = updatedInputOf(
    runSpawnAttachHook(
      spawnPayloadAt(cwd, { task_name: "t", fork_turns: "none", message: "implement it" }),
    ),
  );
  assert.ok((ui.message as string).startsWith(`${LEAF_GUARD_BLOCK}\n\n${promptOverride}\n\nimplement it`));
});

test("v1 subagent-issued spawn is denied without the token (D1 parity)", () => {
  const out = runSpawnAttachHook(subagentSpawnPayload({ message: "spawn a helper" }));
  const parsed = JSON.parse(out);
  assert.equal(parsed.hookSpecificOutput.permissionDecision, "deny");
  assert.match(parsed.hookSpecificOutput.permissionDecisionReason, /LEAF-TOPOLOGY-01/);
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

test("isSpawnToolName / isCollaborationToolName accept native V2 hook names", () => {
  assert.ok(isSpawnToolName("spawn_agent"));
  assert.ok(isSpawnToolName("collaborationspawn_agent"));
  assert.ok(isSpawnToolName("collaboration.spawn_agent"));
  assert.ok(!isSpawnToolName("shell"));
  assert.ok(!isSpawnToolName("multi_agent_v1.spawn_agent"));
  assert.ok(!isCollaborationToolName("spawn_agent"));
  assert.ok(isCollaborationToolName("collaborationspawn_agent"));
});

test("collaboration hook name is treated as V2: inline + guard on a marker-less payload", () => {
  const out = runSpawnAttachHook(
    JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: "collaborationspawn_agent",
      cwd: tempCwd("cxc-collab-"),
      tool_input: { task_name: "t", fork_turns: "none", message: "use $cxc-dev for this" },
    }),
  );
  const ui = updatedInputOf(out);
  assert.ok((ui.message as string).startsWith(`${LEAF_GUARD_BLOCK}\n\n`));
  assert.ok((ui.message as string).includes(`${INLINE_SKILL_OPEN}dev">`), "SKILL.md body inlined for V2");
});

test("inlineSkillBodies: appends one block per recognized folder, dedupes repeats", () => {
  const msg = "load $cxc-dev then $cxc-dev again";
  const out = inlineSkillBodies(msg, SKILLS_DIR);
  assert.ok(out.startsWith(msg));
  assert.equal(out.split(`${INLINE_SKILL_OPEN}dev">`).length - 1, 1);
  assert.match(out, /<\/skill>\s*$/);
});

test("inlineSkillBodies: unknown folders and mention-free messages are untouched", () => {
  assert.equal(inlineSkillBodies("no mentions here", SKILLS_DIR), "no mentions here");
  assert.equal(inlineSkillBodies("$cxc-does-not-exist", SKILLS_DIR), "$cxc-does-not-exist");
});

test("inlineSkillBodies: already-inlined folder is not duplicated", () => {
  const once = inlineSkillBodies("use $cxc-dev", SKILLS_DIR);
  const twice = inlineSkillBodies(once, SKILLS_DIR);
  assert.equal(twice, once);
});

test("inlineSkillBodies: atomic overflow appends nothing when bodies would exceed the cap", () => {
  // A message just under the 256 KiB cap: any real body pushes it over -> unchanged.
  const nearCap = `${"x".repeat(256 * 1024 - 40)}\nuse $cxc-dev`;
  assert.equal(inlineSkillBodies(nearCap, SKILLS_DIR), nearCap);
});

test("inlineSkillBodies: an unclosed skill tag does not suppress the real attachment", () => {
  // Crafted unclosed opener for "dev": it is plain text, so the $cxc-dev mention
  // still pulls in the genuine body (C-gate r1 F1).
  const msg = `<skill name="cxc-dev">\nuse $cxc-dev now`;
  const out = inlineSkillBodies(msg, SKILLS_DIR);
  assert.notEqual(out, msg, "real body must still be attached");
  assert.match(out, /<\/skill>\s*$/);
});

test("inlineSkillBodies: mentions inside an unclosed block still count; closed blocks dedupe", () => {
  const closed = inlineSkillBodies("use $cxc-dev", SKILLS_DIR);
  // A mention inside a CLOSED dev block does not re-attach dev.
  assert.equal(inlineSkillBodies(closed, SKILLS_DIR), closed);
  // A malformed opener without the `">` shape is plain text and never dedupes.
  const malformed = `<skill name="cxc-dev broken\nuse $cxc-dev`;
  const repaired = inlineSkillBodies(malformed, SKILLS_DIR);
  assert.ok(repaired.includes(`${INLINE_SKILL_OPEN}dev">`));
});

test("inlineSkillBodies: oversized input passes through untouched (early guard)", () => {
  const huge = `${"y".repeat(256 * 1024 + 10)} $cxc-dev`;
  assert.equal(inlineSkillBodies(huge, SKILLS_DIR), huge);
});

test("inlineSkillBodies: adversarial delimiter floods stay linear-time (scaling check)", () => {
  // C-gate r3: the worst case is BALANCED nesting (all openers, then all closers)
  // — a per-transition suffix re-search is quadratic there. Assert SCALING with
  // both samples well below MAX_NORMALIZE_LENGTH: 2k vs 8k balanced blocks is 4x
  // input; quadratic would be ~16x time, near-linear stays well under 10x.
  const timeFor = (n) => {
    const flood = `${`<skill name="cxc-dev">`.repeat(n)}${`</skill>`.repeat(n)} $cxc-search`;
    assert.ok(flood.length < 256 * 1024, `sample n=${n} must stay under the cap`);
    const started = process.hrtime.bigint();
    const out = inlineSkillBodies(flood, SKILLS_DIR);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    assert.ok(out.includes(`${INLINE_SKILL_OPEN}search">`), "search still attaches (outside the blocks)");
    return elapsedMs;
  };
  timeFor(500); // warmup
  const t2 = Math.max(timeFor(2000), 0.5);
  const t8 = timeFor(8000);
  assert.ok(t8 / t2 < 10, `4x balanced input must stay near-linear (got ${t2.toFixed(1)}ms -> ${t8.toFixed(1)}ms)`);

  // Unclosed-opener flood keeps its own regression: linear via single-append.
  const unclosed = `${`<skill name="cxc-dev">`.repeat(6000)} $cxc-search`;
  assert.ok(unclosed.length < 256 * 1024);
  const started = process.hrtime.bigint();
  const out = inlineSkillBodies(unclosed, SKILLS_DIR);
  const unclosedMs = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(unclosedMs < 500, `unclosed flood must stay fast (got ${unclosedMs.toFixed(1)}ms)`);
  assert.ok(out.includes(`${INLINE_SKILL_OPEN}search">`), "search still attaches after unclosed flood");
});

test("inlineSkillBodies: nested closed blocks hide their whole interior from scanning", () => {
  // A closed dev block CONTAINING a nested closed block whose interior mentions
  // $cxc-loop: nothing inside the outer block may trigger an attachment.
  const nested = [
    `${INLINE_SKILL_OPEN}dev">`,
    `outer body`,
    `${INLINE_SKILL_OPEN}search">`,
    `inner body mentioning $cxc-loop`,
    `</skill>`,
    `outer tail also mentioning $cxc-loop`,
    `</skill>`,
    `no outside mentions`,
  ].join("\n");
  assert.equal(inlineSkillBodies(nested, SKILLS_DIR), nested, "interior mentions must not attach");
});

test("same-intent v1/v2 spawns produce surface-appropriate effective payloads", () => {
  const cwd = workspaceWithConfig({
    explorer: { mode: "model", model: "kiro/claude-opus-4.6", effort: "high", promptOverride: null },
  });
  const intent = "map the frontend codebase with $cxc-dev";
  const v1 = updatedInputOf(
    runSpawnAttachHook(spawnPayloadAt(cwd, { message: intent, agent_type: "explorer" })),
  );
  const v2 = updatedInputOf(
    runSpawnAttachHook(spawnPayloadAt(cwd, { task_name: "map_fe", fork_turns: "none", message: intent })),
  );
  // Same model + effort routing on both surfaces.
  assert.equal(v1.model, v2.model);
  assert.equal(v1.reasoning_effort, v2.reasoning_effort);
  // Each surface carries its appropriate guard.
  assert.ok((v1.message as string).startsWith(`${V1_SCOPE_BLOCK}\n\n`));
  assert.ok((v2.message as string).startsWith(`${LEAF_GUARD_BLOCK}\n\n`));
  // Skill delivery: v1 keeps the parseable mention link (upstream injects); v2
  // additionally inlines the body (upstream never parses v2 spawn messages).
  assert.match(v1.message as string, /\[\$cxc-dev\]\(skill:\/\//);
  assert.ok((v2.message as string).includes(`${INLINE_SKILL_OPEN}dev">`));
});

test("v2 affordance: appended only when inlining attached nothing", () => {
  // Doctrine bodies QUOTE the bare marker, so absence must be asserted on the
  // block's opening line, not the marker alone.
  const affordanceOpening = skillAffordanceBlock(SKILLS_DIR).split("\n")[0];
  // Mentions inlined -> no affordance.
  const inlined = updatedInputOf(
    runSpawnAttachHook(spawnPayload({ task_name: "t", fork_turns: "none", message: "use $cxc-dev" })),
  );
  assert.ok((inlined.message as string).includes(`${INLINE_SKILL_OPEN}dev">`));
  assert.ok(!(inlined.message as string).includes(affordanceOpening));
  // No mentions (ciphertext-like opaque text) -> affordance appended after the task text.
  const opaque = updatedInputOf(
    runSpawnAttachHook(spawnPayload({ task_name: "t", fork_turns: "none", message: "gAAAAABopaquetoken" })),
  );
  assert.ok((opaque.message as string).includes(SKILL_AFFORDANCE_MARKER));
  assert.ok((opaque.message as string).startsWith(`${LEAF_GUARD_BLOCK}\n\n`), "guard stays first");
  assert.ok(
    (opaque.message as string).indexOf("gAAAAABopaquetoken") <
      (opaque.message as string).indexOf(SKILL_AFFORDANCE_MARKER),
    "affordance rides after the task text",
  );
});

test("v1 spawns never get the affordance (upstream parses mentions there)", () => {
  const ui = updatedInputOf(runSpawnAttachHook(spawnPayload({ message: "no mentions here", agent_type: "explorer" })));
  assert.ok(!(ui.message as string).includes(SKILL_AFFORDANCE_MARKER));
});

test("v2 affordance: oversized message skips the affordance (size guard)", () => {
  const nearCap = "x".repeat(256 * 1024 - 100);
  const out = runSpawnAttachHook(spawnPayload({ task_name: "t", message: nearCap }));
  // Guard prepend may still fire via updatedInput; the affordance must not
  // push past the cap — assert the marker is absent.
  if (out !== "") {
    const ui = updatedInputOf(out);
    assert.ok(!(ui.message as string).includes(SKILL_AFFORDANCE_MARKER));
  }
});

test("skillAffordanceBlock names the skills dir and the mention forms", () => {
  const block = skillAffordanceBlock(SKILLS_DIR);
  assert.ok(block.startsWith(SKILL_AFFORDANCE_MARKER));
  assert.ok(block.includes(`${SKILLS_DIR}/<name>/SKILL.md`));
  assert.ok(block.includes("$codexclaw:cxc-<name>"));
});
