# wp3: native-desktop acceptance owner and macOS approvals

Two new references under dev-devops, reached from cxc-dev's routing table, with one-line stubs in the owners that already mention desktop, Swift or GUI QA (002 D1, D2). Skill text uses the `desktop` surface from 010. Every claim about Apple or Tauri behavior cites a 001 source; unverified macOS 26 menu-bar behavior is not stated.

## File map

| Op | Path |
|---|---|
| NEW | plugins/codexclaw/skills/dev-devops/references/native-desktop-acceptance.md |
| NEW | plugins/codexclaw/skills/dev-devops/references/macos-system-approvals.md |
| MODIFY | plugins/codexclaw/skills/dev/SKILL.md (routing row after :153) |
| MODIFY | plugins/codexclaw/skills/dev-devops/SKILL.md (description triggers; two Modular References rows after the cross-platform-release row) |
| MODIFY | plugins/codexclaw/skills/dev-devops/agents/openai.yaml (short_description mentions native desktop) |
| MODIFY | plugins/codexclaw/skills/dev/references/skill-ownership.md (two rows after "Local worktree/branch GC") |
| MODIFY | plugins/codexclaw/skills/dev-devops/references/cross-platform-release.md (§2 rows "Desktop app or installer" and "macOS TCC/Keychain/app bundle" point to the new owners) |
| MODIFY | plugins/codexclaw/skills/qa/SKILL.md:62 (Desktop GUI row points to the matrix and approvals reference) |
| MODIFY | plugins/codexclaw/skills/dev-testing/SKILL.md Modular References (pointer row) |
| MODIFY | plugins/codexclaw/skills/dev-frontend/references/stacks/mobile-native.md §1 (macOS desktop route) |
| MODIFY | plugins/codexclaw/skills/dev-debugging/SKILL.md:398 (Swift / iOS / macOS AppKit) |
| MODIFY | structure/INDEX.md:166 (dev-devops row mentions native desktop acceptance) |

Before editing descriptions, wp3 P checks components/subagent-config/test/spawn-attach-hook.test.ts and any other test that reads skill descriptions for length or keyword constraints.

## Routing row (dev/SKILL.md)

```diff
 | DevOps / deploy / infra | `dev-devops` | `dev-security` for credentials |
+| Native desktop: Tauri, AppKit/SwiftUI, WidgetKit, menu-bar/tray apps, embedded sidecars, signing/notarization, macOS approval prompts | `dev-devops` → `references/native-desktop-acceptance.md` and `references/macos-system-approvals.md` | `dev-testing` for suites and CI matrix; `cxc-qa` for gui/cli verdicts; `dev-frontend` for web-view UI; `dev-security` for entitlements and credentials; `dev-debugging` runtimes/swift.md |
```

## dev-devops Modular References rows

```diff
 | `references/cross-platform-release.md` | Cross-platform release proof | ... |
+| `references/native-desktop-acceptance.md` | Tauri, AppKit/SwiftUI, WidgetKit, menu-bar/tray or embedded-runtime changes; desktop regression audits and release readiness | Four-verdict acceptance matrix, CI vs release path map, baseline classes, artifact identity, FFI/sidecar/universal checks, popup scenarios, no-local-execution path |
+| `references/macos-system-approvals.md` | A desktop change or test meets TCC, Gatekeeper, login/background item, keychain or Apple Events prompts | Which approvals are human gestures, forbidden bypasses, allowed checks, how to record needs_human rows |
```

## skill-ownership.md rows

```diff
+| Native desktop acceptance matrix (`DESKTOP-*`) | `dev-devops` `references/native-desktop-acceptance.md` | `dev` routing table, `dev-testing`, `qa`, `cross-platform-release.md`, `mobile-native.md`, `dev-debugging` runtimes/swift.md |
+| macOS system approval prompts (`MACOS-APPROVAL-*`) | `dev-devops` `references/macos-system-approvals.md` | `cross-platform-release.md` §2/§3, `qa` Desktop GUI row |
```

## native-desktop-acceptance.md contents

Header block in the house style (Last reviewed 2026-09-23, Applies to, When to read, Canonical owner, Non-goals: building apps, iOS/Android → mobile-native.md). Target length 180-260 lines. Sections and their binding rules:

1. §1 Scope and triggers (DESKTOP-SCOPE-01). Load for Tauri, AppKit/SwiftUI, WidgetKit, menu-bar/tray, native window effects, embedded runtimes/sidecars, or desktop release readiness. A Swift/Rust change that alters a presented native surface triggers UI rows; a non-UI model change triggers runtime and packaging rows only, never blanket screenshot demands. Goalplan criteria for these rows use `--surface desktop` (0.2.37+), which makes the final gate require a QA receipt.
2. §2 Acceptance matrix (DESKTOP-MATRIX-01). One row per boundary. Columns: row id, boundary, scenario, verdict class (UI, runtime, packaging, distribution), evidence level, state, artifact id, baseline class. Evidence levels, weakest to strongest: source review, host-only build, signed bundle inspection, bundled runtime launch, native interaction, publication. A weaker level never satisfies a row that names a stronger one. States: pass, fail, not_verified, needs_human, hosted_required, na. Mapping to cxc-qa verdicts: UI rows are `gui` verdicts with captureChecks; runtime and packaging rows are `cli` verdicts; not_verified, needs_human and hosted_required roll up as QA FAIL with the blocker named, because cxc-qa has no skip.
3. §3 Downstream rule (DESKTOP-DOWNSTREAM-01). A failure at one level leaves every row that depends on it not_verified; after a repair, review every assertion the repair newly makes reachable (the #5338/#5351 masked bundle assertion is the example).
4. §4 CI versus release path (DESKTOP-CI-MAP-01). Before claiming audit or release readiness, tabulate ordinary CI against the release workflow for: architectures, Bun/Rust/Xcode/SDK/deployment target, sidecar preparation, signing mode and entitlements, nested .appex, DMG and updater artifacts, final-artifact execution, install/upgrade coexistence. Run supported non-publishing release-equivalent jobs early. Never give signing secrets to untrusted PR code. Host-only ad-hoc CI coverage is not release coverage.
5. §5 Baseline classification (DESKTOP-BASELINE-01). Each row is unchanged, regressed, new, removed or repair-introduced, against a real baseline oracle or with "baseline absent". A baseline without the desktop surface produces new-feature obligations, never "no desktop regressions".
6. §6 Artifact identity (DESKTOP-ARTIFACT-01). Record `artifact-identity.json` in the QA artifactRefs: bundle path and CFBundleExecutable read from Info.plist, `lipo -archs` for host executable, sidecar and extension, SHA-256 of app archive/sidecar/DMG/updater tarball, signing mode, team id, entitlements (`codesign -d --entitlements -`), `xcode-select -p`, SDK, `swiftc --version`, covered row ids. A changed digest or signing configuration invalidates only rows bound to that component. Derive executable paths from CFBundleExecutable, never a hardcoded name.
7. §7 Tauri, Rust and Swift boundary (DESKTOP-FFI-01). Exported `@_cdecl` symbols match Rust `extern "C"` declarations (`nm` on the archive and the final executable); the archive build.rs emitted is the one linked; AppKit calls happen on the main thread; borrowed pointers are copied before return and callbacks torn down; minimum OS values agree between swiftc -target and Package.swift; glass versus fallback depends on toolchain and runtime OS, and a symbol check does not prove visible material. A SwiftPM/Xcode build is not proof of the Cargo-linked app.
8. §8 WidgetKit (DESKTOP-WIDGET-01). Separate product and packaging contract (application-extension compile, extension entry point, Contents/PlugIns placement, its own signature). Widget success and menu-bar success do not stand in for each other.
9. §9 Sidecars and universal binaries (DESKTOP-UNIVERSAL-01). Target-triple suffixed externalBin names (001 Tauri sidecar); the universal file exists under the name Tauri expects; each embedded executable reports both architectures; the bundled CLI runs from the final signed bundle with its final entitlements (JIT runtimes need `com.apple.security.cs.allow-jit`, 001). Architecture checks use `lipo <file> -verify_arch arm64 x86_64` (input file first, per man lipo) or `lipo -archs <file>`. Proof comes from a real runner executing the command against the artifact; a test that string-matches the command line is not an oracle.
10. §10 Menu-bar and popup scenarios (DESKTOP-POPUP-01). Plain desktop behind the popup and another window behind it; light and dark appearance; corner and background clipping; bounded scrolling with a visible footer; focus, Escape, click-outside dismissal and reopen; multiple displays and the notch; full-screen Space; auto-hidden menu bar. Capture the native panel itself; a browser or React dashboard screenshot cannot satisfy a native panel row. Status item geometry comes from NSStatusItem.button (001). Scenarios that need a person are needs_human rows with exact instructions.
11. §11 Signing, notarization and distribution (DESKTOP-DIST-01). Developer ID certificate, Hardened Runtime, secure timestamp, no get-task-allow; `codesign -vvv --deep --strict` on the final bundle; `spctl --assess -vv`; `xcrun stapler validate`; updater signatures and pubkey as content (001). Modifying a bundle after signing invalidates the signature. Notarized is not the same as launch-tested.
12. §12 No-local-execution path (DESKTOP-NOLOCAL-01). When the user forbids local runs, rows become hosted_required (a hosted macOS runner or authorized native session can execute them) or not_verified. Human acceptance covers only the scenario the person states. Source-string tests and reviewer attestations never replace tool execution.
13. §13 Report shape. Separate UI, runtime, packaging and distribution verdicts in the final report; never one "desktop OK".

## macos-system-approvals.md contents

Header block as above; target 90-140 lines.

1. §1 Human-only gestures (MACOS-APPROVAL-HUMAN-01). The agent never grants or clicks, including through computer-use: TCC grants (Accessibility, Screen & System Audio Recording, Input Monitoring, Automation/Apple Events, Full Disk Access, Camera, Microphone, Files and Folders), Gatekeeper "Open" or "Open Anyway", login/background item approval after SMAppService registration, keychain "Always Allow" or password entry, administrator authentication. Sources: 001 Apple support pages and `man tccutil` (no grant command exists).
2. §2 Forbidden bypasses (MACOS-APPROVAL-BYPASS-01). Editing TCC.db, `spctl --master-disable` or global assessment changes, `xattr -d com.apple.quarantine` on the artifact under test (it also voids the Gatekeeper row), disabling SIP, ad-hoc re-signing a Developer ID artifact to make it launch.
3. §3 Allowed without extra approval (MACOS-APPROVAL-READ-01). `codesign -dv`, `codesign -vvv --deep --strict`, `codesign -d --entitlements -`, `spctl --assess -vv`, `xcrun stapler validate`, reading SMAppService.status from the app's own diagnostics, launching the artifact and recording that a prompt appeared (screenshot plus exact prompt text).
4. §4 Only with explicit authorization, on a test host (MACOS-APPROVAL-AUTH-01). `tccutil reset <service> <bundle id>` to re-trigger a prompt, `sfltool dumpbtm` (may need administrator rights), `xcrun notarytool submit`, temporary CI keychains, installing or removing login items.
5. §5 Menu-bar apps (MACOS-APPROVAL-MENUBAR-01). Status items may be hidden by space or by the person's settings; the agent reports a missing item instead of changing settings. Prompts triggered from a popup are captured with the popup state. Do not drive Codex itself or the terminal running the agent (qa Desktop GUI rule).
6. §6 Recording (MACOS-APPROVAL-RECORD-01). A needs_human row carries the exact instruction for the person, the artifact digest from DESKTOP-ARTIFACT-01, which prompt and setting, who confirmed and when. Without that confirmation the row stays needs_human and the QA verdict is FAIL with that blocker.

## Stubs (one line each, pointer only)

- cross-platform-release.md §2: append "Full matrix: native-desktop-acceptance.md; prompts: macos-system-approvals.md" to the two desktop/macOS rows' proof bundle cells.
- qa/SKILL.md:62 Desktop GUI row: add "native panels, menu-bar popups and approval prompts: dev-devops native-desktop-acceptance.md §10 and macos-system-approvals.md".
- dev-testing Modular References: row "`../dev-devops/references/native-desktop-acceptance.md` | Desktop app suites and CI matrix | Owned by dev-devops; test suites plug into its rows".
- mobile-native.md §1: row "macOS desktop (Tauri, AppKit, menu-bar) | `dev-devops/references/native-desktop-acceptance.md`".
- dev-debugging/SKILL.md:398: "Swift / iOS / macOS AppKit".

## Verification

`npm test` (link and inventory tests read skills), `npm run gate`, and a grep proving the routing row, two reference rows and two ownership rows exist and every relative link in the new files resolves (`node` one-liner over markdown links, run at C). Prose correctness is human review against 001.
