import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { TelegramApi, TgMessage } from "./telegram-api.ts";

export interface TelegramMediaRef {
  label: "Image" | "File" | "Voice";
  fileId: string;
  fileName?: string;
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

export async function createTmpMediaDir(prefix: "codexclaw-tg-" | "codexclaw-dc-"): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export function telegramMediaRefs(msg: TgMessage): TelegramMediaRef[] {
  const refs: TelegramMediaRef[] = [];
  if (msg.photo?.length) {
    const photo = msg.photo.reduce((best, item) =>
      telegramMediaScore(item) > telegramMediaScore(best) ? item : best,
    );
    refs.push({ label: "Image", fileId: photo.file_id, fileName: `${photo.file_unique_id}.jpg` });
  }
  if (msg.document) {
    refs.push({ label: "File", fileId: msg.document.file_id, fileName: msg.document.file_name });
  }
  if (msg.voice) {
    refs.push({ label: "Voice", fileId: msg.voice.file_id, fileName: `${msg.voice.file_unique_id}.oga` });
  }
  return refs;
}

export async function downloadTelegramMedia(
  api: TelegramApi,
  fileId: string,
  tmpDir: string,
  fileName?: string,
): Promise<string> {
  const file = await api.getFile(fileId);
  const filePath = file.result?.file_path;
  if (!file.ok || !filePath) {
    throw new Error(file.description ?? "missing file_path");
  }

  const download = await api.downloadFile(filePath);
  if (!download.ok || !download.data) {
    throw new Error(download.error ?? "no data");
  }

  const target = join(tmpDir, safeMediaName(fileName ?? basename(filePath) ?? `${fileId}.bin`));
  await writeFile(target, Buffer.from(download.data));
  return target;
}

export async function downloadTelegramMessageMedia(
  api: TelegramApi,
  msg: TgMessage,
  log: (line: string) => void = () => {},
): Promise<{ prefixes: string[]; tempDirs: string[] }> {
  const prefixes: string[] = [];
  const tempDirs: string[] = [];
  for (const ref of telegramMediaRefs(msg)) {
    const dir = await createTmpMediaDir("codexclaw-tg-");
    try {
      tempDirs.push(dir);
      const target = await downloadTelegramMedia(api, ref.fileId, dir, ref.fileName);
      prefixes.push(`[${ref.label}: ${target}]`);
    } catch (err) {
      log(`[tg] ${ref.label} download failed: ${(err as Error).message}`);
    }
  }
  return { prefixes, tempDirs };
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
    const res = await fetchImpl(attachment.url);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    const data = await res.arrayBuffer();
    if (data.byteLength > maxBytes) {
      throw new Error(`attachment too large after download: ${data.byteLength} > ${maxBytes}`);
    }
    await writeFile(target, Buffer.from(data));
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
