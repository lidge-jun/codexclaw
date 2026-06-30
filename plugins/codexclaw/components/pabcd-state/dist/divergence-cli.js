import {
  readDivergenceCandidates,
  readDivergenceMode,
  recordDivergenceCandidate,
  writeDivergenceMode,



} from "./divergence.js";






function usage()                      {
  return {
    code: 1,
    output: [
      "divergence: expected one of:",
      "  divergence mode --session <id> on|off [--cwd <owner-root>] [--collapse P|D] [--reason <text>] [--json]",
      "  divergence candidate add --session <id> [--cwd <owner-root>] --kind strong-1|add-1|alternative --title <text> --rationale <text> --source <url> [--source <url>...] [--status proposed|built|checked|kept|discarded] [--worktree <path>] [--json]",
      "  divergence candidate list --session <id> [--cwd <owner-root>] [--json]",
    ].join("\n"),
  };
}

function readFlag(argv          , name        )                {
  const idx = argv.indexOf(name);
  if (idx === -1) return null;
  return argv[idx + 1] ?? null;
}

function readAllFlags(argv          , name        )           {
  const out           = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === name && argv[i + 1]) out.push(argv[i + 1]);
  }
  return out;
}

function hasFlag(argv          , name        )          {
  return argv.includes(name);
}

function parseCollapse(raw               )                       {
  return raw === "P" || raw === "D" ? raw : null;
}

function parseKind(raw               )                       {
  return raw === "strong-1" || raw === "add-1" || raw === "alternative" ? raw : null;
}

function parseStatus(raw               )                         {
  return raw === "proposed" || raw === "built" || raw === "checked" || raw === "kept" || raw === "discarded" ? raw : null;
}

function readSession(argv          )                {
  return readFlag(argv, "--session") ?? readFlag(argv, "-s");
}

export function runDivergenceCli(argv          , cwd        )                      {
  const cwdOut = readFlag(argv, "--cwd") ?? cwd;
  const topic = argv[0] ?? "";
  const verb = argv[1] ?? "";
  const json = hasFlag(argv, "--json");
  const sessionId = readSession(argv);
  if (!sessionId) return { code: 1, output: "divergence: --session <id> is required" };

  if (topic === "mode") {
    const state = verb === "on" ? true : verb === "off" ? false : null;
    if (state === null) {
      const mode = readDivergenceMode(cwdOut, sessionId);
      if (json) return { code: 0, output: JSON.stringify({ mode }) };
      return { code: 0, output: mode ? `divergence mode: ${mode.active ? "on" : "off"} collapse=${mode.collapsePoint}` : "divergence mode: unset" };
    }
    const collapsePoint = parseCollapse(readFlag(argv, "--collapse")) ?? "D";
    const reason = readFlag(argv, "--reason") ?? (state ? "plateau" : "resolved");
    const mode = writeDivergenceMode(cwdOut, { sessionId, active: state, collapsePoint, reason });
    if (json) return { code: 0, output: JSON.stringify(mode) };
    return { code: 0, output: `divergence mode: ${mode.active ? "on" : "off"} collapse=${mode.collapsePoint}` };
  }

  if (topic === "candidate" && verb === "add") {
    const kind = parseKind(readFlag(argv, "--kind"));
    const status = parseStatus(readFlag(argv, "--status")) ?? "proposed";
    const title = readFlag(argv, "--title");
    const rationale = readFlag(argv, "--rationale");
    const sourceUrls = readAllFlags(argv, "--source");
    if (!kind) return { code: 1, output: "divergence candidate add: --kind strong-1|add-1|alternative is required" };
    if (!title) return { code: 1, output: "divergence candidate add: --title <text> is required" };
    if (!rationale) return { code: 1, output: "divergence candidate add: --rationale <text> is required" };
    if (sourceUrls.length === 0) return { code: 1, output: "divergence candidate add: at least one --source <url> is required" };
    try {
      const candidate = recordDivergenceCandidate(cwdOut, {
        sessionId,
        kind,
        title,
        rationale,
        sourceUrls,
        status,
        worktree: readFlag(argv, "--worktree") ?? undefined,
      });
      if (json) return { code: 0, output: JSON.stringify(candidate) };
      return { code: 0, output: `divergence candidate: ${candidate.id} (${candidate.kind}) sources=${candidate.sourceUrls.length}` };
    } catch (err) {
      return { code: 1, output: `divergence candidate add: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  if (topic === "candidate" && verb === "list") {
    const candidates = readDivergenceCandidates(cwdOut, sessionId);
    if (json) return { code: 0, output: JSON.stringify({ sessionId, candidates }) };
    if (candidates.length === 0) return { code: 0, output: `divergence candidate list: no candidates for session ${sessionId}` };
    return { code: 0, output: candidates.map((c) => `${c.id} ${c.kind} ${c.status} sources=${c.sourceUrls.length}`).join("\n") };
  }

  return usage();
}
