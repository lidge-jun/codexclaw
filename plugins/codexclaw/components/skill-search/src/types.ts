/**
 * types.ts — shared row shape for the remote dormant-skill search (WP3 / 040).
 *
 * A SkillRow is the normalized search unit every source adapter emits. `rawUrl`
 * always points at a raw SKILL.md so an agent can fetch and load the body in
 * one step; `superseded_by` / `status` are ranking hints carried over from the
 * cli-jaw-skills registry cleanup (WP2).
 */
export interface SkillRow {
  id: string;
  source: "jaw" | "hermes" | "clawhub" | "gh";
  name: string;
  description: string;
  descriptionKo?: string;
  category?: string;
  rawUrl: string;
  supersededBy?: string;
  status?: string;
  requires?: { bins?: string[]; env?: string[]; system?: string[] };
}

export interface ScoredRow extends SkillRow {
  score: number;
}

/** Injected fetch shape so tests can run without a network. */
export type FetchText = (url: string) => Promise<string>;
