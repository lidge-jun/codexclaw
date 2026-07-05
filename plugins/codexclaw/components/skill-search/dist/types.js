/**
 * types.ts — shared row shape for the remote dormant-skill search (WP3 / 040).
 *
 * A SkillRow is the normalized search unit every source adapter emits. `rawUrl`
 * always points at a raw SKILL.md so an agent can fetch and load the body in
 * one step; `superseded_by` / `status` are ranking hints carried over from the
 * cli-jaw-skills registry cleanup (WP2).
 */

















/** Injected fetch shape so tests can run without a network. */

