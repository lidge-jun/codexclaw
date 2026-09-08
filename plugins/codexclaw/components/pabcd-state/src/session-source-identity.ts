/** Session state/evidence stay native; only source capture follows the worktree. */
import { resolveSessionSource } from "./session-source.ts";
import { captureSourceIdentity, type CaptureOptions, type SourceIdentity } from "./source-identity.ts";

export function captureSessionSourceIdentity(cwd: string, sessionId: string, options: CaptureOptions = {}): SourceIdentity {
  const sourceCwd = resolveSessionSource(cwd, sessionId);
  const identity = captureSourceIdentity(sourceCwd, sourceCwd === cwd ? options : { excludeCodexclawArtifacts: true, ...options });
  return sourceCwd === cwd ? identity : { ...identity, sourceRoot: sourceCwd };
}
