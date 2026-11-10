import test from "node:test";
import assert from "node:assert/strict";
import {
  initialTriageState,
  isStale,
  triageReducer,
  type TriageState,
} from "../lib/triage-reducer.ts";
import { SCENARIOS } from "../lib/content/scenarios.ts";

const apply = (state: TriageState, ...actions: Parameters<typeof triageReducer>[1][]) =>
  actions.reduce(triageReducer, state);

test("editing the message marks the desk dirty", () => {
  const state = apply(initialTriageState(), {
    type: "input/edit",
    patch: { message: "a different message" },
  });
  assert.equal(state.status, "dirty");
  assert.equal(isStale(state), true);
});

test("a fresh result is not stale", () => {
  const state = initialTriageState();
  assert.equal(isStale(state), false);
  assert.equal(state.status, "idle");
});

test("a successful run clears the stale flag", () => {
  const state = apply(
    initialTriageState(),
    { type: "input/edit", patch: { message: "changed" } },
    { type: "run/start" },
    {
      type: "run/success",
      result: initialTriageState().result,
      submitted: "changed",
    },
  );
  assert.equal(state.status, "idle");
  assert.equal(isStale(state), false);
});

test("revealing raw input is time limited and masked again afterwards", () => {
  const state = apply(initialTriageState(), { type: "privacy/toggle" });
  assert.equal(state.masked, false);
  assert.equal(state.revealed, true);
  assert.ok(state.revealUntil > Date.now());
  const hidden = triageReducer(state, { type: "privacy/hide" });
  assert.equal(hidden.masked, true);
  assert.equal(hidden.revealed, false);
});

test("choosing a scenario never inherits an unmasked view", () => {
  const revealed = apply(initialTriageState(), { type: "privacy/toggle" });
  assert.equal(revealed.revealed, true);
  const next = triageReducer(revealed, { type: "scenario/select", index: 3 });
  assert.equal(next.masked, true);
  assert.equal(next.revealed, false);
  assert.equal(next.submittedMessage, SCENARIOS[3]!.input.message);
});

test("a run resets the raw view", () => {
  const revealed = apply(initialTriageState(), { type: "privacy/toggle" });
  const finished = apply(
    revealed,
    { type: "run/start" },
    {
      type: "run/success",
      result: revealed.result,
      submitted: revealed.submittedMessage,
    },
  );
  assert.equal(finished.revealed, false);
  assert.equal(finished.masked, true);
});

test("an error keeps the last result and records the message", () => {
  const state = apply(initialTriageState(), {
    type: "run/error",
    message: "Triage is unavailable. Try again.",
  });
  assert.equal(state.status, "error");
  assert.equal(state.error, "Triage is unavailable. Try again.");
  assert.ok(state.result.payload);
});
