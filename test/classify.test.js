import test from "node:test";
import assert from "node:assert/strict";
import { classifyPost } from "../src/classify.js";

test("completed Codex reset is actionable", () => {
  const r = classifyPost("Codex weekly limit reset has been processed. Enjoy!");
  assert.equal(r.kind, "completed");
  assert.equal(r.actionable, true);
});

test("authoritative terse processed reset is actionable", () => {
  const r = classifyPost("the reset has been processed. Enjoy!");
  assert.equal(r.kind, "completed");
  assert.equal(r.actionable, true);
});

test("scheduled reset with concrete time is actionable", () => {
  const r = classifyPost("Codex limits reset tomorrow 10am PT");
  assert.equal(r.kind, "scheduled");
  assert.equal(r.actionable, true);
});

test("vague reset hint stays non-actionable", () => {
  const r = classifyPost("Codex limit reset soon, hopefully");
  assert.equal(r.kind, "hint");
  assert.equal(r.actionable, false);
});

test("unrelated reset is ignored", () => {
  const r = classifyPost("I reset my laptop today");
  assert.equal(r.kind, "ignore");
});
