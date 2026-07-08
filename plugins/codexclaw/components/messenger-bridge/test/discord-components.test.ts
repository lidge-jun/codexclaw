/** discord-components.test.ts - pure Discord embed/component builders. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STATUS_COLORS,
  buildActionRow,
  buildApprovalCard,
  buildEffortSelect,
  buildModeButtons,
  buildModelSelect,
  buildStatusEmbed,
  capDiscordEmbed,
} from "../src/discord-components.ts";

test("buildStatusEmbed maps status colors and details", () => {
  const embed = buildStatusEmbed("running", "working", { Cwd: "/tmp/work", Thread: "none" });
  assert.equal(embed.color, STATUS_COLORS.running);
  assert.equal(embed.title, "Running");
  assert.equal(embed.description, "working");
  assert.deepEqual(embed.fields?.map((field) => field.name), ["Cwd", "Thread"]);
});

test("buildActionRow renders up to five style-typed buttons", () => {
  const row = buildActionRow([
    { label: "A", style: 1, customId: "a" },
    { label: "B", style: 2, customId: "b" },
    { label: "C", style: 3, customId: "c" },
    { label: "D", style: 4, customId: "d" },
    { label: "E", style: 2, customId: "e" },
    { label: "F", style: 2, customId: "f" },
  ]);
  assert.equal(row.type, 1);
  assert.equal(row.components.length, 5);
  assert.deepEqual(row.components.map((component) => component.custom_id), ["a", "b", "c", "d", "e"]);
});

test("buildModelSelect keeps the current model selectable even when catalog omits it", () => {
  const row = buildModelSelect([{ id: "default", label: "Default" }], "gpt-custom");
  const select = row.components[0];
  assert.equal(select.type, 3);
  assert.equal(select.custom_id, "model_select");
  assert.ok(select.options.some((option) => option.value === "gpt-custom" && option.default === true));
});

test("buildEffortSelect uses the effort custom id", () => {
  const row = buildEffortSelect(["default", "high"], "high");
  const select = row.components[0];
  assert.equal(select.custom_id, "effort_select");
  assert.ok(select.options.some((option) => option.value === "high" && option.default === true));
});

test("select builders mark the current option with native default true", () => {
  const modelSelect = buildModelSelect([{ id: "default" }, { id: "gpt-5.5" }], "gpt-5.5").components[0];
  const effortSelect = buildEffortSelect(["default", "xhigh"], "xhigh").components[0];

  assert.equal(modelSelect.type, 3);
  assert.equal(modelSelect.options.find((option) => option.value === "gpt-5.5")?.default, true);
  assert.equal(effortSelect.type, 3);
  assert.equal(effortSelect.options.find((option) => option.value === "xhigh")?.default, true);
});

test("buildModeButtons marks the current mode", () => {
  const row = buildModeButtons("plain");
  assert.deepEqual(row.components.map((component) => component.custom_id), ["mode_select:thread", "mode_select:plain"]);
  assert.equal(row.components[1].label, "* Plain");
});

test("buildApprovalCard emits allow-once, allow-always, and deny buttons", () => {
  const card = buildApprovalCard({ id: "ap_1", promptHash: "h123", workdir: "/tmp/w" });
  assert.equal(card.embeds[0].color, STATUS_COLORS.needs_input);
  assert.deepEqual(card.components[0].components.map((component) => component.custom_id), [
    "approval:ap_1:allow-once",
    "approval:ap_1:allow-always",
    "approval:ap_1:deny",
  ]);
});

test("capDiscordEmbed collapses field overflow into a +N more field", () => {
  const embed = capDiscordEmbed({
    title: "Oversized",
    fields: Array.from({ length: 30 }, (_, i) => ({
      name: `Field ${i}`,
      value: "ok",
    })),
  });

  assert.equal(embed.fields?.length, 25);
  assert.equal(embed.fields?.[24]?.name, "+6 more");
});

test("capDiscordEmbed truncates field values and total embed text budget", () => {
  const embed = capDiscordEmbed({
    title: "Budget",
    description: "d".repeat(4096),
    fields: [
      { name: "A", value: "x".repeat(2000) },
      { name: "B", value: "y".repeat(2000) },
    ],
  });

  assert.equal(embed.fields?.[0]?.value.length, 1024);
  assert.ok(embed.fields[0].value.endsWith("..."));
  const total =
    (embed.title?.length ?? 0) +
    (embed.description?.length ?? 0) +
    (embed.fields ?? []).reduce((sum, field) => sum + field.name.length + field.value.length, 0);
  assert.ok(total <= 6000);
});
