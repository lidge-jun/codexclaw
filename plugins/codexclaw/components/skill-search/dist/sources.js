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
export const CLAWHUB_API_BASE = "https://clawhub.ai/api/v1";

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

/**
 * ClawHub marketplace search -> rows. clawhub.ai exposes an unauthenticated
 * registry API (/api/v1/search: slug/displayName/summary; verified live
 * 2026-07-05); a skill body is served by /api/v1/packages/<slug>/file?path=SKILL.md.
 * Query-time search, so this adapter takes the user query instead of a catalog
 * (results are NOT cached: they are per-query and the API is not rate-limited
 * like api.github.com).
 */
export async function searchClawhubRows(fetchText           , query        )                      {
  const url = `${CLAWHUB_API_BASE}/search?q=${encodeURIComponent(query)}&limit=20`;
  const parsed = JSON.parse(await fetchText(url))

   ;
  const rows             = [];
  const seen = new Set        ();
  for (const r of parsed.results ?? []) {
    // The marketplace can return the same slug from multiple owners; keep the
    // first (highest-ranked) since the file endpoint resolves by bare slug.
    if (typeof r.slug !== "string" || r.slug.length === 0 || seen.has(r.slug)) continue;
    seen.add(r.slug);
    rows.push({
      id: r.slug,
      source: "clawhub",
      name: r.displayName ?? r.slug,
      description: r.summary ?? "",
      rawUrl: `${CLAWHUB_API_BASE}/packages/${encodeURIComponent(r.slug)}/file?path=SKILL.md`,
    });
  }
  return rows;
}
