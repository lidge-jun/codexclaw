import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";






















export const DISCORD_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

export async function createTmpMediaDir(prefix                                   )                  {
  return mkdtemp(join(tmpdir(), prefix));
}

export function telegramMediaRefs(msg           )                     {
  const refs                     = [];
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
  api             ,
  fileId        ,
  tmpDir        ,
  fileName         ,
)                  {
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
  api             ,
  msg           ,
  log                         = () => {},
)                                                      {
  const prefixes           = [];
  const tempDirs           = [];
  for (const ref of telegramMediaRefs(msg)) {
    const dir = await createTmpMediaDir("codexclaw-tg-");
    try {
      tempDirs.push(dir);
      const target = await downloadTelegramMedia(api, ref.fileId, dir, ref.fileName);
      prefixes.push(`[${ref.label}: ${target}]`);
    } catch (err) {
      log(`[tg] ${ref.label} download failed: ${(err         ).message}`);
    }
  }
  return { prefixes, tempDirs };
}

export async function downloadDiscordAttachment(
  attachment                   ,
  opts                                                                     = {},
)                           {
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

export async function cleanupTmpMedia(targets                   , maxAgeMs = 0)                {
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

function telegramMediaScore(item                                                       )         {
  return item.file_size ?? item.width * item.height;
}

function safeMediaName(name        )         {
  const safe = basename(name).replace(/[^A-Za-z0-9._-]/g, "_");
  return safe || "media.bin";
}
