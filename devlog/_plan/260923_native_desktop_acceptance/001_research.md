# Primary-source research through Aside

Collected 2026-09-23 with aside-codemode 0.9.2 (`/Users/jun/Developer/aside-codemode`, CLI `codemode --code-file`), `browse.exec` rendered extraction with `fullText`, default Aside account context (public pages, no login needed). Batches reported `status: completed`, every requested item completed, `partial: ["truncated-items"]` because text was capped at 9000 characters per page. Only the excerpts below are relied on. Raw envelopes stayed outside the checkout.

## Tauri v2

| Source | What it establishes |
|---|---|
| https://v2.tauri.app/learn/system-tray/ | Tray needs the `tray-icon` Cargo feature; the API exists in JS and Rust. |
| https://v2.tauri.app/reference/javascript/api/namespacetray/ | `setIconAsTemplate`, `setShowMenuOnLeftClick` (replaces deprecated `setMenuOnLeftClick`). |
| https://v2.tauri.app/develop/sidecar/ | `bundle.externalBin`; each binary needs a `-$TARGET_TRIPLE` suffixed file per supported architecture. |
| https://v2.tauri.app/distribute/sign/macos/ | Free accounts cannot notarize; Developer ID certificate via `APPLE_SIGNING_IDENTITY` or `APPLE_CERTIFICATE` for CI. |
| https://v2.tauri.app/distribute/macos-application-bundle/ | Bundle layout; a user Info.plist is merged with generated values; GUI apps do not inherit shell PATH. |
| https://v2.tauri.app/distribute/dmg/ | DMG layout options; icon sizes and positions are not applied on CI (tauri#1731). |
| https://v2.tauri.app/plugin/updater/ | Updater signatures cannot be disabled; `createUpdaterArtifacts` produces `.app.tar.gz` plus `.sig` on macOS; `pubkey` must be content, not a path. |

## Apple

| Source | What it establishes |
|---|---|
| https://developer.apple.com/documentation/appkit/nsstatusitem | A status item is created by `NSStatusBar.statusItem(withLength:)`; appearance through `button`; `behavior` and `autosaveName` exist. |
| https://developer.apple.com/documentation/appkit/nsglasseffectview | Glass view with `style`, corner radius and tint; container merges nearby glass views. |
| https://developer.apple.com/documentation/servicemanagement/smappservice | macOS 13+ login items, agents, daemons; `register()` launches "subject to user approval"; `status`; `openSystemSettingsLoginItems()`. |
| https://support.apple.com/guide/mac-help/change-login-items-extensions-settings-mtusr003/mac | Login Items & Extensions settings are where people allow items; changing them requires an administrator. |
| https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution | Developer ID certificate, Hardened Runtime, secure timestamp, no `get-task-allow`; plug-ins inherit host entitlements; test after notarization because Gatekeeper may find issues. |
| https://developer.apple.com/documentation/security/resolving-common-notarization-issues | `codesign -vvv --deep --strict` checks nested code at notarization strictness; modifying a bundle after signing invalidates it. |
| https://developer.apple.com/documentation/security/hardened-runtime | Entitlements attach only to executables; libraries and plug-ins inherit from the host. |
| https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.allow-jit | Without `allow-jit`, JIT runtimes may fall back or crash under Hardened Runtime. |
| https://support.apple.com/guide/mac-help/allow-accessibility-apps-to-access-your-mac-mh43185/mac | Accessibility access is granted by the person in Privacy & Security after an alert. |
| https://support.apple.com/guide/mac-help/control-access-to-screen-and-system-audio-recording-mchld6aa7d23/mac | Screen & System Audio Recording is a per-app user decision. |
| https://developer.apple.com/documentation/bundleresources/information-property-list/nsappleeventsusagedescription | Required when an app sends Apple events; the system shows the purpose string. |
| https://support.apple.com/en-us/102445 | Gatekeeper checks Developer ID and notarization; "Open Anyway" in Privacy & Security is the person's explicit confirmation. |
| https://developer.apple.com/documentation/widgetkit | Widgets live in a widget extension and update through timelines. |

## Local manual pages (this Mac)

- `man lipo`: `-verify_arch arch_type ...` takes one input file, and "all of the input files must appear before the -verify_arch flag". So `lipo <file> -verify_arch arm64 x86_64` is valid and the #5535 form `lipo -verify_arch ... <file>` is not.
- `man tccutil`: the only command is `reset`. There is no supported command that grants a privacy permission, which is why grants are human gestures.

## Not verified

- macOS 26 menu-bar item visibility settings and any new "allow in menu bar" flow: no primary page was read. The owner reference must not state them.
