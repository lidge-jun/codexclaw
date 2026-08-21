/**
 * wsl.test.ts - wp07 (plan 060). Every probe is injected through WslDeps, so
 * both the WSL and the non-WSL branch run on one CI OS.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  automountRoot,
  filesystemTier,
  isWindowsInteropDir,
  isWslRuntime,
  windowsHomeToWslPath,
} from "../src/wsl.ts";

// ---- isWslRuntime ---------------------------------------------------------

test("non-linux is never WSL", () => {
  assert.equal(isWslRuntime({ platform: "win32", env: { WSL_DISTRO_NAME: "Ubuntu" } }), false);
});

test("WSL_DISTRO_NAME alone is enough", () => {
  assert.equal(isWslRuntime({ platform: "linux", env: { WSL_DISTRO_NAME: "Ubuntu" }, procVersion: null }), true);
});

test("WSL_INTEROP alone is enough", () => {
  assert.equal(isWslRuntime({ platform: "linux", env: { WSL_INTEROP: "/run/WSL/8_interop" }, procVersion: null }), true);
});

test("/proc/version microsoft matches", () => {
  assert.equal(
    isWslRuntime({
      platform: "linux",
      env: {},
      procVersion: "Linux version 5.15.90.1-microsoft-standard-WSL2",
    }),
    true,
  );
});

test("a plain Linux kernel is not WSL", () => {
  assert.equal(isWslRuntime({ platform: "linux", env: {}, procVersion: "Linux version 6.8.0-generic" }), false);
});

test("an unreadable /proc/version is not WSL", () => {
  assert.equal(isWslRuntime({ platform: "linux", env: {}, procVersion: null }), false);
});

// ---- automountRoot --------------------------------------------------------

test("automountRoot defaults to /mnt", () => {
  assert.equal(automountRoot({ wslConf: null }), "/mnt");
  assert.equal(automountRoot({ wslConf: "[network]\nhostname = box\n" }), "/mnt");
});

test("automountRoot parses root = /", () => {
  assert.equal(automountRoot({ wslConf: "[automount]\nroot = /\n" }), "/");
});

test("automountRoot strips comments and quotes", () => {
  assert.equal(automountRoot({ wslConf: '[automount]\nroot = "/mnt/win" # trailing\n' }), "/mnt/win");
});

test("automountRoot is case-insensitive on the key", () => {
  assert.equal(automountRoot({ wslConf: "[automount]\nRoot = /w\n" }), "/w");
});

test("a relative root falls back to /mnt", () => {
  assert.equal(automountRoot({ wslConf: "[automount]\nroot = mnt\n" }), "/mnt");
});

test("a key outside [automount] is ignored", () => {
  assert.equal(automountRoot({ wslConf: "[network]\nroot = /nope\n" }), "/mnt");
});

// ---- isWindowsInteropDir --------------------------------------------------

test("isWindowsInteropDir honors a custom root", () => {
  assert.equal(isWindowsInteropDir("/w/c/Users/x", "/w"), true);
  assert.equal(isWindowsInteropDir("/mnt/c/Users/x", "/w"), false);
});

test("isWindowsInteropDir requires a single-letter drive component", () => {
  assert.equal(isWindowsInteropDir("/mnt/data/project"), false);
  assert.equal(isWindowsInteropDir("/mnt/c"), true);
});

test("a regex-metacharacter root does not throw", () => {
  assert.equal(isWindowsInteropDir("/m+nt/c/proj", "/m+nt"), true);
  assert.equal(isWindowsInteropDir("/mxnt/c/proj", "/m+nt"), false);
});

// ---- windowsHomeToWslPath -------------------------------------------------

test("windowsHomeToWslPath lowercases the drive", () => {
  assert.equal(windowsHomeToWslPath("C:\\Users\\super"), "/mnt/c/Users/super");
});

test("windowsHomeToWslPath honors root = /", () => {
  assert.equal(windowsHomeToWslPath("C:\\Users\\super", "/"), "/c/Users/super");
});

test("a non-Users path returns null", () => {
  assert.equal(windowsHomeToWslPath("C:\\Temp"), null);
});

// ---- filesystemTier -------------------------------------------------------

const MOUNTS = [
  "/dev/sdc / ext4 rw,relatime 0 0",
  "none /mnt/wslg tmpfs rw 0 0",
  "C:\\134 /mnt/c drvfs rw,noatime 0 0",
  "\\\\wsl$\\share /mnt/net 9p rw,trans=virtio 0 0",
].join("\n");

test("filesystemTier picks the LONGEST covering mount", () => {
  assert.equal(
    filesystemTier("/mnt/c/proj/.codexclaw", { platform: "linux", procMounts: MOUNTS }),
    "drvfs",
  );
  assert.equal(
    filesystemTier("/home/u/proj/.codexclaw", { platform: "linux", procMounts: MOUNTS }),
    "native",
  );
});

test("9p is its own tier", () => {
  assert.equal(filesystemTier("/mnt/net/proj", { platform: "linux", procMounts: MOUNTS }), "9p");
});

test("UNC paths on win32 classify as unc", () => {
  assert.equal(filesystemTier("\\\\server\\share\\proj", { platform: "win32" }), "unc");
  assert.equal(filesystemTier("\\\\?\\UNC\\server\\share\\proj", { platform: "win32" }), "unc");
  assert.equal(filesystemTier("C:\\proj", { platform: "win32" }), "native");
});

test("an unreadable /proc/mounts is unknown, not native", () => {
  assert.equal(filesystemTier("/home/u/proj", { platform: "linux", procMounts: null }), "unknown");
});
