# Homebrew — Formula & Cask Distribution

Last reviewed: 2026-06-21
Applies to: Homebrew Formulae, Homebrew Casks, taps, CLI package distribution on macOS/Linux
When to read: Updating or creating Homebrew distribution for a released artifact
Canonical owner: dev-devops Homebrew distribution guidance

---

## §1 Boundary

Homebrew is a downstream distribution channel. It does not replace upstream
package provenance.

Examples:

- npm package provenance still comes from npm Trusted Publishing.
- PyPI package provenance still comes from PyPI Trusted Publisher.
- Homebrew proof verifies that the tap installs the intended upstream artifact
  and exposes the expected command/app behavior.

## §2 Formula vs Cask

| Use | Choose | Typical artifact |
|---|---|---|
| CLI built from source or bottled binary | Formula | tarball, source archive, binary release |
| macOS app bundle/pkg/dmg | Cask | `.app`, `.pkg`, `.dmg`, `.zip` |
| Both CLI and app exist | Usually Formula for CLI, Cask for app | Separate install paths and tests |

Ask for this classification before writing Homebrew guidance. Do not mix
Formula-only checks with Cask-only artifacts.

## §3 Formula Proof Bundle

Formula work should prove:

- stable tagged version or immutable release URL;
- URL and SHA256 match the intended artifact;
- dependencies are declared with `depends_on`;
- `test do` verifies the installed binary/library behavior;
- `brew test <formula>` passes;
- `brew audit <formula>` passes;
- `brew audit --strict --online <formula>` is used for public tap/core-quality
  checks when network access is appropriate;
- version output matches the upstream release.

Minimal Formula shape:

```ruby
class ToolName < Formula
  desc "Short user-facing description"
  homepage "https://example.com/tool"
  url "https://github.com/org/tool/archive/refs/tags/v1.2.3.tar.gz"
  sha256 "..."
  license "MIT"

  def install
    bin.install "tool"
  end

  test do
    assert_match "1.2.3", shell_output("#{bin}/tool --version")
  end
end
```

## §4 Cask Proof Bundle

Cask work should prove:

- `version`, `sha256`, `url`, and `name`/`desc` are correct;
- `livecheck` is present when feasible;
- `depends_on` captures macOS or architecture requirements;
- `app`, `binary`, `pkg`, or other artifact stanza matches the real install
  shape;
- uninstall and `zap` behavior are documented for persistent user files;
- artifact trust is considered because vendor installers can write outside the
  Caskroom;
- install and uninstall behavior is verified on macOS when the release claim
  depends on it.

Minimal Cask shape:

```ruby
cask "tool-name" do
  version "1.2.3"
  sha256 "..."

  url "https://example.com/tool-#{version}.dmg"
  name "Tool Name"
  desc "Short user-facing description"
  homepage "https://example.com/tool"

  app "Tool.app"
  zap trash: [
    "~/Library/Application Support/Tool",
    "~/Library/Preferences/com.example.tool.plist",
  ]
end
```

## §5 Channel Alignment

For tools released through npm/PyPI and Homebrew, verify:

- upstream release exists before Homebrew update;
- Homebrew version matches upstream version;
- installed command reports the same version;
- Homebrew binary path does not shadow or conflict with the upstream package
  manager path without documenting the expected precedence.

## §6 Common Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Treating Homebrew as the canonical release | Publish canonical package first, update tap second |
| Missing `test do` in Formula | Add an install-time behavior check |
| No SHA256 or mutable artifact URL | Use immutable release artifact and checksum |
| Cask without uninstall/zap thinking | Document uninstall and persistent user data behavior |
| Claiming macOS install behavior from Linux CI only | Use macOS runner or direct macOS verification when local behavior matters |
