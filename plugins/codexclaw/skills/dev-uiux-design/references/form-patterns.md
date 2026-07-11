# Form Design Patterns

Validation timing, multi-step wizards, auth forms, file upload, and search/filter.

## 1. Validation Timing

| Strategy | When | Use For |
|----------|------|---------|
| **On blur** (default) | User leaves the field | Most fields — email, name, phone |
| **On submit** | Form is submitted | Short forms (≤ 4 fields), payment |
| **Real-time** | As user types, debounced 300ms | Username availability, search |
| **On blur + on change after first error** | First error on blur, subsequent on keystroke | Long forms |

- Never show errors on empty fields before first interaction
- Error appears below the field, not in a top-level alert
- Error state: red border + error icon + message text (never color alone)
- Success state: green check on field, NOT green border (a11y)
- Clear error when user starts correcting

## Multi-Step Form (Wizard)

```
Step Indicator (1/3, 2/3, 3/3)
├── Step Title
├── Fields for this step
├── [Back] [Next / Submit]
└── Progress bar (optional)
```

- Step indicator always visible (horizontal bar or numbered pills)
- Back button preserves all entered data
- Validate current step before allowing Next
- Final step shows summary before Submit
- Save partial state to sessionStorage (refresh-safe)
- Mobile: full-width steps, no horizontal scroll for indicator
- Max 5 steps — break longer flows into separate forms

## Auth / Password Forms

### Sign In

```
[Email / Username]
[Password] [Show/Hide toggle]
[Forgot password?]
[Sign In]
[— or —]
[Social login buttons]
```

### Sign Up

```
[Email]
[Password] [Strength meter below]
[Confirm password]
[Terms checkbox]
[Sign Up]
```

- Show/hide toggle as icon button inside the password field
- Strength meter: visual bar (red → yellow → green) + text label
  - Weak: < 8 chars or common password
  - Medium: 8+ chars, mixed case
  - Strong: 12+ chars, mixed case + number + symbol
- Never disable paste on password fields
- `autocomplete`: `username`, `current-password`, `new-password`
- Passkey/WebAuthn: offer as primary when supported
- Wrong credentials: "Invalid email or password" (never reveal which)

## File Upload

```
[Drop zone: dashed border, icon, "Drag files here or click"]
[File list: name, size, progress bar, remove]
```

- `accept` attribute: specify allowed types
- Max file size visible in drop zone text
- Individual progress bar per file
- Preview: thumbnails for images, icon + filename for documents
- Failed files: red highlight + retry button
- Multiple files: drag handles if order matters
- Drop zone is `<button>` or `role="button"`, keyboard-activatable
- Mobile: tap opens file picker, camera option for images

## Search / Filter

Filter dropdowns, sort menus, and search comboboxes use the project's unified
dropdown design layer (`dev-frontend` `dropdown-layer.md`
FE-DROPDOWN-LAYER-01): one skin, behavior-correct primitive per pattern.

```
[Search input + icon]
[Filter pills / dropdown] [Active filter count]
[Results count: "42 results"]
[Clear all filters]
```

- Debounce search input 300ms before querying
- Empty: show suggestions or recent searches
- Filter state reflected in URL query params (shareable, back-button works)
- Loading: skeleton results, not blank screen
- No results: helpful message + suggest clearing filters

## Pre-flight

- [ ] Validation uses on-blur timing by default
- [ ] Error messages appear below the relevant field
- [ ] Password fields have show/hide toggle and `autocomplete`
- [ ] Multi-step forms preserve data on back/refresh
- [ ] File uploads show individual progress and support drag-and-drop

## Cross-references

- Mobile form rules: `dev-frontend/references/core/mobile-ux.md`
- Validation UX states: `ux-states.md` §9
- Schema validation: `dev-frontend/SKILL.md` §10 (Zod + react-hook-form)
