import assert from "node:assert/strict";
import test from "node:test";

import { createCancelableTimer } from "../src/ui/cancelable-timer.mjs";

function fakeTimerApi() {
  let nextId = 0;
  const callbacks = new Map();

  return {
    callbacks,
    setTimeout(callback) {
      const id = ++nextId;
      callbacks.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      callbacks.delete(id);
    },
    run(id) {
      const callback = callbacks.get(id);
      callbacks.delete(id);
      callback?.();
    },
  };
}

test("cancel prevents a scheduled transition from running", () => {
  const timerApi = fakeTimerApi();
  const timer = createCancelableTimer(timerApi);
  let calls = 0;

  timer.schedule(() => {
    calls += 1;
  }, 260);
  const [timerId] = timerApi.callbacks.keys();

  assert.equal(timer.pending, true);
  assert.equal(timer.cancel(), true);
  assert.equal(timer.pending, false);
  timerApi.run(timerId);
  assert.equal(calls, 0);
  assert.equal(timer.cancel(), false);
});

test("scheduling a new transition replaces the previous transition", () => {
  const timerApi = fakeTimerApi();
  const timer = createCancelableTimer(timerApi);
  const calls = [];

  timer.schedule(() => calls.push("first"), 260);
  const [firstId] = timerApi.callbacks.keys();
  timer.schedule(() => calls.push("second"), 260);
  const [secondId] = timerApi.callbacks.keys();

  assert.notEqual(firstId, secondId);
  timerApi.run(firstId);
  assert.deepEqual(calls, []);
  timerApi.run(secondId);
  assert.deepEqual(calls, ["second"]);
  assert.equal(timer.pending, false);
});
