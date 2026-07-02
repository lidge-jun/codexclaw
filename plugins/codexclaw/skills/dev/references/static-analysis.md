# Static Analysis & Type Safety

Last reviewed: 2026-07-02

## JS/TS Source File Default

For new JavaScript/TypeScript source files, prefer TypeScript:
- Use `.ts` for logic and `.tsx` for typed UI components when the project already supports TypeScript or is greenfield JS/TS.
- Use `.js`/`.jsx` only when the repo is clearly JS-only, build/runtime constraints require JS, or the user asks for JS.
- Do not introduce TypeScript tooling, convert existing JS, or change `tsconfig` without user approval.

New TypeScript MUST be strict-compatible from the first patch:
- No implicit `any`.
- Explicit `any` requires a nearby justification comment.
- Prefer `unknown` plus narrowing over `any`.
- Type exported function parameters and return values.
- Handle null/undefined deliberately.
- Avoid code that only passes because `strict` is disabled.

Verification:
- Run the project's configured typecheck when available.
- If TypeScript is present but no typecheck script exists, use the closest safe command such as `tsc --noEmit`.
- If strict compatibility cannot be verified, state that explicitly.

## Type Annotations

Add explicit type annotations to all function signatures, return types, and non-trivial variables.

| Language | Rule |
| -------- | ---- |
| TypeScript | `strict: true` in `tsconfig`. Avoid implicit `any`; explicit `any` requires a line comment with justification. |
| Python | Type hints on all function params and returns (`def fetch(url: str) -> Response:`). |
| Go | Already enforced by compiler; ensure exported types have doc comments. |
| C# / Java | Use nullability annotations (`?`, `@Nullable`). Avoid raw `Object` or `dynamic`. |
| General | If the language supports a strict/pedantic mode, enable it. |

## Static Analysis Gate

After every code change, run the project's static analysis toolchain as part of the verification gate.

| Toolchain | Command | Must Pass |
| --------- | ------- | --------- |
| TypeScript | `tsc --noEmit` | Zero errors |
| Python (typed) | `mypy .` or `pyright` | Zero errors on changed files |
| ESLint / Biome | `npx eslint .` or `npx biome check .` | Zero errors |
| Go | `go vet ./...` | Zero issues |
| Rust | `cargo clippy -- -D warnings` | Zero warnings |
| C# | `dotnet build /warnaserror` | Zero warnings |

## Common Rule to Prose Mapping

| Anti-Pattern (prose) | ESLint / Biome Rule |
|---|---|
| Unused variable/import | `no-unused-vars`, `@typescript-eslint/no-unused-vars` |
| Unsafe `any` type | `@typescript-eslint/no-explicit-any` |
| Loose equality (`==`) | `eqeqeq` |
| Circular import | `import/no-cycle` |
| Unhandled async | `@typescript-eslint/no-floating-promises` |
| `var` usage | `no-var`, `prefer-const` |
| Complex function | `complexity`, `max-depth`, `max-lines-per-function` |

This table is not exhaustive; check project config for the canonical set.

If no static analysis tool is configured in the project, recommend one to the user, but do not add tooling without approval.

## Escape Hatches

When bypassing the type system is unavoidable:
- Add a comment explaining why the escape is needed.
- Scope it minimally: cast at the narrowest point, not the broadest.
- Prefer assertion functions over raw casts (`assertIsString(x)` > `x as string`).
- TypeScript: `as unknown as T` double-cast requires a linked issue or TODO.
- Python: `# type: ignore[code]` must specify the exact mypy error code.
