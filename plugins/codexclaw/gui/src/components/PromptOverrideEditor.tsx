interface Props {
  value: string | null;
  onChange: (v: string | null) => void;
}

/** Nullable per-role prompt override. Empty text -> null (never fabricated).
 *  Overrides only the role prompt segment, not unrelated system/dev-skill text. */
export function PromptOverrideEditor({ value, onChange }: Props) {
  return (
    <textarea
      className="prompt-editor"
      placeholder="Role prompt override (blank = inherit role skill prompt)"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value.trim() === "" ? null : e.target.value)}
      rows={2}
    />
  );
}
