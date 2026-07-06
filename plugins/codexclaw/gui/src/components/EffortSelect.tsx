import { EFFORTS, type EffortName } from "../api.ts";

interface Props {
  value: EffortName | null;
  disabled: boolean;
  onChange: (effort: EffortName | null) => void;
}

/** Reasoning-effort dropdown. "" = inherit the parent session's effort (null).
 *  Values mirror the codex spawn wire enum; an invalid effort would hard-fail
 *  the spawn, so only these are offered. */
export function EffortSelect({ value, disabled, onChange }: Props) {
  return (
    <select
      className="select"
      style={{ maxWidth: "160px" }}
      disabled={disabled}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : (e.target.value as EffortName))}
      aria-label="reasoning effort"
    >
      <option value="">inherit effort</option>
      {EFFORTS.map((eff) => (
        <option key={eff} value={eff}>
          {eff}
        </option>
      ))}
    </select>
  );
}
