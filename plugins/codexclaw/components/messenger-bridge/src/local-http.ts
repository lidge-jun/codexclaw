/** Shared loopback API boundary used by both `cxc serve` and the Vite dev server. */
import type { IncomingMessage } from "node:http";

export const MAX_LOCAL_JSON_BYTES = 1_000_000;
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export class BodyTooLargeError extends Error {
  constructor() {
    super(`body exceeds ${MAX_LOCAL_JSON_BYTES} bytes`);
    this.name = "BodyTooLargeError";
  }
}

function loopbackHost(raw: string | undefined): boolean {
  if (!raw) return true;
  const host = raw.trim().toLowerCase();
  return /^(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(host) || /^\[::1\](?::\d+)?$/.test(host);
}

/**
 * Reject browser-driven loopback mutations before route dispatch.
 *
 * [Decision Log]
 * - 목적과 의도: dev/prod API의 CSRF 및 DNS rebinding 방어를 동일하게 유지한다.
 * - 기존 구현 및 제약 조건: 운영 서버만 방어했고 Vite middleware는 text/plain POST를 허용했다.
 * - 검토한 주요 대안: Origin allowlist, 세션 토큰, JSON+custom-header 경계.
 * - 선택한 방식: loopback Host와 JSON content type, preflight를 강제하는 custom header를 함께 검사한다.
 * - 다른 대안 대신 이 방식을 선택한 이유: 인증 상태를 새로 만들지 않고 기존 GUI 동작을 보존한다.
 * - 장점, 단점 및 영향: 두 서버가 같은 정책을 공유한다. 비브라우저 클라이언트도 헤더를 보내야 한다.
 */
export function localRequestRejection(req: Pick<IncomingMessage, "method" | "headers">): string | null {
  if (!loopbackHost(req.headers.host)) return "bad host";
  if (!MUTATING.has(req.method ?? "")) return null;
  const contentType = String(req.headers["content-type"] ?? "").toLowerCase();
  if (!contentType.includes("application/json")) return "content-type must be application/json";
  if (req.headers["x-codexclaw-local"] !== "1") return "missing x-codexclaw-local header";
  return null;
}

/** Parse a bounded JSON request without ever retaining more than `maxBytes`. */
export function readBoundedJson(req: IncomingMessage, maxBytes = MAX_LOCAL_JSON_BYTES): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"] ?? 0);
    if (Number.isFinite(declared) && declared > maxBytes) {
      req.resume();
      reject(new BodyTooLargeError());
      return;
    }

    const chunks: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    const fail = (err: Error): void => {
      if (settled) return;
      settled = true;
      chunks.length = 0;
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      req.resume();
      reject(err);
    };
    const onData = (chunk: Buffer | string): void => {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += data.length;
      if (bytes > maxBytes) {
        fail(new BodyTooLargeError());
        return;
      }
      chunks.push(data);
    };
    const onEnd = (): void => {
      if (settled) return;
      settled = true;
      const raw = Buffer.concat(chunks, bytes).toString("utf8");
      if (!raw) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    };
    req.on("data", onData);
    req.once("end", onEnd);
    req.once("error", fail);
  });
}
