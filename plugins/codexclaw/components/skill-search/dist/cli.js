/**
 * cli.ts — `cxc skill <search|show>` entry (WP3 / 040).
 *
 * Remote-first: no local vendoring. Sources: jaw (default; cli-jaw-skills
 * registry raw), hermes (bundled-skills catalog raw), clawhub (single tree API
 * call), gh (explicit only; shells out to the gh CLI). Catalogs are cached
 * 1h under $CODEXCLAW_HOME ?? ~/.codexclaw/skill-cache with stale fallback.
 *
 * argv (after the bin dispatcher strips "skill"):
 *   search <query...> [--source jaw|hermes|clawhub|gh|all] [--limit N] [--json] [--refresh]
 *   show <id> [--source jaw|hermes|clawhub] [--json] [--refresh]
 */
import { spawnSync } from "node:child_process";
import { cachedFetchText } from "./cache.js";
import { ADAPTER_PREAMBLE, SEARCH_FOOTER } from "./preamble.js";
import { rank } from "./scoring.js";
import { fetchHermesRows, fetchJawRows, searchClawhubRows } from "./sources.js";


const USAGE =
  "cxc skill <search <query...> [--source jaw|hermes|clawhub|gh|all] [--limit N] [--json] [--refresh] | show <id> [--source ...]>";









export function parseFlags(argv          )        {
  const flags        = { source: "jaw", limit: 10, json: false, refresh: false, rest: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--source" && argv[i + 1]) flags.source = argv[++i];
    else if (a === "--limit" && argv[i + 1]) flags.limit = Math.max(1, Number(argv[++i]) || 10);
    else if (a === "--json") flags.json = true;
    else if (a === "--refresh") flags.refresh = true;
    else flags.rest.push(a);
  }
  return flags;
}

const realFetch            = async (url) => {
  const res = await fetch(url, { headers: { "user-agent": "codexclaw-skill-search" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
};

async function loadSource(
  source                  ,
  refresh         ,
  fetchText           ,
)                      {
  // Cache the raw catalog text (not the parsed rows) so parser fixes apply to
  // cached content without a refetch.
  const loaders                                                        = {
    jaw: fetchJawRows,
    hermes: fetchHermesRows,
  };
  const loader = loaders[source];
  const cachingFetch            = async (url) => {
    const key = `${source}-${Buffer.from(url).toString("base64url").slice(0, 24)}`;
    const { text } = await cachedFetchText(key, () => fetchText(url), { refresh });
    return text;
  };
  return loader(cachingFetch);
}

/** ClawHub is query-time marketplace search: no catalog cache, server ranks. */
async function searchClawhub(query        , limit        , fetchText           )                       {
  const rows = await searchClawhubRows(fetchText, query);
  return rows.slice(0, limit).map((row, i) => ({ ...row, score: rows.length - i }));
}

function ghSearch(query        , limit        )              {
  const res = spawnSync(
    "gh",
    ["search", "code", `filename:SKILL.md ${query}`, "--limit", String(limit), "--json", "repository,path"],
    { encoding: "utf8" },
  );
  if (res.status !== 0 || !res.stdout) {
    process.stderr.write(
      `skill-search: gh code search unavailable (${res.stderr?.trim() || "gh CLI missing or not authenticated"})\n`,
    );
    return [];
  }
  try {
    const items = JSON.parse(res.stdout)


      ;
    return items.map((it, i) => {
      const repo = it.repository?.nameWithOwner ?? "unknown";
      const path = it.path ?? "SKILL.md";
      const dir = path.replace(/\/?SKILL\.md$/, "");
      return {
        id: dir.split("/").pop() || repo,
        source: "gh"         ,
        name: `${repo}:${dir}`,
        description: `GitHub code search hit in ${repo}`,
        rawUrl: `https://raw.githubusercontent.com/${repo}/HEAD/${path}`,
        score: items.length - i,
      };
    });
  } catch {
    return [];
  }
}

function renderRows(rows             , json         )         {
  if (json) return JSON.stringify(rows, null, 2);
  if (rows.length === 0) return "no matching skills";
  const lines = rows.map((r) => {
    const marks           = [];
    if (r.supersededBy) marks.push(`-> use ${r.supersededBy} (active)`);
    if (r.status) marks.push(`[${r.status}]`);
    if (r.requires?.bins?.length) marks.push(`bins: ${r.requires.bins.join(",")}`);
    const suffix = marks.length ? `  ${marks.join(" ")}` : "";
    const desc = r.description.length > 120 ? `${r.description.slice(0, 117)}...` : r.description;
    return `${r.id} (${r.source}, ${r.score})${suffix}\n  ${desc}\n  ${r.rawUrl}`;
  });
  return `${lines.join("\n")}\n${SEARCH_FOOTER}`;
}

export async function main(argv          , fetchText            = realFetch)                  {
  const cmd = argv[0];
  const flags = parseFlags(argv.slice(1));

  if (cmd === "search") {
    const query = flags.rest.join(" ").trim();
    if (!query) {
      process.stdout.write(`${USAGE}\n`);
      return 1;
    }
    const wanted =
      flags.source === "all" ? (["jaw", "hermes", "clawhub"]         ) : ([flags.source]         );
    let rows              = [];
    for (const s of wanted) {
      if (s === "gh") {
        rows = rows.concat(ghSearch(query, flags.limit));
      } else if (s === "clawhub") {
        try {
          rows = rows.concat(await searchClawhub(query, flags.limit, fetchText));
        } catch (err) {
          process.stderr.write(
            `skill-search: source clawhub failed (${err instanceof Error ? err.message : String(err)})\n`,
          );
        }
      } else if (s === "jaw" || s === "hermes") {
        try {
          const sourceRows = await loadSource(s, flags.refresh, fetchText);
          rows = rows.concat(rank(sourceRows, query, flags.limit));
        } catch (err) {
          process.stderr.write(
            `skill-search: source ${s} failed (${err instanceof Error ? err.message : String(err)})\n`,
          );
        }
      } else {
        process.stderr.write(`skill-search: unknown source "${s}"\n`);
        return 1;
      }
    }
    rows.sort((a, b) => b.score - a.score);
    process.stdout.write(`${renderRows(rows.slice(0, flags.limit), flags.json)}\n`);
    return 0;
  }

  if (cmd === "show") {
    const id = flags.rest[0];
    if (!id) {
      process.stdout.write(`${USAGE}\n`);
      return 1;
    }
    const wanted =
      flags.source === "all" || flags.source === "gh"
        ? (["jaw", "hermes", "clawhub"]         )
        : ([flags.source]         );
    for (const s of wanted) {
      if (s !== "jaw" && s !== "hermes" && s !== "clawhub") continue;
      let row                      ;
      try {
        row =
          s === "clawhub"
            ? (await searchClawhubRows(fetchText, id)).find((r) => r.id === id)
            : (await loadSource(s, flags.refresh, fetchText)).find((r) => r.id === id);
      } catch {
        continue;
      }
      if (!row) continue;
      // Skill BODIES are fetched fresh (not cached): they change more often
      // than catalogs and a stale body is worse than a second fetch.
      const body = await fetchText(row.rawUrl);
      if (flags.json) {
        process.stdout.write(`${JSON.stringify({ ...row, body, preamble: ADAPTER_PREAMBLE })}\n`);
      } else {
        process.stdout.write(`${ADAPTER_PREAMBLE}\n--- ${row.id} (${row.source}) ${row.rawUrl}\n\n${body}\n`);
      }
      return 0;
    }
    process.stderr.write(`skill-search: no skill "${id}" in source(s) ${wanted.join(",")}\n`);
    return 1;
  }

  process.stdout.write(`${USAGE}\n`);
  return cmd ? 1 : 0;
}

// Direct-exec guard (cxc-ops pattern): run only as a script, not on import.
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`skill-search error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    },
  );
}
