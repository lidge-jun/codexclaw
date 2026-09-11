import { EFFORTS, type EffortName } from "../api.ts";
import { effortExcluded } from "../effort-support.ts";

interface Props {
  value: EffortName | null;
  label?: string;
  disabled: boolean;
  supported?: readonly string[] | null;
  onChange: (effort: EffortName | null) => void;
}

/** Reasoning-effort dropdown. "" = inherit the parent session's effort (null).
 *  Values mirror the codex spawn wire enum; an invalid effort would hard-fail
 *  the spawn, so only these are offered.
 *
 *  `supported` is THREE-state and must stay that way: an array is the model's
 *  advertised ladder, `undefined` means no model is selected, and `null` means the
 *  source did not advertise a ladder. Only an array may disable an option — folding
 *  `null` into `[]` would grey out every effort for a model whose ladder OCX does not
 *  report, which is a live state on real rosters. */
export function EffortSelect({ value, disabled, onChange, supported, label = "reasoning effort" }: Props) {
  return (
    <select
      className="select"
      style={{ maxWidth: "160px" }}
      disabled={disabled}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as EffortName))}
      aria-label={label}
    >
      <option value="">session effort</option>
      {EFFORTS.map((eff) => (
        <option key={eff} value={eff} disabled={effortExcluded(supported, eff)}>
          {eff}
        </option>
      ))}
    </select>
  );
}
