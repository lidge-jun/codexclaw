#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { prepareResearch } from "./research-adapter.mjs";

const issue = (id, msg) => ({ level: "P0", id, msg });

function parseArguments(args) {
  const issues = [];
  let modelPath = null;
  let metadataPath = null;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--metadata") {
      if (metadataPath !== null || index + 1 >= args.length || args[index + 1].startsWith("--")) {
        issues.push(issue("intake.arguments", "--metadata requires exactly one JSON file"));
      } else {
        metadataPath = args[index + 1];
        index += 1;
      }
    } else if (value.startsWith("--")) {
      issues.push(issue("intake.arguments", `Unknown option: ${value}`));
    } else if (modelPath === null) {
      modelPath = value;
    } else {
      issues.push(issue("intake.arguments", `Unexpected positional argument: ${value}`));
    }
  }
  if (modelPath === null) issues.push(issue("intake.arguments", "Usage: report-intake.mjs <model.json> [--metadata <json>]"));
  return { modelPath, metadataPath, issues };
}

async function readJson(path, id) {
  try {
    const body = await readFile(resolve(path), "utf8");
    return { value: JSON.parse(body), issues: [] };
  } catch (error) {
    const kind = error instanceof SyntaxError ? "valid JSON" : "a readable JSON file";
    return { value: null, issues: [issue(id, `${id} must be ${kind}`)] };
  }
}

export async function runIntake(args) {
  const parsed = parseArguments(args);
  if (parsed.issues.length) return { output: { model: null, receipt: null, issues: parsed.issues }, exitCode: 1 };

  const modelResult = await readJson(parsed.modelPath, "intake.model");
  const metadataResult = parsed.metadataPath === null
    ? { value: {}, issues: [] }
    : await readJson(parsed.metadataPath, "intake.metadata");
  const readIssues = [...modelResult.issues, ...metadataResult.issues];
  if (readIssues.length) return { output: { model: modelResult.value, receipt: null, issues: readIssues }, exitCode: 1 };

  const output = await prepareResearch(modelResult.value, { metadata: metadataResult.value });
  return { output, exitCode: output.issues.length ? 1 : 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await runIntake(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result.output, null, 2)}\n`);
    process.exitCode = result.exitCode;
  } catch {
    process.stdout.write(`${JSON.stringify({ model: null, receipt: null, issues: [issue("intake.internal", "Report intake failed at its local boundary")] }, null, 2)}\n`);
    process.exitCode = 1;
  }
}
