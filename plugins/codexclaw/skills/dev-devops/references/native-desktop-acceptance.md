# Native Desktop Acceptance — Tauri, AppKit/SwiftUI, WidgetKit, Menu-bar Apps

Last reviewed: 2026-09-23
Applies to: Tauri apps, AppKit/SwiftUI code linked into another host (Swift static library + C ABI), WidgetKit extensions, menu-bar/tray apps, native window materials, embedded runtimes and sidecars, macOS desktop release paths
When to read: A change touches one of those surfaces, or you are asked for a desktop regression audit or release readiness
Canonical owner: dev-devops native desktop acceptance
Non-goals: building a desktop app for the user; iOS/Android (→ `dev-frontend/references/stacks/mobile-native.md`); approval prompts in depth (→ `macos-system-approvals.md`)

---

## §1 Scope and triggers (DESKTOP-SCOPE-01)

A desktop app is several products in one bundle: a UI, a host runtime, embedded
executables, extensions, and a signed, distributed artifact. Source review,
host-only CI and a screenshot each cover one of them. Name which one before
claiming anything.

- A Swift, Rust or web change that alters a **presented native surface** (panel,
  popover, window, material, tray menu) triggers UI rows.
- A non-UI change (a Swift model, a Rust command, a sidecar flag) triggers
  runtime and packaging rows only. Do not demand screenshots for code nobody sees.
- A signing, entitlement, bundle-layout, architecture or updater change triggers
  packaging and distribution rows even when no code changed.

When a goalplan tracks this work, register each such criterion on a
session-bound plan with `cxc loop add-criterion --session <id> --criterion <text>
--surface desktop` (codexclaw 0.2.37+; `init` refuses `--surface`). Without a
recorded final gate that is a classification you must honor by producing this
matrix. Validation on schemaVersion 2+ plans with a final gate, and the final-gate
spawn guard on any plan with a recorded `finalGate`, also make the QA receipt
mandatory. Builds older than 0.2.37 drop `desktop` on read and erase it on their
next write, so every host that edits the plan needs 0.2.37 or newer.

## §2 Acceptance matrix (DESKTOP-MATRIX-01)

One row per boundary, never one "desktop OK" row.

| Column | Content |
|---|---|
| Row id | Stable id, e.g. `D-UI-03` |
| Boundary | What joins what: popup ↔ status item, Rust ↔ Swift ABI, app ↔ sidecar |
| Scenario | The exact situation exercised |
| Verdict class | UI, runtime, packaging or distribution |
| Required level | The weakest evidence level that can prove this row (ladder below) |
| Achieved level | The level the evidence actually reached |
| State | pass, fail, not_verified, needs_human, hosted_required, na |
| Artifact id | Which artifact the evidence came from (§6) |
| Baseline class | §5 |

Evidence levels, weakest to strongest: source review → host-only build → signed
bundle inspection → bundled runtime launch → native interaction → publication.
A row can pass only when the achieved level is at least the required level.

Mapping to cxc-qa: each row is one cxc-qa scenario whose scenario id is the row
id; `note` carries the state, required and achieved levels. UI rows are `gui`
verdicts with `captureChecks`. Runtime, packaging and distribution rows are
`cli` verdicts, except a distribution row observed as a dialog (Gatekeeper),
which is `gui`. `not_verified`, `needs_human` and `hosted_required` roll up as
QA `FAIL` with the blocker named, because cxc-qa has no skip. `na` maps to
`NA` and needs the recorded structural reason cxc-qa requires. Evidence from a
hosted runner enters the scenario directory as the downloaded job log or
artifact, with the run id, attempt and head SHA recorded (cxc-dev
DEV-CI-EVIDENCE-01). The hosted head SHA must equal the verdict's
`sourceSnapshotAt.commitSha` on a clean tree; otherwise the row stays
`not_verified`, because nothing else checks that the run built this tree.

Example rows for a change to a Tauri tray popup rendered by a native panel:

| Row | Boundary and scenario | Class | Required | Achieved | State |
|---|---|---|---|---|---|
| D-UI-01 | Popup opened over another app's window, dark appearance | UI | native interaction | native interaction | pass |
| D-UI-02 | Popup content longer than the panel: scroll bounded, footer visible | UI | native interaction | source review | not_verified |
| D-RT-01 | Bundled CLI runs from the signed app with final entitlements | runtime | bundled runtime launch | bundled runtime launch | pass |
| D-PK-01 | `lipo -archs` on app executable and sidecar equals `x86_64 arm64` | packaging | signed bundle inspection | host-only build | not_verified |
| D-DS-01 | `xcrun stapler validate` on the notarized DMG | distribution | signed bundle inspection | — | hosted_required |
| D-DS-02 | First launch of the downloaded DMG app shows the expected Gatekeeper dialog | distribution | native interaction | — | needs_human |

## §3 Downstream rows (DESKTOP-DOWNSTREAM-01)

A failure at one level leaves every row that depends on it `not_verified`: a
build that fails before bundling cannot say anything about launch, notarization
or installation. After a repair, review every assertion the repair newly makes
reachable. A removed upstream failure often exposes an assertion that was never
executed, such as a hardcoded executable path that the bundle does not declare.

## §4 Ordinary CI versus the release path (DESKTOP-CI-MAP-01)

Before claiming a regression audit or release readiness, tabulate what ordinary
CI builds against what the release workflow ships:

| Dimension | Ordinary CI | Release path |
|---|---|---|
| Architectures | often host-only | universal or per-arch set |
| Toolchains | Bun/Rust/Xcode/SDK/deployment target as pinned in CI | as used by release |
| Sidecar preparation | may be skipped | target-triple names, universal merge |
| Signing | ad-hoc, no secrets | Developer ID, entitlements, timestamp |
| Nested bundles | may be absent | `.appex`, frameworks, helpers |
| Distribution | usually none | DMG, updater archive and signature |
| Final artifact execution | rarely | launch and bundled CLI execution |
| Install/upgrade | never | coexistence with an existing install |

Every row where the columns differ is coverage ordinary CI does not provide.
Run the supported non-publishing release-equivalent job (dry run) early rather
than discovering each difference in turn. Never give signing secrets to
untrusted pull-request code.

## §5 Baseline classification (DESKTOP-BASELINE-01)

Classify each row as unchanged, regressed, new, removed or repair-introduced,
against a real baseline oracle: an earlier artifact you actually ran, not a
memory of one. If the baseline version has no desktop surface at all, write
"baseline absent" and treat the rows as new-feature obligations. "No desktop
regressions" is not a finding when there was no desktop to regress.

## §6 Artifact identity (DESKTOP-ARTIFACT-01)

Bind evidence to the artifact it came from. Record `artifact-identity.json` in
the QA `artifactRefs`:

- bundle path and `CFBundleExecutable` read from the bundle's `Info.plist`;
  derive executable paths from it, never from a hardcoded name
- `lipo -archs` output for the host executable, each sidecar and each extension
- SHA-256 of the app archive, sidecars, DMG and updater archive
- signing mode (ad-hoc or Developer ID), team id, and the entitlements the
  signature carries (`codesign -d --entitlements -`)
- `xcode-select -p`, SDK, `swiftc --version`, and the Rust/Bun versions used
- the row ids this artifact covers

A changed digest or signing configuration invalidates only the rows bound to
that component. An ad-hoc single-architecture `.app` never satisfies a
universal Developer ID, DMG or updater row.

## §7 Tauri, Rust and Swift boundary (DESKTOP-FFI-01)

When Swift UI code is compiled into a static library and linked into the Tauri
executable:

- Swift `@_cdecl` exports match the Rust `extern "C"` declarations. Check with
  `nm` on the archive and on the final executable.
- The archive the build script emitted is the one that was linked. A SwiftPM or
  Xcode build of the same sources proves nothing about the Cargo-linked app.
- Status-item and panel calls stay on the AppKit main thread (engineering
  practice).
- Borrowed pointers are copied before the call returns; callbacks are torn down
  with the panel.
- Minimum OS values agree between the `swiftc -target` triple and
  `Package.swift`, or the difference is a recorded decision.
- Glass materials (`NSGlassEffectView`) versus the fallback view depend on the
  build toolchain and the runtime OS. A symbol check proves the code path
  exists, not that the material is visible or clipped correctly.

## §8 WidgetKit (DESKTOP-WIDGET-01)

Widgets live in their own extension and update through timelines. In practice
the extension has its own build product, compile mode, entry point, placement
under `Contents/PlugIns` and signature (the OpenCodex case in codexclaw issue
#232). Widget success says nothing about the menu-bar panel, and the reverse.

## §9 Sidecars and universal binaries (DESKTOP-UNIVERSAL-01)

- Tauri `bundle.externalBin` needs a file with a `-<target-triple>` suffix for
  every supported architecture. A universal build also needs a universal
  sidecar under the name the bundler looks for (in the #232 case,
  `ocx-universal-apple-darwin`); confirm the expected name from the failing or
  succeeding bundler run, not from memory.
- Each embedded executable reports exactly the expected architectures.
- The bundled CLI runs from the **final signed bundle** with its final
  entitlements. JIT runtimes under Hardened Runtime need
  `com.apple.security.cs.allow-jit`, or they may fall back or crash.
- Check architectures with `lipo -archs <file>` compared to the expected set
  exactly (`arm64` and `arm64e` are different names), or one
  `lipo <file> -verify_arch <arch>` call per architecture. Passing several
  architectures to one `-verify_arch` behaves differently across toolchains:
  Command Line Tools 27.0 refused it in either argument order, and Xcode 26.6
  rejected the file-last form. Never prescribe a form from the manual alone;
  record `xcode-select -p` and the tool version with the result.
- Proof comes from a runner executing the command against the artifact. A test
  that string-matches the command line repeats the author's assumption and is
  not an oracle.

## §10 Menu-bar and popup scenarios (DESKTOP-POPUP-01)

Capture the native panel itself. A browser or web-dashboard screenshot cannot
satisfy a native panel row. The status item is customized through its
`button`; record where the panel appeared relative to it on each display.

| Scenario | Why it breaks |
|---|---|
| Plain desktop behind the popup, and another window behind it | Materials and corner clipping render differently over content |
| Light and dark appearance | Material and text contrast |
| Long content | Scrolling must stay bounded and the footer visible |
| Focus, Escape, click outside, reopen | Panels that do not dismiss or reopen cleanly |
| Several displays and the notch | Placement relative to the status item |
| Full-screen Space, auto-hidden menu bar | Panel never appears or appears off-screen |

Scenarios that need a person, or a prompt only a person may answer, are
`needs_human` rows with exact instructions (`macos-system-approvals.md` §6).

## §11 Signing, notarization and distribution (DESKTOP-DIST-01)

- Notarization needs a Developer ID certificate, Hardened Runtime, a secure
  timestamp and no `get-task-allow` entitlement.
- Entitlements attach to executables. Shared libraries, frameworks and
  in-process plug-ins inherit the host's; app extensions, widgets included, are
  separate executables with their own signature and entitlements. Check each
  with `codesign -d --entitlements -`.
- `codesign -vvv --deep --strict` checks nested code at notarization
  strictness. Changing any file in a bundle after signing invalidates it.
- `spctl --assess -vv` and `xcrun stapler validate` on the distributed
  artifact (engineering practice).
- Tauri updater signatures cannot be disabled; `createUpdaterArtifacts` produces
  the `.app.tar.gz` and `.sig`; `pubkey` must be the key content, not a path.
- Notarized is not launch-tested. Apple notes that some software fails to run
  after notarization because Gatekeeper enforces checks a relaxed notarization
  did not, and advises testing before distribution.

## §12 When local execution is not allowed (DESKTOP-NOLOCAL-01)

If the user forbids local runs, keep every row and mark it `hosted_required`
(a hosted macOS runner or an authorized native session can execute it) or
`not_verified`. A person's acceptance covers only the scenario they state.
Source-string tests and reviewer attestations never replace executing the tool.

## §13 Report shape

Report UI, runtime, packaging and distribution verdicts separately, each with
its rows, evidence levels and artifact ids, and list every row that is not
`pass` with its blocker.

## Sources

- Tauri v2: [System tray](https://v2.tauri.app/learn/system-tray/), [tray API](https://v2.tauri.app/reference/javascript/api/namespacetray/), [sidecars](https://v2.tauri.app/develop/sidecar/), [macOS signing](https://v2.tauri.app/distribute/sign/macos/), [app bundle](https://v2.tauri.app/distribute/macos-application-bundle/), [DMG](https://v2.tauri.app/distribute/dmg/), [updater](https://v2.tauri.app/plugin/updater/)
- Apple: [NSStatusItem](https://developer.apple.com/documentation/appkit/nsstatusitem), [NSGlassEffectView](https://developer.apple.com/documentation/appkit/nsglasseffectview), [WidgetKit](https://developer.apple.com/documentation/widgetkit), [notarizing](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution), [common notarization issues](https://developer.apple.com/documentation/security/resolving-common-notarization-issues), [Hardened Runtime](https://developer.apple.com/documentation/security/hardened-runtime), [allow-jit](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.allow-jit)
- The OpenCodex case: codexclaw issue #232. Executed `lipo` results: repository devlog `260923_native_desktop_acceptance/001_research.md` (not shipped in the plugin payload)
