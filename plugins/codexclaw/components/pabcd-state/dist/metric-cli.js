import {
  parseMetricLine,
  readObjectiveKind,
  readObjectiveMetrics,
  recordMetricsFromText,
  recordObjectiveMetric,
  writeObjectiveKind,


} from "./metrics.js";






function usage()                  {
  return {
    code: 1,
    output: [
      "metric: expected one of:",
      "  metric record --session <id> --name <metric> --value <number> [--source operator-entered|evaluate.sh] [--work-phase <id>] [--json]",
      "  metric ingest --session <id> [--source evaluate.sh] [--work-phase <id>] [--json]  # reads METRIC name=value lines from stdin",
      "  metric show --session <id> [--json]",
      "  metric kind --session <id> [satisfy|maximize] [--json]",
    ].join("\n"),
  };
}

function readFlag(argv          , name        )                {
  const idx = argv.indexOf(name);
  if (idx === -1) return null;
  return argv[idx + 1] ?? null;
}

function hasFlag(argv          , name        )          {
  return argv.includes(name);
}

function positionalArgs(argv          )           {
  const out           = [];
  const flagsWithValues = new Set(["--session", "-s", "--name", "--value", "--source", "--work-phase"]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (flagsWithValues.has(arg)) {
      i++;
      continue;
    }
    if (arg.startsWith("-")) continue;
    out.push(arg);
  }
  return out;
}

function readSession(argv          )                {
  return readFlag(argv, "--session") ?? readFlag(argv, "-s");
}

function readSource(argv          , fallback                       )                               {
  const raw = readFlag(argv, "--source") ?? fallback;
  return raw === "operator-entered" || raw === "evaluate.sh" ? raw : null;
}

function parseObjectiveKind(raw               )                       {
  return raw === "satisfy" || raw === "maximize" ? raw : null;
}

function renderJson(value         , json         )         {
  return json ? JSON.stringify(value) : "";
}

export function runMetricCli(argv          , cwd        , stdin = "")                  {
  const verb = argv[0] ?? "";
  const json = hasFlag(argv, "--json");
  const sessionId = readSession(argv);
  if (!sessionId) return { code: 1, output: "metric: --session <id> is required" };

  if (verb === "record") {
    const metricName = readFlag(argv, "--name");
    const rawValue = readFlag(argv, "--value");
    const source = readSource(argv, "operator-entered");
    const workPhaseId = readFlag(argv, "--work-phase") ?? undefined;
    if (!metricName) return { code: 1, output: "metric record: --name <metric> is required" };
    if (!source) return { code: 1, output: "metric record: --source must be operator-entered or evaluate.sh" };
    const value = Number(rawValue);
    if (!rawValue || !Number.isFinite(value)) return { code: 1, output: "metric record: --value <number> is required" };
    const record = recordObjectiveMetric(cwd, { sessionId, metricName, value, source, workPhaseId });
    if (json) return { code: 0, output: JSON.stringify(record) };
    return { code: 0, output: `metric record: ${record.metricName}=${record.value} best=${record.best} source=${record.source}` };
  }

  if (verb === "ingest") {
    const source = readSource(argv, "evaluate.sh");
    const workPhaseId = readFlag(argv, "--work-phase") ?? undefined;
    if (!source) return { code: 1, output: "metric ingest: --source must be operator-entered or evaluate.sh" };
    const records = recordMetricsFromText(cwd, { sessionId, text: stdin, source, workPhaseId });
    if (json) return { code: 0, output: JSON.stringify({ records }) };
    return { code: 0, output: `metric ingest: recorded ${records.length} METRIC line(s)` };
  }

  if (verb === "show") {
    const records = readObjectiveMetrics(cwd, sessionId);
    if (json) return { code: 0, output: JSON.stringify({ sessionId, records }) };
    if (records.length === 0) return { code: 0, output: `metric show: no records for session ${sessionId}` };
    return {
      code: 0,
      output: records.map((r) => `${r.metricName}=${r.value} best=${r.best} source=${r.source} phase=${r.workPhaseId}`).join("\n"),
    };
  }

  if (verb === "kind") {
    const requested = parseObjectiveKind(positionalArgs(argv.slice(1))[0] ?? null);
    if (requested) writeObjectiveKind(cwd, sessionId, requested);
    const kind = readObjectiveKind(cwd, sessionId);
    const payload = { sessionId, kind, explicit: requested ?? null };
    if (json) return { code: 0, output: renderJson(payload, json) };
    return { code: 0, output: `metric kind: ${kind}${requested ? " (explicit)" : ""}` };
  }

  if (verb === "parse-line") {
    const parsed = parseMetricLine(argv.slice(1).join(" "));
    return { code: parsed ? 0 : 1, output: JSON.stringify(parsed) };
  }

  return usage();
}
