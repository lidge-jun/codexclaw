/** media-handler.test.ts — Telegram/Discord media download helpers. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cleanupTmpMedia,
  createTmpMediaDir,
  DISCORD_ATTACHMENT_MAX_BYTES,
  downloadDiscordAttachment,
  downloadTelegramMedia,
  telegramMediaRefs,
} from "../src/media-handler.ts";
import type { TelegramApi, TgMessage } from "../src/telegram-api.ts";

test("telegramMediaRefs picks largest photo and preserves document/voice labels", () => {
  const msg = {
    message_id: 1,
    chat: { id: 1, type: "private" },
    photo: [
      { file_id: "small", file_unique_id: "small", width: 10, height: 10 },
      { file_id: "large", file_unique_id: "large", width: 100, height: 100 },
    ],
    document: { file_id: "doc", file_unique_id: "doc-u", file_name: "a.txt" },
    voice: { file_id: "voice", file_unique_id: "voice-u", duration: 1 },
  } as TgMessage;

  assert.deepEqual(telegramMediaRefs(msg), [
    { label: "Image", fileId: "large", fileName: "large.jpg" },
    { label: "File", fileId: "doc", fileName: "a.txt" },
    { label: "Voice", fileId: "voice", fileName: "voice-u.oga" },
  ]);
});

test("downloadTelegramMedia writes sanitized file and cleanup removes temp dir", async () => {
  const dir = await createTmpMediaDir("codexclaw-tg-");
  const api = {
    getFile: async () => ({ ok: true, result: { file_path: "folder/original name.txt" } }),
    downloadFile: async () => ({ ok: true, data: new TextEncoder().encode("hello").buffer }),
  } as unknown as TelegramApi;

  const path = await downloadTelegramMedia(api, "file-1", dir, "../unsafe name.txt");
  assert.equal(readFileSync(path, "utf8"), "hello");
  assert.match(path, /unsafe_name\.txt$/);
  await cleanupTmpMedia(dir);
  assert.equal(existsSync(dir), false);
});

test("downloadDiscordAttachment writes CDN bytes and cleanup removes temp dir", async () => {
  const root = mkdtempSync(join(tmpdir(), "dc-media-test-"));
  try {
    const result = await downloadDiscordAttachment(
      { id: "a1", filename: "note.txt", url: "https://cdn.example/note.txt", size: 5 },
      {
        tmpDir: root,
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          arrayBuffer: () => Promise.resolve(new TextEncoder().encode("hello").buffer),
        }) as Response,
      },
    );
    assert.equal(result.tempDir, root);
    assert.equal(readFileSync(result.path, "utf8"), "hello");
    await cleanupTmpMedia(root);
    assert.equal(existsSync(root), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("downloadDiscordAttachment rejects oversized gateway-declared attachments before fetch", async () => {
  let fetched = false;
  await assert.rejects(
    downloadDiscordAttachment(
      { id: "a-big", filename: "big.bin", url: "https://cdn.example/big.bin", size: DISCORD_ATTACHMENT_MAX_BYTES + 1 },
      {
        fetchImpl: async () => {
          fetched = true;
          throw new Error("should not fetch");
        },
      },
    ),
    /attachment too large before download/,
  );
  assert.equal(fetched, false);
});

test("downloadDiscordAttachment rejects oversized unknown-size downloads after fetch", async () => {
  await assert.rejects(
    downloadDiscordAttachment(
      { id: "a-big", filename: "big.bin", url: "https://cdn.example/big.bin" },
      {
        maxBytes: 5,
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          arrayBuffer: () => Promise.resolve(new TextEncoder().encode("too-big").buffer),
        }) as Response,
      },
    ),
    /attachment too large after download/,
  );
});
