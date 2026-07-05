/**
 * sources.ts — remote source adapters (WP3 / 040). Each adapter fetches ONE
 * cheap catalog document (raw.githubusercontent, no API rate limit) and
 * normalizes it into SkillRow[]. The GitHub tree API is used only for clawhub
 * (13 skills; single call) and the `gh` CLI path lives in cli.ts because it
 * shells out instead of fetching.
 */


export const JAW_REGISTRY_URL =
  "https://raw.githubusercontent.com/lidge-jun/cli-jaw-skills/main/registry.json";
export const JAW_RAW_BASE = "https://raw.githubusercontent.com/lidge-jun/cli-jaw-skills/main";
export const HERMES_CATALOG_URL =
  "https://raw.githubusercontent.com/NousResearch/hermes-agent/main/website/docs/reference/skills-catalog.md";
export const HERMES_RAW_BASE = "https://raw.githubusercontent.com/NousResearch/hermes-agent/main/skills";
export const CLAWHUB_TREE_URL =
  "https://api.github.com/repos/openclaw/clawhub/git/trees/main?recursive=1";
export const CLAWHUB_RAW_BASE = "https://raw.githubusercontent.com/openclaw/clawhub/main";

/** cli-jaw-skills registry.json -> rows. Ground truth cleaned in WP2. */
export async function fetchJawRows(fetchText           )                      {
  const parsed = JSON.parse(await fetchText(JAW_REGISTRY_URL))

   ;
  const skills = parsed.skills ?? {};
  const rows             = [];
  for (const [id, meta] of Object.entries(skills)) {
    const entry = typeof meta.entry === "string" ? meta.entry : `${id}/SKILL.md`;
    rows.push({
      id,
      source: "jaw",
      name: typeof meta.name === "string" ? meta.name : id,
      description: typeof meta.description === "string" ? meta.description : "",
      descriptionKo: typeof meta.desc_ko === "string" ? meta.desc_ko : undefined,
      category: typeof meta.category === "string" ? meta.category : undefined,
      rawUrl: `${JAW_RAW_BASE}/${entry}`,
      supersededBy: typeof meta.superseded_by === "string" ? meta.superseded_by : undefined,
      status: typeof meta.status === "string" ? meta.status : undefined,
      requires: normalizeRequires(meta.requires),
    });
  }
  return rows;
}

function normalizeRequires(raw         )                       {
  if (!raw || typeof raw !== "object") return undefined;
  const rec = raw                           ;
  const pick = (k        )                       =>
    Array.isArray(rec[k]) ? (rec[k]            ).filter((x) => typeof x === "string") : undefined;
  const bins = pick("bins");
  const env = pick("env");
  const system = pick("system");
  if (!bins && !env && !system) return undefined;
  return { bins, env, system };
}

/**
 * Hermes bundled-skills catalog markdown -> rows. Table lines look like:
 * `| [`apple-notes`](/docs/...) | Manage Apple Notes... | `apple/apple-notes` |`
 * The trailing path column maps onto skills/<path>/SKILL.md in the repo.
 */
export async function fetchHermesRows(fetchText           )                      {
  const md = await fetchText(HERMES_CATALOG_URL);
  const rows             = [];
  const line = /^\|\s*\[`([^`]+)`\]\([^)]*\)\s*\|\s*(.+?)\s*\|\s*`([^`]+)`\s*\|\s*$/;
  for (const l of md.split("\n")) {
    const m = line.exec(l.trim());
    if (!m) continue;
    const [, id, description, path] = m;
    rows.push({
      id,
      source: "hermes",
      name: id,
      description,
      category: path.includes("/") ? path.split("/")[0] : undefined,
      rawUrl: `${HERMES_RAW_BASE}/${path}/SKILL.md`,
    });
  }
  return rows;
}

/** ClawHub repo tree -> rows (13 skills under .agents/skills/). One API call. */
export async function fetchClawhubRows(fetchText           )                      {
  const parsed = JSON.parse(await fetchText(CLAWHUB_TREE_URL))

   ;
  const rows             = [];
  for (const node of parsed.tree ?? []) {
    const path = node.path ?? "";
    if (!path.endsWith("/SKILL.md")) continue;
    const dir = path.slice(0, -"/SKILL.md".length);
    const id = dir.split("/").pop() ?? dir;
    rows.push({
      id,
      source: "clawhub",
      name: id,
      description: dir, // tree API gives no description; path is the searchable text
      rawUrl: `${CLAWHUB_RAW_BASE}/${path}`,
    });
  }
  return rows;
}
