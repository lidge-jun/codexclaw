import { open, rm } from "node:fs/promises";

export const MEDIA_DOWNLOAD_TIMEOUT_MS = 30_000;

interface WritableFile {
  write(buffer: Uint8Array, offset?: number, length?: number, position?: number | null): Promise<{ bytesWritten: number }>;
}

/** Node permits partial writes; loop until every byte has reached the file. */
export async function writeAll(file: WritableFile, data: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < data.byteLength) {
    const { bytesWritten } = await file.write(data, offset, data.byteLength - offset, null);
    if (bytesWritten <= 0) throw new Error("attachment write made no progress");
    offset += bytesWritten;
  }
}

/** Stream an HTTP body into a private file while enforcing declared and actual size. */
export async function streamResponseToFile(
  response: Response,
  target: string,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<number> {
  if (signal?.aborted) throw new Error("download timed out", { cause: signal.reason });
  const declared = Number(response.headers?.get?.("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`attachment too large before stream: ${declared} > ${maxBytes}`);
  }
  if (!response.body) {
    const data = new Uint8Array(await response.arrayBuffer());
    if (data.byteLength > maxBytes) {
      throw new Error(`attachment too large after download: ${data.byteLength} > ${maxBytes}`);
    }
    const file = await open(target, "wx", 0o600);
    try {
      await writeAll(file, data);
      await file.sync();
      return data.byteLength;
    } finally {
      await file.close();
    }
  }

  const file = await open(target, "wx", 0o600);
  const reader = response.body.getReader();
  const abortReader = () => { void reader.cancel(signal?.reason).catch(() => {}); };
  signal?.addEventListener("abort", abortReader, { once: true });
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (signal?.aborted) throw new Error("download timed out", { cause: signal.reason });
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error(`attachment too large during stream: ${bytes} > ${maxBytes}`);
      await writeAll(file, value);
    }
    await file.sync();
    return bytes;
  } catch (err) {
    await reader.cancel().catch(() => {});
    await file.close().catch(() => {});
    await rm(target, { force: true }).catch(() => {});
    throw err;
  } finally {
    signal?.removeEventListener("abort", abortReader);
    await file.close().catch(() => {});
  }
}

/** Compose a caller signal with a hard deadline and always release the timer. */
export async function withDownloadTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = MEDIA_DOWNLOAD_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let rejectDeadline!: (reason: Error) => void;
  const deadline = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
  const timer = setTimeout(() => {
    const error = new Error("download timed out");
    controller.abort(error);
    rejectDeadline(error);
  }, timeoutMs);
  timer.unref?.();
  const running = Promise.resolve().then(() => operation(controller.signal));
  try {
    return await Promise.race([running, deadline]);
  } catch (err) {
    if (controller.signal.aborted) throw new Error("download timed out", { cause: err });
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
