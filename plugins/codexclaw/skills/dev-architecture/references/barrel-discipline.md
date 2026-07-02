# Barrel/Re-export Discipline

Last reviewed: 2026-07-02

When barrel files help vs. when they create hidden coupling and break tree-shaking.

---

## When Barrels Are OK

| Context | Why Allowed |
|---------|-------------|
| Public package API (`packages/ui/src/index.ts`) | Consumers need a single stable entry point |
| Framework plugin entry (`my-plugin/index.ts`) | Plugin contract requires single export |
| Monorepo package boundary (`@org/shared/index.ts`) | Cross-package contract, versioned |
| Generated API client entry | Single entry for codegen output |

**Common trait:** The barrel is a PUBLIC contract consumed by EXTERNAL code (other packages, other teams, npm consumers).

---

## When Barrels Are BANNED

| Context | Why Banned |
|---------|------------|
| Feature module internal (`features/auth/index.ts`) | Hides internal file structure, makes deps opaque |
| Utility folder (`utils/index.ts`) | Creates coupling magnet — everything imports from one point |
| Component folder re-exporting siblings | Direct imports are clearer and tree-shake better |
| Deep re-export chains (barrel imports barrel) | Impossible to trace actual dependency |
| Any barrel that also contains logic | Mixed concern — barrel should ONLY re-export |

**Common trait:** The barrel serves INTERNAL code in the SAME package. Direct imports are always better here.

---

## Tree-Shaking Impact

| Pattern | Tree-Shakeable? | Why |
|---------|----------------|-----|
| `export * from './heavy'` | NO (most bundlers) | Bundler cannot determine which exports are used |
| `export { A, B } from './module'` | YES | Named exports allow dead-code elimination |
| Barrel with side-effect code | NEVER | Side effects force inclusion |
| `export * from './a'; export * from './b'` | NO | Namespace collision risk + full inclusion |
| Direct import `from './Button'` | ALWAYS | Optimal — bundler sees exact usage |

**Rule of thumb:** If your barrel uses `export *`, it destroys tree-shaking. Always use named exports.

---

## Safe Barrel Template

```typescript
// packages/ui/src/index.ts — PUBLIC package API barrel
// Rules:
// 1. Named exports ONLY (no export *)
// 2. No logic in this file (only re-exports)
// 3. No renaming (export as-is)
// 4. Alphabetical order for scanability

export { Button } from './components/Button';
export { Dialog } from './components/Dialog';
export { Input } from './components/Input';

export type { ButtonProps } from './components/Button';
export type { DialogProps } from './components/Dialog';
export type { InputProps } from './components/Input';
```

**Anti-pattern (banned):**

```typescript
// BAD: features/auth/index.ts — INTERNAL barrel
export * from './login';       // wildcard = no tree-shaking
export * from './register';    // hides what's actually exported
export * from './hooks';       // consumers don't know what they get
export { default as AuthProvider } from './AuthProvider';  // renaming in barrel
```

---

## Import Rules Summary

| Rule | Correct | Incorrect |
|------|---------|-----------|
| Internal: import from source file | `import { fn } from './auth/login'` | `import { fn } from './auth'` |
| Cross-package: import from barrel | `import { Button } from '@ui/components'` | `import { Button } from '@ui/components/Button/Button'` |
| No barrel logic | Barrel file has ONLY export statements | Barrel imports, transforms, then re-exports |
| No re-export rename | `export { Button } from './Button'` | `export { Button as Btn } from './Button'` |
| No circular barrel | Barrel does not import from files that import from it | `index.ts` imports `A.ts` which imports from `./index` |

---

## ESLint Enforcement

```jsonc
// .eslintrc.json — ban internal barrel imports
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [
        {
          "group": ["./*/index", "../*/index"],
          "message": "Import from source file directly, not internal barrel."
        }
      ]
    }]
  }
}
```
