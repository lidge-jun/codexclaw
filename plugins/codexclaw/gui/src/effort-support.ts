/** Three-state reasoning-effort ladder logic, kept out of the .tsx component so the
 *  node:test suite can import it (node cannot load .tsx).
 *
 *  `supported` carries three distinct meanings and the distinction is load-bearing:
 *  an array is the model's advertised ladder, `undefined` means no model is selected, and
 *  `null` means the source did not advertise a ladder at all — `reasoningEfforts()` in
 *  subagent-config returns null for a non-array. Only an array is evidence that the
 *  model refuses an effort. Folding `null` into `[]` greys out every effort for a model
 *  whose ladder OCX does not report, leaving those models effort-locked. */
export function effortExcluded(supported: readonly string[] | null | undefined, effort: string): boolean {
  return Array.isArray(supported) && !supported.includes(effort);
}
