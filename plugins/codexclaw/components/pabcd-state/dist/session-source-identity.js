/** Session state/evidence stay native; only source capture follows the worktree. */
import { resolveSessionSource } from "./session-source.js";
import { captureSourceIdentity,                                          } from "./source-identity.js";

export function captureSessionSourceIdentity(cwd        , sessionId        , options                 = {})                 {
  const sourceCwd = resolveSessionSource(cwd, sessionId);
  const identity = captureSourceIdentity(sourceCwd, sourceCwd === cwd ? options : { excludeCodexclawArtifacts: true, ...options });
  return sourceCwd === cwd ? identity : { ...identity, sourceRoot: sourceCwd };
}
