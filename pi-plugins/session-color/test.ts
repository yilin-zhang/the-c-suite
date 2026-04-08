import test from "node:test";
import assert from "node:assert/strict";

import {
  collectUsageTotals,
  getSessionAccentFromEntries,
  isSessionAccentCustomType,
} from "./index.ts";

test("recognizes current and legacy session accent entry types", () => {
  assert.equal(isSessionAccentCustomType("session-color"), true);
  assert.equal(isSessionAccentCustomType("session-color-state"), true);
  assert.equal(isSessionAccentCustomType("claude-session-ui-state"), true);
  assert.equal(isSessionAccentCustomType("something-else"), false);
  assert.equal(isSessionAccentCustomType(undefined), false);
});

test("uses the newest saved session accent and ignores invalid entries", () => {
  const accent = getSessionAccentFromEntries([
    { type: "custom", customType: "session-color", data: { accent: "accent" } },
    { type: "custom", customType: "something-else", data: { accent: "warning" } },
    { type: "custom", customType: "session-color-state", data: { accent: "  " } },
    { type: "custom", customType: "claude-session-ui-state", data: { accent: "error" } },
  ]);

  assert.equal(accent, "error");
});

test("falls back to the default accent when no saved accent exists", () => {
  const accent = getSessionAccentFromEntries([
    { type: "message" },
    { type: "custom", customType: "session-color", data: {} },
  ]);

  assert.equal(accent, "accent");
});

test("collects assistant usage totals safely", () => {
  const totals = collectUsageTotals([
    {
      type: "message",
      message: {
        role: "assistant",
        usage: {
          input: 1200,
          output: 300,
          cacheRead: 50,
          cacheWrite: 20,
          cost: { total: 0.125 },
        },
      },
    },
    {
      type: "message",
      message: {
        role: "user",
        usage: {
          input: 9999,
          output: 9999,
          cacheRead: 9999,
          cacheWrite: 9999,
          cost: { total: 9999 },
        },
      },
    },
    {
      type: "message",
      message: {
        role: "assistant",
        usage: {
          input: 10,
        },
      },
    },
  ]);

  assert.deepEqual(totals, {
    input: 1210,
    output: 300,
    cacheRead: 50,
    cacheWrite: 20,
    cost: 0.125,
  });
});
