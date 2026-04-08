import test from "node:test";
import assert from "node:assert/strict";

import { buildExitBanner, getSessionTitle, padLabel } from "./index.ts";

test("pads labels to a stable width", () => {
  assert.equal(padLabel("Session"), "Session   ");
  assert.equal(padLabel("Continue").length, 10);
});

test("prefers the explicit session name when present", () => {
  assert.equal(getSessionTitle("Refactor footer", "/tmp/project"), "Refactor footer");
});

test("falls back to the cwd basename when session name is blank", () => {
  assert.equal(getSessionTitle("   ", "/Users/yilinzhang/src/demo-project"), "demo-project");
});

test("builds a banner that includes the title and resume command", () => {
  const banner = buildExitBanner("Demo Session", "pi --session abc123");

  assert.match(banner, /Demo Session/);
  assert.match(banner, /pi --session abc123/);
  assert.match(banner, /Session/);
  assert.match(banner, /Continue/);
});
