# macOS System Approvals — Privacy Prompts, Gatekeeper, Login Items, Menu-bar Apps

Last reviewed: 2026-09-23
Applies to: Testing or releasing macOS apps that trigger privacy (TCC) prompts, Gatekeeper first-launch checks, login or background item approval, keychain prompts, or Apple Events automation; menu-bar apps
When to read: A desktop change or its QA meets one of those prompts, or an agent is about to drive System Settings
Canonical owner: dev-devops macOS approval handling
Non-goals: the full desktop acceptance matrix (→ `native-desktop-acceptance.md`); Windows prompts (→ `cross-platform-release.md` §3)

---

## §1 Human-only gestures (MACOS-APPROVAL-HUMAN-01)

These approvals belong to the person at the Mac. The agent never grants them,
including by clicking through computer-use, and never asks the person to let it
click on their behalf.

| Approval | Source |
|---|---|
| Accessibility access for an app | Apple: the person grants it in Privacy & Security after an alert |
| Screen & System Audio Recording | Apple: a per-app decision in Privacy & Security |
| Sending Apple Events to another app (Automation) | Apple: the system shows the app's `NSAppleEventsUsageDescription` |
| Input Monitoring, Full Disk Access, Camera, Microphone, Files and Folders | Engineering practice; same Privacy & Security model |
| Gatekeeper "Open Anyway" for an unnotarized or unidentified app | Apple: the person confirms intent in Privacy & Security |
| A login item, agent or daemon registered through `SMAppService` | Apple: it launches "subject to user approval" |
| Keychain "Always Allow", passwords, administrator authentication | Engineering practice |

`tccutil` can only reset decisions; there is no supported command that grants
one. A tool or script that claims to grant privacy access is a bypass (§2).

## §2 Forbidden bypasses (MACOS-APPROVAL-BYPASS-01)

- Editing `TCC.db` or any privacy database directly.
- Disabling Gatekeeper assessment globally (`spctl --master-disable` and
  equivalents).
- Removing the quarantine attribute (`xattr -d com.apple.quarantine`) from the
  artifact under test. It also voids the Gatekeeper row being tested.
- Disabling System Integrity Protection.
- Ad-hoc re-signing a Developer ID artifact so that it launches.
- UI scripting that clicks an approval for the person (`osascript`, System
  Events, or any automation driving an "Allow" or "Open" control).
- Installing a configuration profile that pre-grants privacy permissions, unless
  the user explicitly asked for that managed-device setup on a test host.

A row that could only pass through one of these stays `fail` or
`needs_human`; it never becomes `pass`.

## §3 Allowed without extra approval (MACOS-APPROVAL-READ-01)

Only on a host where local execution is permitted. Under DESKTOP-NOLOCAL-01
these run on a hosted runner or an authorized native session, or the row stays
`hosted_required`. Launching can change state (a login item may register), so
record what the launch did.

Read-only inspection of the artifact and its effects:

- `codesign -dv`, `codesign -vvv --deep --strict`, `codesign -d --entitlements -`
- `spctl --assess -vv` and `xcrun stapler validate` (engineering practice)
- the app's own diagnostics reporting `SMAppService.status`
- launching the artifact under test and recording that a prompt appeared:
  screenshot plus the exact prompt text

## §4 Only with explicit authorization, on a test host (MACOS-APPROVAL-AUTH-01)

- `tccutil reset <service> <bundle id>` to make a prompt appear again
- `sfltool dumpbtm` (not documented in `man sfltool`; treated as privileged)
- `xcrun notarytool submit`
- temporary CI keychains
- installing or removing login items, agents or daemons

"Authorized" means the user said so for this task and this host. A general
request to test the app is not authorization to reset someone's privacy
decisions.

## §5 Menu-bar apps (MACOS-APPROVAL-MENUBAR-01)

- If the status item is not visible, report that as a finding. Do not change
  system or menu-bar settings to reveal it.
- Capture a prompt triggered from a popup together with the popup's state.
- Never drive Codex itself or the terminal running the agent (cxc-qa Desktop
  GUI rule).
- Record which app or process the prompt text names (engineering practice).
  When a popup runs in a helper, that name can differ from the app the person
  thinks of.

## §6 Recording needs_human rows (MACOS-APPROVAL-RECORD-01)

A `needs_human` row carries:

- the exact instruction for the person, e.g. "System Settings → Privacy &
  Security → Accessibility → turn on <App>"
- the artifact digest from `native-desktop-acceptance.md` §6
- which prompt or setting, and the prompt text observed
- who confirmed, when, and what they saw afterwards

Until that confirmation exists the row stays `needs_human` and the cxc-qa
verdict is `FAIL` with that blocker. Ask with the environment prompt shape in
`cross-platform-release.md` §3 when the person is not at the Mac.

To turn a confirmed row into `PASS`, store the confirmation (the person's
message or a screenshot they took) in the scenario directory, then re-capture
the state after the approval yourself: the setting now on, or the app now doing
what the prompt blocked. Both files go into `artifactRefs`.

## Sources

- Apple Support: [accessibility access](https://support.apple.com/guide/mac-help/allow-accessibility-apps-to-access-your-mac-mh43185/mac), [screen and audio recording](https://support.apple.com/guide/mac-help/control-access-to-screen-and-system-audio-recording-mchld6aa7d23/mac), [safely open apps (Gatekeeper)](https://support.apple.com/en-us/102445), [Login Items & Extensions](https://support.apple.com/guide/mac-help/change-login-items-extensions-settings-mtusr003/mac)
- Apple Developer: [SMAppService](https://developer.apple.com/documentation/servicemanagement/smappservice), [NSAppleEventsUsageDescription](https://developer.apple.com/documentation/bundleresources/information-property-list/nsappleeventsusagedescription)
- `man tccutil` (reset is the only command)
