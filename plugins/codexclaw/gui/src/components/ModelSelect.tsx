import type { CatalogEntry } from "../api.ts";

interface Props {
  value: string | null;
  disabled: boolean;
  entries: CatalogEntry[];
  onChange: (model: string | null) => void;
}

/** Model dropdown. The "main model" option (value "") is always selectable,
 *  even when ocx is present. ocx-backed entries are labeled. */
export function ModelSelect({ value, disabled, entries, onChange }: Props) {
  return (
    <select
      className="model-select"
      disabled={disabled}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
      aria-label="model"
    >
      <option value="">main model (default)</option>
      {entries.map((e) => (
        <option key={e.id} value={e.id}>
          {e.label}
        </option>
      ))}
    </select>
  );
}
