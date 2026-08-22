// Can a resolved shim path actually be spawned? .cmd/.bat go through ComSpec,
// everything else directly.
//   node probes/resolve.mjs "C:\Program Files\nodejs\npm.cmd"
import { spawnSync } from "node:child_process";

const target = process.argv[2];
const isBatch = /\.(cmd|bat)$/i.test(target);

// cmd /s /c strips the OUTER pair of quotes from the whole command line, so a
// path that needs quoting must be wrapped twice: "" "path" args "".
const res = isBatch
  ? spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `""${target}" --version"`], {
      encoding: "utf8",
      windowsVerbatimArguments: true,
    })
  : spawnSync(target, ["--version"], { encoding: "utf8" });

console.log("target=" + target);
console.log("result=" + (res.error ? res.error.code : "exit " + res.status));
console.log("stdout=" + (res.stdout ?? "").trim());
console.log("stderr=" + (res.stderr ?? "").trim().slice(0, 300));
