# Static Analysis Gate — Toolchain Commands & Rule Mapping

Companion to `dev/SKILL.md` §7. Read when running the static-analysis part of the
verification gate or configuring lint/typecheck for a project.

## Per-Toolchain Gate Commands

| Toolchain      | Command                               | Must Pass                    |
| -------------- | ------------------------------------- | ---------------------------- |
| TypeScript     | `tsc --noEmit`                        | Zero errors                  |
| Python (typed) | `mypy .` or `pyright`                 | Zero errors on changed files |
| ESLint / Biome | `npx eslint .` or `npx biome check .` | Zero errors                  |
| Go             | `go vet ./...`                        | Zero issues                  |
| Rust           | `cargo clippy -- -D warnings`         | Zero warnings                |
| C#             | `dotnet build /warnaserror`           | Zero warnings                |

## Per-Language Type Annotation Rules

| Language   | Rule                                                                                |
| ---------- | ----------------------------------------------------------------------------------- |
| TypeScript | `strict: true` in tsconfig. Avoid implicit `any`; explicit `any` requires a line comment with justification. |
| Python     | Type hints on all function params and returns (`def fetch(url: str) -> Response:`). |
| Go         | Already enforced by compiler — ensure exported types have doc comments.             |
| C# / Java  | Use nullability annotations (`?`, `@Nullable`). Avoid raw `Object` or `dynamic`.    |
| General    | If the language supports a strict/pedantic mode, enable it.                         |

## Common Rule ↔ Prose Mapping

| Anti-Pattern (prose) | ESLint / Biome Rule |
|---|---|
| Unused variable/import | `no-unused-vars`, `@typescript-eslint/no-unused-vars` |
| Unsafe `any` type | `@typescript-eslint/no-explicit-any` |
| Loose equality (`==`) | `eqeqeq` |
| Circular import | `import/no-cycle` (ESLint), `noBarrelFile`/`useImportRestrictions` (Biome) |
| Unhandled async | `@typescript-eslint/no-floating-promises` |
| `var` usage | `no-var`, `prefer-const` |
| Complex function | `complexity`, `max-depth`, `max-lines-per-function` |

This table is not exhaustive — the project's own config is the canonical rule set.

## Sources

| Claim | Source | Checked |
|---|---|---|
| Biome barrel-file rule exists (`noBarrelFile`) | https://biomejs.dev/linter/rules/no-barrel-file/ | 2026-07-02 |
| ponytail necessity-gate discipline (DEV-NECESSITY-01 source) | https://github.com/DietrichGebert/ponytail | 2026-07-02 |
