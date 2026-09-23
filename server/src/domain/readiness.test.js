import test from "node:test";
import assert from "node:assert/strict";
import { calculateReadiness, DIMENSIONS, readinessLevel } from "./readiness.js";

function dimensionsWith(status, confirmed = true) {
  return DIMENSIONS.map(({ key }) => ({ key, status, confirmed }));
}

test("all dimensions missing produces zero draft readiness", () => {
  const result = calculateReadiness(dimensionsWith("missing"));
  assert.equal(result.score, 0);
  assert.equal(result.level, "draft");
  assert.equal(result.missing.length, 7);
});

test("all dimensions complete produces 100 priority readiness", () => {
  const result = calculateReadiness(dimensionsWith("complete"));
  assert.equal(result.score, 100);
  assert.equal(result.level, "priority");
  assert.equal(result.missing.length, 0);
});

test("partial completeness earns exactly half of each dimension weight", () => {
  const result = calculateReadiness(dimensionsWith("partial"));
  assert.equal(result.score, 50);
  assert.equal(result.breakdown.find(({ dimension }) => dimension === "SUCCESS_CRITERIA").earned, 7.5);
});

test("unconfirmed AI findings earn no points", () => {
  const result = calculateReadiness(dimensionsWith("complete", false));
  assert.equal(result.score, 0);
});

test("grounded user evidence is scored before a separate confirmation step", () => {
  const result = calculateReadiness(DIMENSIONS.map(({ key }) => ({
    key,
    status: key === "USERS" ? "complete" : "missing",
    evidence: key === "USERS" ? [{ sourceId: "description", quote: "сотрудники" }] : [],
  })));
  assert.equal(result.score, 10);
  assert.equal(result.breakdown.find(({ dimension }) => dimension === "USERS").status, "complete");
});

for (const [score, level] of [
  [39, "draft"],
  [40, "workable"],
  [69, "workable"],
  [70, "ready"],
  [89, "ready"],
  [90, "priority"],
  [100, "priority"],
]) {
  test(`score ${score} maps to ${level}`, () => {
    assert.equal(readinessLevel(score), level);
  });
}

test("readiness never exceeds 100 for every possible complete or partial combination", () => {
  for (let mask = 0; mask < 3 ** DIMENSIONS.length; mask += 1) {
    let remainder = mask;
    const inputs = DIMENSIONS.map(({ key }) => {
      const value = remainder % 3;
      remainder = Math.floor(remainder / 3);
      return {
        key,
        confirmed: true,
        status: ["missing", "partial", "complete"][value],
      };
    });
    assert.ok(calculateReadiness(inputs).score <= 100);
  }
});
