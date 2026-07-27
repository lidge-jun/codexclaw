import { chmod, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { TelegramApi, TgMessage } from "./telegram-api.ts";
import { streamResponseToFile, withDownloadTimeout } from "./stream-download.ts";

export interface TelegramMediaRef {
  label: "Image" | "File" | "Voice";
  fileId: string;
  fileName?: string;
  fileSize?: number;
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  url: string;
  content_type?: string;
  size?: number;
}

export interface DownloadedMedia {
  path: string;
  tempDir: string;
}

export type MediaFetchImpl = (url: string, init?: RequestInit) => Promise<Response>;
export const DISCORD_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const TELEGRAM_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_MESSAGE = 4;
export const MAX_CONCURRENT_MEDIA_MESSAGES = 2;

export class MediaCapacityError extends Error {
  constructor() {
    super("attachment download capacity reached; retry after current downloads finish");
    this.name = "MediaCapacityError";
  }
}

export class MediaDownloadGate {
  private active = 0;
  private readonly limit: number;

  constructor(limit = MAX_CONCURRENT_MEDIA_MESSAGES) {
    this.limit = limit;
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) throw new MediaCapacityError();
    this.active += 1;
    try {
      return await operation();
    } finally {
      this.active -= 1;
    }
  }
}

const globalMediaGate = new MediaDownloadGate();

export function withMediaDownloadSlot<T>(operation: () => Promise<T>): Promise<T> {
  return globalMediaGate.run(operation);
}

export async function createTmpMediaDir(prefix: "codexclaw-tg-" | "codexclaw-dc-"): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  await chmod(dir, 0o700).catch(() => {});
  return dir;
}

export function telegramMediaRefs(msg: TgMessage): TelegramMediaRef[] {
  const refs: TelegramMediaRef[] = [];
  if (msg.photo?.length) {
    const photo = msg.photo.reduce((best, item) =>
      telegramMediaScore(item) > telegramMediaScore(best) ? item : best,
    );
    refs.push({
      label: "Image",
      fileId: photo.file_id,
      fileName: `${photo.file_unique_id}.jpg`,
      ...(photo.file_size === undefined ? {} : { fileSize: photo.file_size }),
    });
  }
  if (msg.document) {
    refs.push({
      label: "File",
      fileId: msg.document.file_id,
      fileName: msg.document.file_name,
      ...(msg.document.file_size === undefined ? {} : { fileSize: msg.document.file_size }),
    });
  }
  if (msg.voice) {
    refs.push({
      label: "Voice",
      fileId: msg.voice.file_id,
      fileName: `${msg.voice.file_unique_id}.oga`,
      ...(msg.voice.file_size === undefined ? {} : { fileSize: msg.voice.file_size }),
    });
  }
  return refs;
}

export async function downloadTelegramMedia(
  api: TelegramApi,
  fileId: string,
  tmpDir: string,
  fileName?: string,
  declaredBytes?: number,
  maxBytes = TELEGRAM_ATTACHMENT_MAX_BYTES,
): Promise<string> {
  if (declaredBytes !== undefined && declaredBytes > maxBytes) {
    throw new Error(`attachment too large before download: ${declaredBytes} > ${maxBytes}`);
  }
  const file = await api.getFile(fileId);
  const filePath = file.result?.file_path;
  if (!file.ok || !filePath) {
    throw new Error(file.description ?? "missing file_path");
  }

  if (file.result?.file_size !== undefined && file.result.file_size > maxBytes) {
    throw new Error(`attachment too large before download: ${file.result.file_size} > ${maxBytes}`);
  }

  const target = join(tmpDir, safeMediaName(fileName ?? basename(filePath) ?? `${fileId}.bin`));
  if (typeof (api as Partial<TelegramApi>).downloadFileResponse !== "function") {
    const legacy = await api.downloadFile(filePath);
    if (!legacy.ok || !legacy.data) throw new Error(legacy.error ?? "no data");
    if (legacy.data.byteLength > maxBytes) {
      throw new Error(`attachment too large after download: ${legacy.data.byteLength} > ${maxBytes}`);
    }
    await writeFile(target, Buffer.from(legacy.data), { mode: 0o600 });
    return target;
  }
  await withDownloadTimeout(async (signal) => {
    const download = await api.downloadFileResponse(filePath, signal);
    if (!download.ok || !download.response) throw new Error(download.error ?? "no response");
    await streamResponseToFile(download.response, target, maxBytes, signal);
  });
  return target;
}

export async function downloadTelegramMessageMedia(
  api: TelegramApi,
  msg: TgMessage,
  log: (line: string) => void = () => {},
): Promise<{ prefixes: string[]; tempDirs: string[] }> {
  const refs = telegramMediaRefs(msg).slice(0, MAX_ATTACHMENTS_PER_MESSAGE);
  if (refs.length === 0) return { prefixes: [], tempDirs: [] };
  return withMediaDownloadSlot(async () => {
  const prefixes: string[] = [];
  const tempDirs: string[] = [];
  for (const ref of refs) {
    const dir = await createTmpMediaDir("codexclaw-tg-");
    try {
      tempDirs.push(dir);
      const target = await downloadTelegramMedia(api, ref.fileId, dir, ref.fileName, ref.fileSize);
      prefixes.push(`[${ref.label}: ${target}]`);
    } catch (err) {
      log(`[tg] ${ref.label} download failed: ${(err as Error).message}`);
    }
  }
  return { prefixes, tempDirs };
  });
}

export async function downloadDiscordAttachment(
  attachment: DiscordAttachment,
  opts: { fetchImpl?: MediaFetchImpl; tmpDir?: string; maxBytes?: number } = {},
): Promise<DownloadedMedia> {
  const maxBytes = opts.maxBytes ?? DISCORD_ATTACHMENT_MAX_BYTES;
  if (attachment.size !== undefined && attachment.size > maxBytes) {
    throw new Error(`attachment too large before download: ${attachment.size} > ${maxBytes}`);
  }
  const ownsTempDir = !opts.tmpDir;
  const tempDir = opts.tmpDir ?? await createTmpMediaDir("codexclaw-dc-");
  try {
    const target = join(tempDir, safeMediaName(attachment.filename || `${attachment.id}.bin`));
    const fetchImpl = opts.fetchImpl ?? fetch;
    await withDownloadTimeout(async (signal) => {
      const res = await fetchImpl(attachment.url, { signal });
      if (!res.ok) throw new Error(`download failed: ${res.status}`);
      await streamResponseToFile(res, target, maxBytes, signal);
    });
    return { path: target, tempDir };
  } catch (err) {
    if (ownsTempDir) await cleanupTmpMedia(tempDir);
    throw err;
  }
}

export async function cleanupTmpMedia(targets: string | string[], maxAgeMs = 0): Promise<void> {
  const list = Array.isArray(targets) ? targets : [targets];
  for (const target of list) {
    if (!target) continue;
    if (maxAgeMs > 0) {
      try {
        const info = await stat(target);
        if (Date.now() - info.mtimeMs < maxAgeMs) continue;
      } catch {
        continue;
      }
    }
    await rm(target, { recursive: true, force: true });
  }
}

function telegramMediaScore(item: { width: number; height: number; file_size?: number }): number {
  return item.file_size ?? item.width * item.height;
}

function safeMediaName(name: string): string {
  const safe = basename(name).replace(/[^A-Za-z0-9._-]/g, "_");
  return safe || "media.bin";
}
