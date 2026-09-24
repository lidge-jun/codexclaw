# 040 Desktop Evidence

This phase closes issue #239 parts A, B and C for maintainers who need desktop QA evidence to remain bound to the artifact and to the goalplan criterion that requires it. It adds QA ingress validation for `artifact-identity.json`, records a byte digest manifest in the QA receipt and verifies that manifest at the final gate, records an explicit `presented: "native"` criterion and uses it to request a native observation advisory, and ships a behavioral `lipo` command oracle. The oracle proves a candidate command by running it against both a known-good universal file and a negative thin slice; it does not claim to prove signing, notarization, or native interaction.

The amended decisions are binding: D5.1 validates identity whenever an identity file is referenced and whenever a verdict declares desktop artifact rows; a consumer verifies a present manifest, and a schemaVersion 2+ plan with a recorded final gate requires criterion-bound artifact identities for each non-native desktop criterion. Default v1 plans rely on QA ingress validation; receipts without a manifest remain readable. D5.2 uses `cxc loop add-criterion --surface desktop --presented native`, stores `presented: "native"`, and keeps the C advisory soft and fail-open. D5.3 uses a standalone script under `skills/dev-devops/scripts/`, a fake `lipo` on Linux, and an opt-in real-toolchain test.

## 5A — Identity and receipt binding (D5.1)

### File change map

#### MODIFY `plugins/codexclaw/skills/qa/scripts/validate-evidence.mjs`

Current anchors: imports at `:11-13`; artifact existence checks in `artifactErrors()` at `:80-120`; verdict parsing at `checkVerdictFile()` `:123-145`; receipt aggregation at `validateEvidence()` `:167-228`.

Add `createHash` to the node imports and add these constants and helpers after `CAPTURE_CHECK_KEYS`. The existing `identityErrors(id, label)` at `:29-41` validates `sourceSnapshotAt`; keep it unchanged and use the distinct `artifactIdentityErrors` name below. The reference currently lists the facts to record but does not define JSON keys or whether an absent packaging item means “not applicable”. Use this strict shape: `components` is an array with exactly one applicable-or-inapplicable record for each of `app`, `executable`, `archive`, `dmg` and `updater`; it may also contain zero or more `sidecar` and `extension` records. An applicable `app` has a path to a `.app` directory containing `Contents/Info.plist` and a lowercase `sha256` bundle tree digest computed by `sha256Tree` (see Audit round 2 and 3 folds); an applicable `executable` has a file path, lowercase `sha256` and non-empty `architectures`; applicable `archive`, `sidecar`, `extension`, `dmg` and `updater` records have file paths and lowercase `sha256`, with architectures additionally required for sidecars and extensions. The app's bytes are bound by its tree digest; the archive and executable digests are separate bindings. An inapplicable record has `applicable: false` and a non-empty `reason`, and does not need a path, digest or architecture list. `bundlePath` and `bundleExecutable` are required strings; `bundleIdentifier` is optional and validated when present. Signing mode is exactly `"ad-hoc" | "Developer ID"`, as the reference states; `teamId` is a non-empty string only for `Developer ID` and must be absent or `null` for ad-hoc. `entitlements` is a normalized object whose values are booleans, strings, finite numbers, or arrays of strings. The required toolchain keys are `xcodeSelectPath`, `sdk` and `swiftcVersion`; `rustVersion` and `bunVersion` are optional because the reference asks for them only when used, and are validated when present.

```js
const ARTIFACT_IDENTITY_FILE = "artifact-identity.json";
const SHA256 = /^[0-9a-f]{64}$/;
const SIGNING_MODES = new Set(["ad-hoc", "Developer ID"]);
const COMPONENT_KINDS = new Set(["app", "executable", "sidecar", "extension", "archive", "dmg", "updater"]);
const REQUIRED_COMPONENT_KINDS = new Set(["app", "executable", "archive", "dmg", "updater"]);
const ARCHITECTURE_KINDS = new Set(["executable", "sidecar", "extension"]);
const DIGEST_KINDS = new Set(["app", "executable", "archive", "sidecar", "extension", "dmg", "updater"]);

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function isDesktopArtifactVerdict(verdict) {
  return verdict.desktopArtifact === true;
}

function validCriterionIds(ids) {
  return Array.isArray(ids) && ids.length > 0
    && ids.every((id) => typeof id === "string" && /^c-[1-9]\d*$/.test(id))
    && new Set(ids).size === ids.length;
}

function artifactIdentityErrors(identity, label, scenario) {
  const out = [];
  if (!identity || typeof identity !== "object" || Array.isArray(identity)) {
    return [`${label} must be an object`];
  }
  const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const nonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
  if (identity.version !== 1) out.push(`${label}.version must be 1`);
  if (identity.bundleIdentifier !== undefined && !nonEmptyString(identity.bundleIdentifier)) {
    out.push(`${label}.bundleIdentifier must be a non-empty string when present`);
  }
  if (!nonEmptyString(identity.bundlePath)) out.push(`${label}.bundlePath must be a non-empty path`);
  if (!nonEmptyString(identity.bundleExecutable)) out.push(`${label}.bundleExecutable must be the CFBundleExecutable value`);
  if (!Array.isArray(identity.coveredRowIds) || identity.coveredRowIds.length === 0) {
    out.push(`${label}.coveredRowIds must be a non-empty array`);
  } else {
    if (!/^D-[A-Z0-9-]+$/.test(scenario)) out.push(`${label}: scenario must be a desktop row id`);
    if (!identity.coveredRowIds.includes(scenario)) out.push(`${label}.coveredRowIds must include scenario ${scenario}`);
    if (identity.coveredRowIds.some((id) => typeof id !== "string" || !/^D-[A-Z0-9-]+$/.test(id))) {
      out.push(`${label}.coveredRowIds contains an invalid desktop row id`);
    }
  }
  if (!Array.isArray(identity.components) || identity.components.length === 0) {
    out.push(`${label}.components must be a non-empty array`);
  } else {
    const seenKinds = new Set();
    const seenIds = new Set();
    for (const [i, component] of identity.components.entries()) {
      const p = `${label}.components[${i}]`;
      if (!component || typeof component !== "object" || Array.isArray(component)) {
        out.push(`${p} must be an object`);
        continue;
      }
      if (!nonEmptyString(component.id)) out.push(`${p}.id is required`);
      else if (seenIds.has(component.id)) out.push(`${p}.id is duplicated`);
      else seenIds.add(component.id);
      if (!COMPONENT_KINDS.has(component.kind)) out.push(`${p}.kind is invalid`);
      else {
        if (REQUIRED_COMPONENT_KINDS.has(component.kind) && seenKinds.has(component.kind)) {
          out.push(`${label}.components must contain exactly one ${component.kind} record`);
        }
        seenKinds.add(component.kind);
      }
      if (component.applicable === false) {
        if (!nonEmptyString(component.reason)) out.push(`${p}.reason is required when applicable is false`);
        continue;
      }
      if (component.applicable !== undefined && component.applicable !== true) out.push(`${p}.applicable must be true or false`);
      if (!nonEmptyString(component.path)) out.push(`${p}.path is required`);
      if (ARCHITECTURE_KINDS.has(component.kind)
        && (!Array.isArray(component.architectures) || component.architectures.length === 0
          || component.architectures.some((arch) => !nonEmptyString(arch)))) {
        out.push(`${p}.architectures must be a non-empty string array`);
      }
      if (DIGEST_KINDS.has(component.kind)
        && (typeof component.sha256 !== "string" || !SHA256.test(component.sha256))) {
        out.push(`${p}.sha256 must be a lowercase SHA-256 digest`);
      }
    }
    for (const kind of REQUIRED_COMPONENT_KINDS) {
      if (!seenKinds.has(kind)) out.push(`${label}.components must include ${kind}`);
    }
    const app = identity.components.find((component) => component?.kind === "app");
    if (app?.applicable !== false) {
      for (const kind of ["archive", "executable"]) {
        if (!identity.components.some((component) => component?.kind === kind && component.applicable !== false)) {
          out.push(`${label}.components requires an applicable ${kind} to bind the app`);
        }
      }
    }
  }
  if (!isRecord(identity.signing) || !SIGNING_MODES.has(identity.signing.mode)) {
    out.push(`${label}.signing.mode must be ad-hoc or Developer ID`);
  } else if (identity.signing.mode === "Developer ID") {
    if (!nonEmptyString(identity.signing.teamId)) out.push(`${label}.signing.teamId is required for Developer ID`);
  } else if (identity.signing.teamId !== undefined && identity.signing.teamId !== null) {
    out.push(`${label}.signing.teamId must be absent or null for ad-hoc signing`);
  }
  if (!isRecord(identity.signing?.entitlements)) {
    out.push(`${label}.signing.entitlements must be an object`);
  } else {
    for (const [key, value] of Object.entries(identity.signing.entitlements)) {
      const valid = typeof value === "boolean"
        || typeof value === "string"
        || (typeof value === "number" && Number.isFinite(value))
        || (Array.isArray(value) && value.every((item) => typeof item === "string"));
      if (!nonEmptyString(key) || !valid) out.push(`${label}.signing.entitlements has an invalid value for ${key}`);
    }
  }
  const requiredToolchainKeys = ["xcodeSelectPath", "sdk", "swiftcVersion"];
  const optionalToolchainKeys = ["rustVersion", "bunVersion"];
  if (!isRecord(identity.toolchain)) out.push(`${label}.toolchain is required`);
  else {
    for (const key of requiredToolchainKeys) if (!nonEmptyString(identity.toolchain[key])) out.push(`${label}.toolchain.${key} is required`);
    for (const key of optionalToolchainKeys) {
      if (identity.toolchain[key] !== undefined && !nonEmptyString(identity.toolchain[key])) out.push(`${label}.toolchain.${key} must be a non-empty string when present`);
    }
  }
  return out;
}
```

Replace the current `artifactErrors(baseDir, verdict, notes)` body with a result that also returns validated identity paths and a `desktopArtifact` boolean. Preserve the existing existence, non-empty and PNG checks. For every `artifactRefs` entry named `artifact-identity.json`, parse it, run `artifactIdentityErrors(identity, ref, verdict.scenario)`, and include that file with the verdict's `criterionIds` in `identityPaths`. If `verdict.desktopArtifact === true`, require exactly one identity reference, a desktop row id in `verdict.scenario`, and a non-empty, unique `criterionIds` array of goalplan-style IDs. The QA validator cannot see the goalplan, so the final gate verifies membership against its actual criteria. An applicable app is a directory containing `Contents/Info.plist`; other applicable components are non-empty files and digest-bearing kinds are hashed. Iterate components only when the parsed value is an array. Return `{ errors, notes, identityPaths, desktopArtifact }` so the caller can build the receipt manifest without revalidating a second shape.

Replace the function with this complete body. It preserves the current malformed-reference, existence, regular-file, empty-file and visual PNG checks while adding identity parsing, component digest checks, and the binding result:

```js
function artifactErrors(baseDir, verdict, notes) {
  const errors = [];
  const identityPaths = [];
  const refs = Array.isArray(verdict.artifactRefs) ? verdict.artifactRefs : [];
  const visual = VISUAL_SURFACES.has(verdict.surface);
  let identityCount = 0;
  for (const ref of refs) {
    if (typeof ref !== "string" || ref.length === 0) {
      errors.push("artifactRefs contains a non-string entry");
      continue;
    }
    const abs = resolve(baseDir, ref);
    if (!existsSync(abs)) {
      errors.push(`artifact is missing: ${ref}`);
      continue;
    }
    let st;
    try { st = statSync(abs); }
    catch (err) {
      errors.push(`artifact could not be read: ${ref} (${err.message})`);
      continue;
    }
    if (!st.isFile() || st.size === 0) {
      errors.push(`artifact is empty or not a regular file: ${ref}`);
      continue;
    }
    if (visual && ref.toLowerCase().endsWith(".png")) {
      let head;
      try { head = readFileSync(abs); }
      catch (err) {
        errors.push(`artifact could not be read: ${ref} (${err.message})`);
        continue;
      }
      if (!head.subarray(0, 8).equals(PNG_MAGIC)) {
        errors.push(`artifact is named .png but does not carry the PNG signature: ${ref}`);
      } else {
        const dims = pngDimensions(head);
        if (dims) notes.push(`${ref}: ${dims.width}x${dims.height}`);
      }
    }
    if (basename(ref) !== ARTIFACT_IDENTITY_FILE) continue;
    identityCount++;
    identityPaths.push({ path: abs, criterionIds: isDesktopArtifactVerdict(verdict) ? verdict.criterionIds : undefined });
    let identity;
    try { identity = JSON.parse(readFileSync(abs, "utf8")); }
    catch (err) {
      errors.push(`${ref}: artifact identity is not valid JSON (${err.message})`);
      continue;
    }
    errors.push(...artifactIdentityErrors(identity, ref, verdict.scenario));
    const components = Array.isArray(identity?.components) ? identity.components : [];
    const app = components.find((component) => component?.kind === "app" && component.applicable !== false);
    const executable = components.find((component) => component?.kind === "executable" && component.applicable !== false);
    if (app && app.path !== identity.bundlePath) errors.push(`${ref}: app path must equal bundlePath`);
    if (app && executable && typeof app.path === "string" && typeof executable.path === "string"
      && typeof identity.bundleExecutable === "string"
      && resolve(baseDir, executable.path) !== resolve(baseDir, app.path, "Contents/MacOS", identity.bundleExecutable)) {
      errors.push(`${ref}: executable path must be derived from bundlePath and bundleExecutable`);
    }
    for (const component of components) {
      if (component?.applicable === false || typeof component?.path !== "string") continue;
      const componentPath = resolve(baseDir, component.path);
      if (!existsSync(componentPath)) {
        errors.push(`${ref}: component is missing: ${component.path}`);
        continue;
      }
      let componentStat;
      try { componentStat = statSync(componentPath); }
      catch (err) {
        errors.push(`${ref}: component could not be read: ${component.path} (${err.message})`);
        continue;
      }
      if (component.kind === "app") {
        const plist = resolve(componentPath, "Contents/Info.plist");
        let plistIsFile = false;
        try { plistIsFile = statSync(plist).isFile(); } catch { /* reported below */ }
        if (!component.path.endsWith(".app") || !componentStat.isDirectory() || !plistIsFile) {
          errors.push(`${ref}: app must be a directory containing Contents/Info.plist: ${component.path}`);
        } else {
          let treeDigest = null;
          try { treeDigest = sha256Tree(componentPath); }
          catch (err) { errors.push(`${ref}: app bundle could not be digested: ${err.message}`); }
          if (treeDigest !== null && treeDigest !== component.sha256) {
            errors.push(`${ref}: app bundle tree digest does not match: ${component.path}`);
          }
        }
        continue;
      }
      if (!componentStat.isFile() || componentStat.size === 0) {
        errors.push(`${ref}: component is empty or not a regular file: ${component.path}`);
        continue;
      }
      if (DIGEST_KINDS.has(component.kind) && sha256File(componentPath) !== component.sha256) {
        errors.push(`${ref}: component digest does not match: ${component.path}`);
      }
    }
  }
  const desktopArtifact = isDesktopArtifactVerdict(verdict);
  if (desktopArtifact && (!/^D-[A-Z0-9-]+$/.test(verdict.scenario) || identityCount !== 1)) {
    errors.push(`${verdict.scenario}: desktop artifact verdict requires exactly one artifact-identity.json reference and a desktop row id`);
  }
  if (desktopArtifact && !validCriterionIds(verdict.criterionIds)) {
    errors.push(`${verdict.scenario}: desktop artifact verdict requires unique criterionIds such as c-3`);
  }
  return { errors, notes, identityPaths, desktopArtifact };
}
```

Change `checkVerdictFile()` from returning only `{ errors, notes, identity }` to returning `{ errors, notes, identity, identityPaths, desktopArtifact, criterionIds }`, and call the expanded artifact check at the same point as the existing `artifactErrors()` call. Preserve `criterionIds` only when `desktopArtifact === true` and validation succeeded. The verdict contract remains backward-compatible for non-desktop verdicts; `desktopArtifact: true` and `criterionIds` are required together only for an artifact-dependent desktop row.

In `validateEvidence()`, collect each validated `verdict.json` as `{ path, kind: "verdict", criterionIds }` and each referenced identity as `{ path, kind: "artifact-identity", criterionIds }`; the identity gets the IDs from its validated verdict, not from an untrusted second declaration. Before writing the receipt, compute paths relative to `dirname(receiptPath)` and add the resulting `artifactManifest` to the receipt object:

```js
const artifactManifest = manifestFiles.map(({ path, kind, criterionIds }) => ({
  path: relative(dirname(receiptPath), path),
  sha256: sha256File(path),
  kind,
  ...(criterionIds === undefined ? {} : { criterionIds }),
}));
```

The manifest must include each `verdict.json` even for UI-only QA and each referenced identity file. An identity entry carries `criterionIds` when its verdict declares `desktopArtifact: true`; a non-desktop verdict may reference an identity without criterion IDs, which is still validated and byte-bound but cannot satisfy a desktop criterion at the final gate. A verdict entry carries IDs when desktop artifact proof was declared. A failure in any identity or digest check follows the existing `errors.length > 0` return and leaves no receipt. The receipt JSON remains `kind: "qa"`, with `sourceIdentity`, `command`, `exitCode`, and `createdAt` unchanged.

#### MODIFY `plugins/codexclaw/components/pabcd-state/src/source-receipt.ts`

Current anchors: `SourceBoundReceipt` at `:22-54`; `parseSourceBoundReceipt()` at `:97-147`.

Add the receipt type and optional field:

```ts
export interface ArtifactDigest {
  path: string;
  sha256: string;
  kind: "verdict" | "artifact-identity";
  criterionIds?: string[];
}

export interface SourceBoundReceipt {
  // existing fields
  artifactManifest?: ArtifactDigest[];
}
```

After parsing `sourceIdentity` and before returning the receipt, accept an absent `artifactManifest` for legacy receipts. When present, require a non-empty array of `{ path, sha256, kind, criterionIds? }`; `kind` is exactly `"verdict" | "artifact-identity"` and must agree with the entry basename (`verdict.json` or `artifact-identity.json`). If `criterionIds` is present, require a non-empty, unique array of `c-N` IDs; an identity referenced by a non-desktop verdict may omit it. The QA validator requires IDs on desktop artifact verdicts before receipt writing. The current writer emits `kind` on every entry; no earlier released receipt had `artifactManifest`, so the absent-field compatibility path covers the existing receipts. Resolve each path relative to `dirname(abs)` where `abs` is the receipt path, reject absolute paths and lexical `..` escapes, and require lowercase 64-hex hashes. Mirror `hasValidReceipt()` in `subagent-evidence.ts:148-165`: `lstat` rejects an entry that is a symlink, `realpath` of both file and evidence root must still show containment, and `stat` requires a non-empty regular file before hashing. Do not import `hasValidReceipt()` for manifest entries because it accepts a cwd-relative receipt path and does not enforce the expected `kind` or entry shape. Use a local guard returning `{ error }` on every malformed or unreadable entry; a missing file, symlink escape, changed byte or hash error must not throw into the caller's fail-open catch. After hashing all entries, for each identity entry find its same-directory `verdict` entry, parse that already checked verdict, require its `artifactRefs` to resolve to this identity path, and require both manifest entries' `criterionIds` (when present) to equal that verdict's `criterionIds` exactly. A `desktopArtifact: true` verdict must have IDs on both entries; a non-desktop verdict may omit them. Reject duplicates or missing matching verdict entries. This rechecks the receipt's metadata against the hashed source instead of trusting IDs that could be edited in receipt JSON alone. Store the validated list in `receipt.artifactManifest`.

The parser must verify the manifest at consumption time, so a changed `verdict.json` or `artifact-identity.json` fails before source identity comparison. A receipt without the field remains readable to preserve the legacy contract.

#### MODIFY `plugins/codexclaw/components/pabcd-state/src/goalplan.ts`

Current anchors: `GoalplanValidationCtx` at `:1424-1429`; `finalGateReasons()` at `:1552-1603`; `identityReasons()` at `:1630-1679`.

Extend the context result type so the final gate can distinguish a legacy receipt from a bound artifact receipt:

```ts
readReceipt: (path: string, expectedKind: "test" | "qa") =>
  | { sourceIdentity: SourceIdentity; artifactManifest?: ArtifactDigest[] }
  | { error: string };
```

Import `ArtifactDigest` from `source-receipt.ts`. Add these helpers immediately before `identityReasons()`:

```ts
function desktopArtifactCriterionIds(plan: Goalplan): string[] {
  return plan.criteria
    .filter((criterion) => criterion.surface === "desktop" && criterion.presented !== "native")
    .map((criterion) => criterion.id);
}

function hasArtifactIdentityForCriterion(manifest: ArtifactDigest[] | undefined, criterionId: string): boolean {
  return Array.isArray(manifest) && manifest.some((entry) =>
    entry.kind === "artifact-identity"
      && entry.path.split(/[\\/]/).pop() === "artifact-identity.json"
      && entry.criterionIds?.includes(criterionId) === true,
  );
}
```

In `identityReasons()`, retain the existing source identity checks and replace the local receipt type with `{ sourceIdentity: SourceIdentity; artifactManifest?: ArtifactDigest[] }`. After the existing `"error" in receipt` branch and before `named.push(...)`, check every artifact-dependent desktop criterion:

```ts
if (kind === "qa") {
  for (const criterionId of desktopArtifactCriterionIds(plan)) {
    if (!hasArtifactIdentityForCriterion(receipt.artifactManifest, criterionId)) {
      out.push(`the QA receipt artifactManifest has no artifact-identity.json entry for desktop criterion ${criterionId}`);
    }
  }
}
```

A parser error already remains a hard reason. This per-criterion check rejects both a legacy receipt with no manifest and a manifest containing an identity bound only to some other criterion. Do not require a manifest for logic, web, tui, or `presented: "native"` criteria. Keep manifest path and byte verification in `parseSourceBoundReceipt()` so an identity entry cannot pass with a missing or changed file. The QA validator binds `criterionIds` to a validated verdict and its identity; the final gate checks the IDs against the actual goalplan criteria. It does not infer a criterion ID from a desktop row `scenario` string.

Main decision on the writer's open question: confirmed. A desktop criterion is artifact-dependent unless it declares `presented: "native"`, whose evidence path is the render-observation advisory in 5B. The compatibility cost is explicit: only schemaVersion 2+ plans with a recorded final gate reach `identityReasons()` (`goalplan.ts:1552-1603`), and each non-native desktop criterion in that scope needs a QA receipt emitted by 0.2.38 with a matching `criterionIds` identity entry. A 0.2.37 receipt fails that gate with a named reason. New plans default to v1 (`goalplan.ts:65-67`); they have QA ingress validation but no final-gate manifest requirement. The CHANGELOG Compatibility section must state this narrower scope.

#### MODIFY `plugins/codexclaw/test/qa-validate-evidence.test.mjs`

Add a fixture helper that writes a real directory-shaped `Fixture.app/Contents/Info.plist`, an executable at `Fixture.app/Contents/MacOS/<bundleExecutable>` with matching SHA-256 and architectures, an archive file with matching SHA-256, the remaining required `dmg` and `updater` records, one covered row equal to the verdict scenario, a verdict with `criterionIds: ["c-3"]`, a bundle identifier/path/executable, signing and entitlement fields, and all required toolchain keys. Add these tests:

1. `desktop artifact verdict requires artifact-identity.json`: `desktopArtifact: true` without an identity ref fails and emits the missing-binding error.
2. `desktop artifact identity validates bundle, row, component and digest`: the directory-shaped `.app` with `Contents/Info.plist`, matching executable and archive bytes pass. The emitted receipt contains typed `verdict` and `artifact-identity` entries; the identity entry carries `["c-3"]` from its verdict.
3. `desktop artifact identity rejects malformed hashes and unknown row links`: a bad SHA-256 and a `coveredRowIds` value not matching the scenario each fail before receipt creation.
4. `desktop artifact identity allows an explicitly inapplicable component`: `{ applicable: false, reason }` passes without a fabricated digest.
5. `desktop artifact identity requires signing and toolchain fields`: missing Developer ID team ID, malformed entitlements, or any missing required toolchain key fails before receipt creation.
6. `receipt manifest detects altered verdict and identity bytes`: emit a receipt, mutate each file in turn, and assert `parseSourceBoundReceipt()` returns an error.
7. `legacy UI receipt without artifactManifest remains parseable`: the existing web fixture receipt has no manifest and still parses as a QA receipt.
8. `desktop artifact verdict requires criterionIds`: missing, empty, duplicate, or malformed IDs fail at ingress; a valid ID survives into the identity manifest entry.
9. `malformed components are errors, not a crash`: an otherwise well-formed identity with `components: {}` returns a validation error and writes no receipt.
10. `app requires a bundle directory and binding files`: a plain file at an `app` path, a bundle without `Contents/Info.plist`, a `bundlePath` or executable path inconsistent with the app, or an applicable app with inapplicable archive/executable fails; a directory-shaped bundle fixture passes with the `app.sha256` that `sha256Tree` computes, and fails with any other value or without one.
11. `manifest symlink escape fails closed`: after emitting a receipt, replace a manifest target inside evidence with a symlink to an outside file containing identical bytes; parsing returns `{ error }`, not a valid receipt or an exception. Also test a symlinked parent directory resolving outside the evidence root.
12. `receipt-only criterionId edit cannot expand coverage`: emit a valid receipt, change only its identity entry's `criterionIds` to another criterion, and assert parsing rejects the mismatch against the hashed same-directory verdict.

#### MODIFY `plugins/codexclaw/components/pabcd-state/test/final-gate.test.ts`

Update the `GoalplanValidationCtx` fixture return type to permit `artifactManifest`. Add:

1. `artifact-dependent desktop criteria reject a legacy QA receipt`: a schemaVersion 2 approved gate with desktop criterion `c-3` without `presented` and a QA receipt lacking `artifactManifest` fails with a reason naming `c-3`.
2. `artifact-dependent desktop criteria reject a verdict-only manifest`: the same gate with `artifactManifest: [{ path: "verdict.json", sha256: valid, kind: "verdict" }]` fails because no identity entry covers `c-3`.
3. `artifact-dependent desktop criteria accept a matching identity manifest entry`: typed verdict and identity entries with valid digests and identity `criterionIds: ["c-3"]` pass the dependency check.
4. `presented native desktop criteria do not require an artifact manifest`: the same gate with only `presented: "native"` desktop criteria passes when the QA receipt has valid source identity and no artifact manifest.
5. `changed artifact manifest fails before the desktop final gate`: return `{ error: ... }` from `readReceipt` and assert the gate rejects it.
6. `unrelated identity cannot satisfy another desktop criterion`: `c-3` and `c-4` are non-native desktop criteria, but the only identity entry carries `["c-3"]`; the gate names missing `c-4`.
7. `every desktop criterion can be covered`: separate validated identity entries for `c-3` and `c-4`, or one entry with both IDs from its verdict, pass the artifact dependency check.
8. `default v1 plan does not activate final-gate manifest requirement`: a default `schemaVersion: 1` plan with non-native desktop criterion and no final gate has no artifact-manifest final-gate reason; QA ingress still rejects invalid desktop artifact verdicts.

### PLAN-FIELD-CHAIN-01 — 5A

| Field/value | Creation | Serialization | Deserialization | Consumers |
|---|---|---|---|---|
| `verdict.desktopArtifact: true` | QA author writes it for an artifact-dependent desktop row | `verdict.json` in the scenario directory | `validate-evidence.mjs` reads the JSON boolean | `artifactErrors()` requires identity binding; receipt manifest records the bytes |
| `verdict.criterionIds[]` | QA author names the goalplan criterion IDs, e.g. `c-3`, covered by this desktop artifact verdict | `verdict.json` | QA validator checks non-empty, unique `c-N` IDs; `checkVerdictFile()` returns them | identity manifest writer copies the validated IDs; final gate compares them with each non-native desktop criterion in the plan |
| `artifact-identity.json` | QA author creates it beside the scenario artifacts | listed in `artifactRefs` | `validate-evidence.mjs` parses and validates it | identity shape checks and local component digest checks |
| `artifactManifest[].kind` | QA validator assigns `verdict` or `artifact-identity` while collecting validated paths | typed entry in `.codexclaw/evidence/<session>/qa-receipt.json` | receipt parser validates enum and matching basename | final gate selects only `artifact-identity` entries |
| `artifactManifest[].criterionIds[]` | QA writer copies a validated desktop verdict's IDs to its identity entry | typed identity entry in QA receipt; absent for identities referenced by non-desktop verdicts | receipt parser validates IDs and compares them with the hashed same-directory verdict's IDs | `identityReasons()` requires coverage for each non-native desktop criterion ID in a v2+ final gate |
| `artifactManifest[].path/sha256` | `validateEvidence()` records relative paths and hashes validated verdict and identity files | QA receipt under `.codexclaw/evidence/<session>/` | receipt parser checks shape, lexical/realpath containment, symlink status and bytes | final gate consumes only a validated receipt; absent manifest remains parseable for legacy receipts |

### C-ACTIVATION-GROUNDING-01 — 5A

- An identity file is referenced: identity shape and local component checks run; malformed or changed bytes produce a QA validation error and no receipt.
- A verdict declares `desktopArtifact: true`: the identity reference, matching desktop row and `criterionIds` are required; omission is observable as a named QA failure.
- A receipt is consumed with a manifest: altered or missing verdict/identity bytes make `parseSourceBoundReceipt()` return an error, so final-gate validation fails.
- A legacy receipt is consumed: it remains parseable; a v2+ recorded final gate with no artifact-dependent desktop criterion retains the existing source identity behavior.
- A schemaVersion 2+ plan has a recorded final gate and a desktop criterion without `presented: "native"`: the gate requires a QA receipt whose validated manifest has an `artifact-identity` entry containing that criterion ID. Every such criterion is checked separately. A v1 plan never reaches this final-gate branch; QA ingress validation remains its artifact proof check.

### PLAN-BYPASS-NAMED-01 — 5A

| Check | Tier | Executing surface | Known bypass | Residual risk | Wording |
|---|---|---|---|---|---|
| Identity shape, row binding and file hashes | E8 | QA validator CLI and focused tests | A same-user writer can create truthful-looking JSON and matching bytes | The validator proves recorded bytes and relationships, not that signing or runtime observations were truthful | Say “validated and byte-bound,” never “authentic” |
| Receipt manifest recheck | E8 | receipt parser and v2+ recorded final gate | V1 plans do not execute `finalGateReasons()`; a v2+ artifact-dependent criterion rejects legacy, verdict-only or unrelated-criterion manifests | The same-user writer can still forge a matching identity and receipt; v1 relies on QA ingress | Say “v2+ recorded final gates require a validated identity entry for every artifact-dependent desktop criterion” |

## 5B — Presented native surface and C advisory (D5.2)

### File change map

#### MODIFY `plugins/codexclaw/components/pabcd-state/src/goalplan.ts`

Current anchors: `CriterionSurface` and `GoalplanCriterion` at `:69-98`; `reviveGoalplan()` criteria mapping at `:552-567`; `NewGoalplanInput` at `:890-898`; `buildGoalplan()` at `:919-947`.

Add the explicit attribute without adding another `CriterionSurface` value:

```ts
export type PresentedSurface = "native";

export interface GoalplanCriterion {
  // existing fields
  presented?: PresentedSurface;
}
```

Add `presented?: PresentedSurface` to `NewGoalplanInput.criteria[]` and preserve it in `buildGoalplan()`. In the reviver, extend the existing spread at `:563-566` with `...(cc.presented === "native" ? { presented: "native" } : {})`. Unknown values stay absent, exactly as unknown `surface` values do. `computeQaRequired()` remains true for `desktop` regardless of presentation.

#### MODIFY `plugins/codexclaw/components/pabcd-state/src/steering.ts`

Current anchors: `SteerOp` at `:39-48`; add-criterion validation at `:104-117`; criterion construction at `:197-206`.

Extend the add-criterion operation:

```ts
type SteerOp =
  | { kind: "add-criterion"; scenario: string; surface?: CriterionSurface; expectedEvidence?: string; presented?: "native" }
  // existing alternatives
```

In `validateBatch()`, reject `presented` unless it is exactly `"native"`, reject it when `surface !== "desktop"`, and preserve it in the normalized operation. In `applyOps()`, add `...(op.presented === "native" ? { presented: "native" } : {})` to the new criterion object. This keeps steering and the public CLI on the same field chain.

#### MODIFY `plugins/codexclaw/components/pabcd-state/src/goalplan-cli.ts`

This file is shared with wp4. wp4 must land its per-verb allowed-flag table and unknown-token rejection first. wp5 then adds `--presented` only to the `add-criterion` allowed set and to the existing `GoalplanCliArgs` interface. The two edits must be applied in that order; do not resolve a conflict by reintroducing the old global parser.

Current anchors: `GoalplanCliArgs` at `:64-108`; parser at `:127-194`; `runAddOp()` at `:306-370`; help line at `:590`.

Add:

```ts
/** add-criterion only; valid only with --surface desktop. */
presented?: string;
presentedGiven?: boolean;
```

The parser branch must preserve both `--presented native` and `--presented=native`, reject a missing value before dispatch, and reject the flag on every other verb through wp4’s allowed-set validation. In `runAddOp()` after surface validation:

```ts
if (args.presentedGiven && args.presented === undefined) {
  return { output: "loop add-criterion: --presented needs the value native", code: 1 };
}
if (args.presented !== undefined && (surface !== "desktop" || args.presented !== "native")) {
  return { output: "loop add-criterion: --presented native requires --surface desktop", code: 1 };
}
op = {
  kind: "add-criterion",
  scenario,
  surface,
  ...(args.presented === "native" ? { presented: "native" } : {}),
};
```

Update the help line at `:590` from:

```text
cxc loop add-criterion --session <id> --criterion <text> [--surface logic|web|tui|desktop] [--cwd <path>]
```

to:

```text
cxc loop add-criterion --session <id> --criterion <text> [--surface logic|web|tui|desktop] [--presented native] [--cwd <path>]
```

#### MODIFY `plugins/codexclaw/components/pabcd-state/src/render-observations.ts`

Current anchors: `RenderObsKind` and `RenderObsRow` at `:53-61`; `handleRenderObservationCapture()` at `:154-168`; query helpers at `:125-145`.

Add a `native-observation` row with explicit evidence metadata:

```ts
export type RenderObsKind = "observation" | "artifact-modified" | "native-observation";

export interface RenderObsRow {
  // existing fields
  nativeApp?: string;
  screenshotPath?: string;
  criterionId?: string;
}
```

Add `nativeObservationRows(cwd, sessionId?)` and `hasNativeObservation(cwd, sessionId?)`. `readRenderObsRows()` must retain optional strings only when present and continue to skip malformed rows. Extend `handleRenderObservationCapture()` with a total extractor: for `computer-use:computer-use`, accept only an explicit string `appName`/`application`/`app` in the structured tool input or response and record `nativeApp`; for `view_image`, accept only a structured `path` that resolves to an artifact named by a QA verdict’s `artifactRefs`, and record `screenshotPath`; attach `criterionId` only when the structured payload supplies it. Generic browser observations remain ordinary `observation` rows and do not satisfy this check.

The extractor must never infer native status from a file extension, source language, generic browser invocation, or a shell screenshot command. Parsing failures return no native row and preserve the current fail-open behavior.

#### MODIFY `plugins/codexclaw/components/pabcd-state/src/hook.ts`

Current anchors: `handleStop()` at `:1768-1830`; `renderGroundingAdvisoryForStop()` at `:1832-1846`; the render-observation import is at `:131`.

Add `hasNativeObservation` to the existing `render-observations.ts` import at `:131`; `nativeSurfaceGroundingAdvisory()` and `relevantPresentedNativeCriteria()` stay local to `hook.ts` beside `renderGroundingAdvisoryForStop()`.

`handleStop()` already has the session-bound `state` from `readState(payload.cwd, payload.session_id)` at `:1774`, and `state.slug` is the binding used by the existing Stop context reader. Reuse the existing `safeReadBoundGoalplan(cwd, slug)` resolver at `:1385-1395`; do not add a directory scan or a new `readBoundGoalplan` helper. `goalplan-cli.ts:201-211` confirms the same session-to-slug rule used by `loop validate --session`. `effectiveActiveWorkPhaseId()` is already imported from `goalplan.ts` at `:64-84`.

Change the helper signature to `renderGroundingAdvisoryForStop(cwd: string, phase: Phase, sessionId: string, boundSlug: string): string | null` and replace the existing body with this complete implementation. The native branch runs first and has no dependency on `hasRenderArtifactModified()`; the ordinary render branch remains independent, and both advisories can be returned together:

```ts
function relevantPresentedNativeCriteria(plan: Goalplan): Goalplan["criteria"] {
  const activeId = effectiveActiveWorkPhaseId(plan);
  const active = activeId ? plan.workPhases.find((phase) => phase.id === activeId) : undefined;
  // Criteria linked to the active phase narrow the advisory to this cycle's work.
  // Plans that link no criteria to the active phase fall back to every open one.
  const linked = active && active.criteriaIds.length > 0 ? new Set(active.criteriaIds) : null;
  return plan.criteria.filter((criterion) =>
    (linked === null || linked.has(criterion.id))
      && criterion.status === "open"
      && criterion.surface === "desktop"
      && criterion.presented === "native",
  );
}

function nativeSurfaceGroundingAdvisory(criterionIds: string[]): string {
  return [
    "[codexclaw advisory — D5.2] The active desktop criteria",
    criterionIds.join(", "),
    'declare presented: "native", but no native-observation row was recorded for this session.',
    "Before C->D, inspect the native app with computer-use or record a declared QA screenshot",
    "so the native surface has an explicit observation signal. This is a soft advisory and does not block the turn.",
  ].join(" ");
}

export function renderGroundingAdvisoryForStop(
  cwd: string,
  phase: Phase,
  sessionId: string,
  boundSlug: string,
): string | null {
  try {
    if (phase !== "C") return null;
    const advisories: string[] = [];

    // D5.2: this branch is independent of render-artifact modification. A native
    // criterion can be active after Swift/Rust/native work with no web asset edit.
    const plan = boundSlug ? safeReadBoundGoalplan(cwd, boundSlug) : null;
    const nativeCriteria = plan ? relevantPresentedNativeCriteria(plan) : [];
    if (nativeCriteria.length > 0 && !hasNativeObservation(cwd, sessionId)) {
      advisories.push(nativeSurfaceGroundingAdvisory(nativeCriteria.map((criterion) => criterion.id)));
    }

    if (hasRenderArtifactModified(cwd, sessionId) && !hasRenderObservation(cwd, sessionId)) {
      advisories.push(renderGroundingAdvisory());
    }
    return advisories.length > 0 ? advisories.join("\n\n") : null;
  } catch {
    return null; // FAIL-OPEN for either advisory branch
  }
}
```

The active-work-phase filter is intentional: a future queued native criterion must not create a Stop reminder during the current phase, while the effective phase resolver already handles a stale cursor and dependency order. A malformed or absent bound plan therefore selects no native criteria and preserves fail-open behavior. Replace the single call at `hook.ts:1799` with `renderGroundingAdvisoryForStop(payload.cwd, state.phase, payload.session_id, state.slug)`; the existing uses of the returned `renderAdvisory` at `:1803-1805` and `:1819-1829` remain variable uses, not additional call sites. The returned text names the criterion ids, is emitted through the existing `additionalContext` path, and never changes `decision` to `block`.

#### MODIFY `plugins/codexclaw/components/pabcd-state/test/goalplan-public-surface.test.ts`

This test file is shared with wp4. Apply wp4 parser cases first, then add:

1. `add-criterion stores presented native only for desktop`: `--surface desktop --presented native` exits 0 and the round-tripped criterion has both fields.
2. `add-criterion rejects presented native without desktop`: the plan and ledger bytes remain unchanged.
3. `add-criterion rejects unknown or valueless presented`: both `--presented=web` and a missing value exit 1 without writes.
4. `other verbs reject presented before dispatch`: each verb’s parser rejects the flag and no plan mutation occurs.

#### MODIFY `plugins/codexclaw/components/pabcd-state/test/final-gate.test.ts`

Use the `presented` criterion fixture to cover serialization and the artifact-dependency decision from 5A. Assert that an unknown `presented` value is dropped by the reviver and that `presented: "native"` survives a write/read round trip.

#### MODIFY `plugins/codexclaw/components/pabcd-state/test/render-observations.test.ts`

Add structured payload fixtures and these tests:

1. `computer-use native app name records native-observation`: an explicit `appName` creates a row with `nativeApp`.
2. `view_image records only a declared QA screenshot`: a path listed in a verdict’s `artifactRefs` satisfies the native row; an unrelated image path does not.
3. `browser and shell observations do not satisfy native presentation`: ordinary browser and Bash records leave `hasNativeObservation()` false.
4. `native advisory fires without an artifact-modified row`: an active bound plan with an open presented-native criterion, no native row, and no `artifact-modified` row returns a soft advisory naming the criterion.
5. `native advisory clears after native observation`: the same setup with a native row returns null. The test diagnostic naming the cleared signal must include that row's `nativeApp` or `screenshotPath` and the criterion IDs that had been advisory candidates; do not add a production success message.
6. `native advisory is absent for package-only desktop criteria`: a desktop criterion without `presented: "native"` does not activate this advisory.
7. `native advisory follows the active phase's linked criteria`: when the active phase links criteria, an open presented-native criterion linked only to another phase returns null; when the active phase links none (or no phase is active), every open presented-native criterion is considered and the advisory fires.
8. `native advisory remains fail-open for missing or malformed plan`: missing plan, malformed ledger and malformed payload return null or the existing ordinary advisory without throwing.

### PLAN-FIELD-CHAIN-01 — 5B

| Field/value | Creation | Serialization | Deserialization | Consumers |
|---|---|---|---|---|
| `presented: "native"` | `add-criterion --surface desktop --presented native`, steering batch or fixture | `goalplan.json` criterion object | `reviveGoalplan()` keeps only the known value | relevant-criterion selection in the C advisory; 5A artifact dependency rule |
| `presented` CLI flag | argv parser in `goalplan-cli.ts` | N/A; parser input only | N/A | `runAddOp()` validates and sends `SteerOp.presented` |
| `native-observation` row | render PostToolUse extractor from explicit CUA app or declared screenshot | `.codexclaw/render-observations.jsonl` with `nativeApp` or `screenshotPath` | `readRenderObsRows()` and `nativeObservationRows()` | session-level `hasNativeObservation()` clears the C advisory; test diagnostics cite the observed app/screenshot; 5A verdict and identity entries provide per-criterion artifact proof |

### C-ACTIVATION-GROUNDING-01 — 5B

- A desktop criterion is registered without `presented`: no native-surface advisory activates; it remains in 5A’s artifact-dependent final-gate path.
- An active work phase contains an open desktop criterion with `presented: "native"`, phase is C, and no native row exists: the Stop output gains a soft `additionalContext` advisory naming the criterion id even when no render-artifact file was modified.
- A CUA payload explicitly names a native app: a `native-observation` row is written and the session-level advisory clears on the next check. A diagnostic claiming it cleared must name the observed app.
- A `view_image` payload points to a path declared in a QA verdict: a `native-observation` row is written and the session-level advisory clears; an undeclared path does not. A diagnostic claiming it cleared must name the screenshot.
- Phase is not C, the criterion is met, or the active phase links criteria and this one is not among them: this branch is not reached and the existing result remains.
- The ledger or bound plan cannot be read: the helper returns no new advisory and does not block the turn.

### PLAN-BYPASS-NAMED-01 — 5B

| Check | Tier | Executing surface | Known bypass | Residual risk | Wording |
|---|---|---|---|---|---|
| Presented-native criterion selection | E4 | Stop `additionalContext` advisory | The model can ignore the advisory; a hand-edited goalplan can remove the field | This is a soft reminder, not a completion gate | Say “advises” or “requests,” never “enforces” |
| Native observation row | E4 | PostToolUse render ledger plus Stop advisory | One session-level observation clears the reminder for all active native criteria, even if the app/screenshot relates to only one; same-user writable JSON does not prove semantic inspection | Per-criterion artifact proof is the 5A bound verdict/identity path; the advisory is only a soft session-level signal | Say “records a native observation signal”; any cleared-state diagnostic names the observed app/screenshot, without a new production success message |

## 5C — Behavioral `lipo` oracle (D5.3)

### File change map

#### NEW `plugins/codexclaw/skills/dev-devops/scripts/verify-lipo-command.mjs`

The script is standalone and uses `spawnSync`/`execFileSync` with an argv array. It never invokes a shell. Its CLI is:

```text
node plugins/codexclaw/skills/dev-devops/scripts/verify-lipo-command.mjs \
  --artifact <fat-file> --arch <name> --arch <name> \
  --candidate-json '["lipo","-verify_arch","x86_64","arm64e","{artifact}"]'
```

The new file must contain these complete functions and behavior:

```js
#!/usr/bin/env node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function die(message) { console.error(`[lipo oracle] ${message}`); process.exitCode = 2; }

function parseArgs(argv) {
  const out = { arches: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--artifact") out.artifact = argv[++i];
    else if (a === "--arch") out.arches.push(argv[++i]);
    else if (a === "--candidate-json") out.candidate = JSON.parse(argv[++i]);
    else if (a === "--lipo") out.lipo = argv[++i];
    else throw new Error(`unknown argument ${a}`);
  }
  if (!out.artifact || out.arches.length < 2 || !Array.isArray(out.candidate) || out.candidate.length === 0) {
    throw new Error("usage: --artifact <file> --arch <name> --arch <name> --candidate-json <argv-json>");
  }
  if (out.candidate.some((x) => typeof x !== "string") || out.candidate.filter((x) => x === "{artifact}").length !== 1) {
    throw new Error("candidate-json must be a string argv array with exactly one {artifact} placeholder");
  }
  return { ...out, lipo: out.lipo ?? "lipo" };
}

function run(argv) {
  const r = spawnSync(argv[0], argv.slice(1), { encoding: "utf8" });
  return { status: r.error ? null : r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "", error: r.error?.message };
}

function archSet(lipo, artifact) {
  const r = run([lipo, "-archs", artifact]);
  if (r.status !== 0) throw new Error(`cannot inspect artifact: ${r.stderr.trim() || r.error || `exit ${r.status}`}`);
  return r.stdout.trim().split(/\s+/).filter(Boolean).sort();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const expected = [...new Set(args.arches)].sort();
  const actual = archSet(args.lipo, args.artifact);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`artifact architectures ${actual.join(" ")} do not equal ${expected.join(" ")}`);
  const root = mkdtempSync(join(tmpdir(), "cxc-lipo-oracle-"));
  const missing = expected[0];
  const negative = join(root, "negative-thin");
  try {
    const thin = run([args.lipo, "-thin", missing, args.artifact, "-output", negative]);
    if (thin.status !== 0) throw new Error(`could not create negative control: ${thin.stderr.trim() || thin.error || `exit ${thin.status}`}`);
    const candidate = args.candidate.map((x) => x === "{artifact}" ? args.artifact : x);
    const negativeCandidate = args.candidate.map((x) => x === "{artifact}" ? negative : x);
    const good = run(candidate);
    const bad = run(negativeCandidate);
    if (good.status !== 0 || bad.status === 0) {
      console.error(JSON.stringify({ expected, actual, good, negative: { artifact: negative, missing, result: bad } }, null, 2));
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify({ ok: true, expected, actual, goodExit: good.status, negativeExit: bad.status, missing }, null, 2));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

try { main(); } catch (err) { die(err instanceof Error ? err.message : String(err)); }
```

The implementation must also reject duplicate `--arch` values after parsing, preserve candidate stdout/stderr in a failure report, and return exit 2 for malformed invocation, exit 1 for a behavioral mismatch, and exit 0 only when the good artifact passes and the negative control fails.

#### NEW `plugins/codexclaw/test/lipo-oracle.test.mjs`

Add a fake lipo fixture as a temporary executable or a node child script with these behaviors: `-archs good` prints `x86_64 arm64e`; `-thin x86_64 good -output negative` writes a marker file; the candidate command exits 0 for a marker containing both names and exits 1 for the negative marker. Add tests:

1. `lipo oracle accepts a candidate that passes good and fails thin`: exit 0 and JSON says `goodExit: 0`, `negativeExit: 1`.
2. `lipo oracle rejects a candidate that passes both`: exit 1.
3. `lipo oracle rejects a candidate that fails both`: exit 1.
4. `lipo oracle rejects an artifact with the wrong architecture set`: exit 2 before candidate execution.
5. `lipo oracle rejects shell-like or malformed candidate argv`: exit 2; no shell expansion occurs.
6. `real lipo oracle is opt-in`: skip unless `CXC_REAL_LIPO=1` and `process.platform === "darwin"`, then run against a fixture fat binary and record `xcrun -p lipo`/`lipo -version` in the test output.

#### MODIFY `plugins/codexclaw/scripts/inventory.mjs`

Current anchors: inventory collection at `:37-103`; set checks at `:145-188`; committed-manifest comparison at `:291-335`.

Add `collectScripts(pluginRoot)` that recursively lists shipped `.mjs` files under `skills/*/scripts/`, returns sorted paths relative to `pluginRoot`, and add `scripts: collectScripts(pluginRoot)` to `collectInventory()`. Include scripts in the canonical JSON and inventory set checks. Add a test in `plugins/codexclaw/test/inventory.test.mjs` named `inventory lists every shipped skill script exactly once`; update the committed `plugins/codexclaw/inventory.json` only in the later release phase after the new script exists. Do not update the inventory in this phase document-only build.

#### MODIFY `plugins/codexclaw/skills/dev-devops/references/native-desktop-acceptance.md`

Current anchors: registration at `:25-32`; artifact identity at `:115-131`; lipo guidance at `:170-179`.

Update the registration example from:

```text
cxc loop add-criterion --session <id> --criterion <text> --surface desktop
```

to:

```text
cxc loop add-criterion --session <id> --criterion <text> --surface desktop [--presented native]
```

Add after §6: “When a row depends on a built artifact, set `desktopArtifact: true`, list the covered goalplan criterion IDs in `criterionIds` (for example `["c-3"]`), and include one `artifact-identity.json` in `artifactRefs`. `validate-evidence.mjs --emit-receipt` validates the identity and copies the verdict's criterion IDs into its typed `artifactManifest` entry. A schemaVersion 2+ plan with a recorded final gate requires a matching identity entry for every non-native desktop criterion; default v1 plans use QA ingress validation only. `presented: "native"` rows use the soft native observation advisory and do not require an artifact manifest under that final-gate rule.”

Replace the lipo prescription at `:170-179` with: “The shipped behavioral oracle is `node plugins/codexclaw/skills/dev-devops/scripts/verify-lipo-command.mjs --artifact <file> --arch <a> --arch <b> --candidate-json <json>`. It checks the exact architecture set, executes the candidate argv on the good artifact, creates a negative thin slice, and requires the candidate to fail there. It never evaluates a shell string. The multi-architecture `-verify_arch` forms observed on this Mac are expected to fail and must not be prescribed.”

### PLAN-FIELD-CHAIN-01 — 5C

| Field/value | Creation | Serialization | Deserialization | Consumers |
|---|---|---|---|---|
| `--arch` repeated values | oracle CLI argv | N/A | `parseArgs()` | exact-set comparison and thin negative-control creation |
| `{artifact}` placeholder | candidate JSON argv | N/A | `parseArgs()` | one safe path substitution for good and negative runs |
| inventory `scripts[]` | `collectScripts()` filesystem scan | `inventory.json` in release phase | `collectInventory()` | `inventory.mjs --check`, inventory tests and release gate |

### C-ACTIVATION-GROUNDING-01 — 5C

- Good artifact architectures differ from required set: oracle exits 2 before candidate execution and prints both sets.
- Candidate exits nonzero on good: oracle exits 1 and reports the good result.
- Candidate exits zero on thin negative: oracle exits 1 and reports the negative result; this rejects a command that ignores architecture content.
- Candidate exits zero on good and nonzero on negative: oracle exits 0 and records both exit codes.
- `lipo` is missing, thin creation fails, or cleanup throws: oracle exits 2 and does not claim behavioral proof.
- The candidate contains shell metacharacters: it is passed as argv data to `spawnSync`; no shell branch activates.

### PLAN-BYPASS-NAMED-01 — 5C

| Check | Tier | Executing surface | Known bypass | Residual risk | Wording |
|---|---|---|---|---|---|
| Candidate behavior on good and thin files | E8 | standalone oracle and its tests | A fake lipo can model the wrong platform behavior; a command can pass this fixture but fail on another toolchain | This is a behavioral oracle for one candidate and fixture, not packaging proof | Say “behaviorally accepted by the oracle,” not “universal binary proven” |
| Architecture inventory list | E8 | oracle `-archs` invocation | A malicious or incorrect `lipo` executable can lie | Tool identity and version must be recorded by the caller; the real-toolchain test is opt-in | Say “reported architectures equal” |
| Shipped script inventory | E8 | inventory CLI/release gate | Inventory only sees paths under the declared skill scripts root | A script outside that root needs a separate inventory rule | Say “listed by the codexclaw inventory” |

## Verifier commands run on the current tree

The focused runner is `node plugins/codexclaw/scripts/test.mjs "<glob>"`. These commands were run before this document was written; they read the existing test files and do not read a future implementation.

| Command | Exit | Current evidence |
|---|---:|---|
| `node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/qa-validate-evidence.test.mjs"` | 0 | 19 passed, 0 failed |
| `node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/pabcd-state/test/goalplan-public-surface.test.ts"` | 0 | 19 passed, 0 failed |
| `node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/pabcd-state/test/final-gate.test.ts"` | 0 | 33 passed, 0 failed |
| `node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/pabcd-state/test/render-observations.test.ts"` | 0 | 26 passed, 0 failed |
| combined four globs above | 0 | 97 passed, 0 failed |
| `node plugins/codexclaw/scripts/inventory.mjs --check` | 0 | 29 skills, 29 hooks, 9 components; sets and published counts agree |
| `node plugins/codexclaw/scripts/test.mjs "skills/qa/**"` | 0 | 0 tests; this incorrect root-relative glob is not evidence |
| `node plugins/codexclaw/scripts/test.mjs "components/pabcd-state/test/**"` | 0 | 0 tests; this incorrect root-relative glob is not evidence |

The following implementation verifiers are NOT RUN (new):

```text
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/lipo-oracle.test.mjs"
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/qa-validate-evidence.test.mjs" "plugins/codexclaw/components/pabcd-state/test/final-gate.test.ts"
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/pabcd-state/test/goalplan-public-surface.test.ts" "plugins/codexclaw/components/pabcd-state/test/render-observations.test.ts"
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/test/inventory.test.mjs"
```

`npm run build` is a required implementation-phase verifier because source changes under `components/pabcd-state/src` require fresh `dist`; it is NOT RUN in this delegated docs-only task because the build writes generated files and the scope permits exactly one file write. The implementation builder must run it before claiming completion.

Audit-round-1 snippet syntax check on this document: extracted each changed JavaScript/TypeScript fence to a separate temporary file under `/tmp`. `node --check` exited 0 for the identity constants/validator, replacement `artifactErrors()` and manifest writer snippets. `node --experimental-strip-types --check` exited 0 for the `ArtifactDigest` type, criterion-coverage helpers and final-gate check snippets; the TS checks prefixed `export {};` in the temporary files to select module parsing. This is syntax evidence for the proposed snippets, not an implementation test or typecheck. `git diff --check -- devlog/_plan/260924_issue_sweep_0238/040_desktop_evidence.md` also exited 0.

### Read-only lipo probe run on this Mac

Tool path: `xcrun -f lipo` exited 0 and returned `/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/lipo`. `lipo -archs /bin/ls` exited 0 and returned `x86_64 arm64e`. `lipo -info /bin/ls` exited 0 and returned `Architectures in the fat file: /bin/ls are: x86_64 arm64e`.

The following commands all exited 0: `lipo -thin x86_64 /bin/ls -output /tmp/codexclaw-lipo-x86_64`, `lipo -thin arm64e /bin/ls -output /tmp/codexclaw-lipo-arm64e`, `lipo -verify_arch x86_64 /bin/ls`, and `lipo -verify_arch arm64e /bin/ls`. The following four commands all exited 1 and printed `lipo: -verify_arch requires exactly one input file`: `lipo -verify_arch x86_64 arm64e /bin/ls`, `lipo -verify_arch arm64e x86_64 /bin/ls`, `lipo /bin/ls -verify_arch x86_64 arm64e`, and `lipo /bin/ls -verify_arch arm64e x86_64`. This is the observed reason the oracle must test candidate behavior instead of prescribing a multi-architecture command spelling.

## Docs and SoT synchronization

These are implementation-phase edits, with exact current text and replacement text:

- `plugins/codexclaw/skills/qa/SKILL.md:73-81`: current verdict shape begins `"surface": "http|cli|tui|web|gui"` and ends with the `captureChecks` object. Add `"desktopArtifact": <bool>` and `"criterionIds": ["c-3"]` to the contract, explain that `desktopArtifact: true` requires both criterion IDs and one `artifact-identity.json` in `artifactRefs`, and add typed `{ path, sha256, kind, criterionIds? }` manifest entries to the emitted QA receipt paragraph at `:104-118`. State the v2+ recorded-final-gate scope and v1 QA-ingress behavior.
- `plugins/codexclaw/skills/dev-devops/references/native-desktop-acceptance.md:25-32`: replace the registration command with the optional `--presented native` form shown in 5B. At `:115-131`, replace the current prose with the exact `artifact-identity.json` schema in 5A: `version: 1`, required `bundlePath` and `bundleExecutable`, optional `bundleIdentifier`, required component kinds `app|executable|archive|dmg|updater`, optional `sidecar|extension` records, an applicable `app` path to a `.app` directory with `Contents/Info.plist` and an `app.sha256` bundle tree digest (printed by `validate-evidence.mjs --bundle-digest <path.app>`; bundle symlinks must stay inside the bundle), applicable `archive` and `executable` components with file SHA-256, `sha256` for other applicable file components, `architectures` for applicable executable/sidecar/extension records, and `{ applicable: false, reason }` for unavailable components. Define `signing.mode` as `ad-hoc|Developer ID`; require `signing.teamId` only for Developer ID and require absent/null for ad-hoc; require `signing.entitlements` as a normalized scalar/string-array object; require `toolchain.xcodeSelectPath`, `sdk` and `swiftcVersion`, with optional `rustVersion` and `bunVersion`; and require `coveredRowIds` to include the verdict scenario. Explain the verdict `criterionIds` to typed manifest to v2+ final-gate chain and the v1 limit. At `:170-179`, replace the multi-architecture prescription with the oracle command and behavioral limitation shown in 5C.
- `plugins/codexclaw/skills/loop/references/durable-goalplan.md:60-71`: change the current criterion shape from `{ id, scenario, surface, expectedEvidence, capturedEvidence, status }` to `{ id, scenario, surface, presented?, expectedEvidence, capturedEvidence, status }`; add “`presented: "native"` is legal only with `surface: "desktop"` and activates the soft native observation advisory” after the surface sentence. At `:89-92`, append `[--presented native]` and state that it is valid only with desktop.
- `structure/INDEX.md:206`: replace `tracks render/visual observation events for QA evidence` with `tracks ordinary render observations and explicit native-observation rows; the native presented-surface check remains a soft Stop advisory`. Add a row in the nearby component/utility map for `skills/dev-devops/scripts/verify-lipo-command.mjs` as the behavioral lipo oracle and state that `inventory.mjs` counts shipped skill scripts.
- `structure/40_enforcement_methods.md:18-32`: no text change is required. The new native advisory is E4 and the validator/oracle checks are E8; cite this catalog rather than changing its ladder.

## Scope, ordering, and risks

IN scope is the files named in 5A, 5B and 5C, their named tests, the QA and native-desktop reference updates, `structure/INDEX.md`, and the later release-phase inventory regeneration. OUT scope is desktop application source, signing/notarization, actual native app launch, Codex core, hook trust, remote CI, release publication, and any generated `dist` update during this document-only task.

The shared write order is mandatory: wp4 first updates `goalplan-cli.ts` and `goalplan-public-surface.test.ts` with per-verb flag validation; 5B then adds `--presented`, `presented` serialization, and the tests. 5A may proceed independently of 5B except that `goalplan.ts` is shared; land the 5B type/reviver change before adding `desktopArtifactCriterionIds()` so the final-gate rule compiles against the new field. 5C has disjoint source/test files, but its inventory change and the new script must land together before inventory regeneration.

Material risks are the unverified host payload shape for native app names and screenshot paths, the fact that a same-user writer can forge both an identity record and a matching receipt manifest, and the deliberate normalization of entitlements into a scalar/string-array object because the reference does not prescribe a plist-to-JSON mapping. The archive digest records bytes but this validator does not unpack the archive to prove it contains the directory-shaped app; `bundleExecutable` is checked against the executable path but not read from `Info.plist`. The native advisory remains fail-open and session-level by decision; one unrelated observation may clear it. Default v1 plans do not get the final-gate manifest check. The lipo oracle remains toolchain- and fixture-bounded; the recorded macOS probe is evidence for this host only.

## Ten-line summary

1. 5A validates referenced desktop identity files against the native-desktop acceptance fields.
2. Artifact-dependent desktop verdicts declare `desktopArtifact: true`, `criterionIds`, and a matching row.
3. QA receipts hash every verdict and identity file with typed entries and criterion bindings.
4. Receipt parsing rehashes manifest bytes; v2+ recorded final gates check every non-native desktop criterion ID.
5. Legacy receipts remain readable; default v1 plans rely on QA ingress validation.
6. 5B adds `presented: "native"` through the desktop-only `--presented native` flag.
7. The C advisory asks for a native observation row only for relevant open native criteria.
8. CUA app names and declared `view_image` screenshots can produce native observation rows.
9. 5C runs candidate lipo argv on a good universal file and a thin negative control.
10. Native advisory clearance is session-level; 5A's identity/verdict chain provides per-criterion artifact proof.

## Reflection round 1 folds

- Gap 4: replaced partial identity checks with a complete strict validator for bundle identity, required component kinds, conditional architectures and digests, signing mode/team ID, normalized entitlements, required toolchain keys, and covered row IDs; the SoT update now carries the same schema and records the entitlements normalization choice.
- Gap 5: made the native advisory branch run independently of `hasRenderArtifactModified()`, combine with the ordinary render advisory, and added a test with no artifact-modified row.
- Gap 6: bound plan lookup to the existing `safeReadBoundGoalplan()` resolver and `state.slug`, defined active-phase criterion filtering and advisory text bodies, and corrected the single call anchor to `hook.ts:1799`.
- Gap 7: the earlier basename-only requirement is replaced below by criterion-bound identity entries for each non-native desktop criterion in a v2+ recorded final gate; legacy, verdict-only, unrelated-criterion and native-only tests cover the split.

## Reflection round 2 dispositions (main)

- Gap 7 was superseded by audit round 1 finding 6: the manifest now binds a validated verdict's `criterionIds` to its identity entry, and the v2+ final gate checks each criterion ID. `coveredRowIds` still binds identity to verdict scenario.
- Schema widening removed: signing mode is `ad-hoc | Developer ID` as the reference says, `bundleIdentifier` is optional, and Rust/Bun versions are optional.
- Native advisory scope: restricted to the active phase's linked criteria only when that phase links criteria; otherwise every open presented-native criterion counts, which matches the original decision for plans that do not link criteria to phases.
- `bundleExecutable` stays a schema check; the validator cannot prove it was read from `Info.plist`. Stated as a residual.

## Audit round 1 folds

- Finding 4: an applicable `app` is a `.app` directory containing `Contents/Info.plist` and has no `sha256`; applicable archive and executable file digests bind the app, with executable architectures required. The QA fixture and negative cases now use a real directory-shaped bundle.
- Finding 5: the final-gate manifest requirement is explicitly scoped to schemaVersion 2+ plans with a recorded final gate. Default v1 plans retain QA ingress checks only; field-chain, activation, bypass, SoT text and tests state that limit.
- Finding 6: desktop artifact verdicts require non-empty `criterionIds`; QA copies them to typed identity manifest entries, the parser compares them with the hashed verdict, and the v2+ gate checks every non-native desktop criterion ID. An unrelated identity or receipt-only ID edit cannot clear another criterion; two-criterion pass and fail cases are specified.
- Finding 7: `artifactErrors()` traverses `identity.components` only when it is an array. An object-valued components fixture must yield validation errors without a thrown exception or receipt.
- Finding 8: manifest parsing mirrors the existing `lstat` and `realpath` evidence-root containment guard and returns `{ error }` on symlink or read failures. A direct symlink and a symlinked parent escaping the evidence root are negative tests.
- Finding 9: main treated the native advisory as a soft session-level reminder, so one observation still clears it for all active native criteria. The bypass table names that residual; any cleared-state diagnostic names the observed app or screenshot. Per-criterion artifact proof remains in 5A.

## Audit round 2 folds

- Finding 2: the `app` component is byte-bound again. It carries `sha256`, the bundle tree digest computed by `sha256Tree` below, and the validator recomputes it (the app branch in `artifactErrors` above now compares it). `app` joins `DIGEST_KINDS`, and `artifactIdentityErrors` requires a lowercase 64-hex `sha256` on an applicable `app` like the other digest kinds. The tree digest covers every file's bytes, every symlink's target and every directory, so editing `Info.plist` or a resource changes it. The archive and executable digests stay as separate bindings. The same function is exported from validate-evidence.mjs so a QA author can compute the value (`node plugins/codexclaw/skills/qa/scripts/validate-evidence.mjs --bundle-digest <path.app>` prints it); the CLI branch is added next to the existing argument parsing at validate-evidence.mjs:235-249.

```js
export function sha256Tree(root) {
  const rootReal = realpathSync(root);
  const hash = createHash("sha256");
  const walk = (dir, rel) => {
    const names = readdirSync(dir).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const name of names) {
      const abs = join(dir, name);
      const relPath = rel ? rel + "/" + name : name;
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) {
        const target = readlinkSync(abs);
        const resolved = realpathSync(abs);
        if (resolved !== rootReal && !resolved.startsWith(rootReal + sep)) {
          throw new Error("bundle symlink escapes the bundle: " + relPath);
        }
        hash.update("L\0" + relPath + "\0" + target + "\n");
      } else if (st.isDirectory()) {
        hash.update("D\0" + relPath + "\n");
        walk(abs, relPath);
      } else if (st.isFile()) {
        hash.update("F\0" + relPath + "\0" + sha256File(abs) + "\n");
      } else {
        hash.update("O\0" + relPath + "\n");
      }
    }
  };
  walk(root, "");
  return hash.digest("hex");
}
```

Imports: add `readdirSync`, `lstatSync`, `readlinkSync` to the existing `node:fs` import and `join` to the `node:path` import. Symlinks are hashed by target and never followed, so a link out of the bundle cannot pull outside bytes into the digest.

New tests in plugins/codexclaw/test/qa-validate-evidence.test.mjs: `app bundle digest matches a directory fixture` (a temp `Demo.app/Contents/{Info.plist,MacOS/Demo,Resources/a.txt}` passes with the digest from `sha256Tree`), `changing a bundle resource invalidates the identity` (rewrite `Resources/a.txt` after computing the digest and assert the named error), and `bundle digest is order and path sensitive` (renaming a resource changes the digest).

- Auditor note on finding 9: narrowed. 5A's per-criterion manifest proof applies to non-native desktop criteria; a `presented: "native"` criterion has only the soft advisory from 5B and the QA verdict the author writes. The bypass table row for 5B states this.

## Audit round 3 folds

- Finding 1: the obsolete "sha256 must be absent" check on `app` is removed; the schema prose, the app test (item 10) and the SoT text now require the tree digest.
- Finding 2: `sha256Tree` resolves every symlink with `realpathSync` and throws when it leaves the bundle; the validator turns that into `app bundle could not be digested: bundle symlink escapes the bundle: <path>`. Internal symlinks are still hashed by their target string. Imports add `realpathSync` from `node:fs` and `sep` from `node:path`. New test: `bundle symlink escaping the app is rejected` (a `Resources/link` pointing at a temp file outside the bundle fails; a link to `../MacOS/Demo` inside it passes).
