import test from "node:test";
import assert from "node:assert/strict";
import { formatChinaTime, inferResetTime } from "../src/time.js";

test("formats UTC into China Standard Time", () => {
  const out = formatChinaTime("2026-10-07T03:35:00Z");
  assert.match(out, /2026-10-07/);
  assert.match(out, /11:35/);
});

test("relative hours are inferred", () => {
  const out = inferResetTime("reset in 2 hours", "2026-10-07T03:35:00Z");
  assert.equal(out.toISOString(), "2026-10-07T05:35:00.000Z");
});

test("PT clock converts through America Los Angeles", () => {
  const out = inferResetTime("reset tomorrow 10am PT", "2026-10-07T03:35:00Z");
  assert.ok(out instanceof Date);
  assert.equal(Number.isNaN(out.getTime()), false);
});
