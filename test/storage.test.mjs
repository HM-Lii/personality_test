import assert from "node:assert/strict";
import test from "node:test";

import {
  CALIBRATION_QUESTIONS,
  CORE_QUESTION_IDS,
  CORE_QUESTIONS,
} from "../src/data/catalog.mjs";
import {
  STORAGE_KEY,
  freshState,
  restoreState,
  saveState,
} from "../src/ui/storage.mjs";

function memoryStorage(serialized = null) {
  let value = serialized;
  let removals = 0;

  return {
    get removals() {
      return removals;
    },
    getItem(key) {
      assert.equal(key, STORAGE_KEY);
      return value;
    },
    setItem(key, nextValue) {
      assert.equal(key, STORAGE_KEY);
      value = nextValue;
    },
    removeItem(key) {
      assert.equal(key, STORAGE_KEY);
      value = null;
      removals += 1;
    },
  };
}

function answerFor(question) {
  const option = question.options[0];
  return {
    questionId: question.id,
    optionId: option.id,
    value: option.value,
  };
}

function progressState(overrides = {}) {
  return {
    view: "quiz",
    queue: [...CORE_QUESTION_IDS],
    index: 0,
    answers: [answerFor(CORE_QUESTIONS[0])],
    completedAt: null,
    ...overrides,
  };
}

test("restoreState returns a sanitized copy of a valid progress snapshot", () => {
  const stored = progressState({
    injectedRootField: "discard me",
    answers: [
      {
        ...answerFor(CORE_QUESTIONS[0]),
        injectedAnswerField: "discard me too",
      },
    ],
  });
  const storage = memoryStorage(JSON.stringify(stored));
  const restored = restoreState(storage);

  assert.deepEqual(restored, progressState());
  assert.notEqual(restored.queue, stored.queue);
  assert.notEqual(restored.answers, stored.answers);
  assert.equal("injectedRootField" in restored, false);
  assert.equal("injectedAnswerField" in restored.answers[0], false);
  assert.equal(storage.removals, 0);
});

test("restoreState accepts a complete result including calibration answers", () => {
  const calibration = CALIBRATION_QUESTIONS[0];
  const queue = [...CORE_QUESTION_IDS, calibration.id];
  const stored = {
    view: "result",
    queue,
    index: queue.length - 1,
    answers: [
      ...CORE_QUESTIONS.map(answerFor),
      answerFor(calibration),
    ],
    completedAt: "2026-07-27T12:00:00.000Z",
  };
  const storage = memoryStorage(JSON.stringify(stored));

  assert.deepEqual(restoreState(storage), stored);
  assert.equal(storage.removals, 0);
});

test("restoreState clears malformed JSON and falls back to a fresh state", () => {
  const storage = memoryStorage("{not-json");

  assert.deepEqual(restoreState(storage), freshState());
  assert.equal(storage.removals, 1);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test("restoreState rejects corrupted state shapes and answer records", async (t) => {
  const completeAnswers = CORE_QUESTIONS.map(answerFor);
  const completedAt = "2026-07-27T12:00:00.000Z";
  const firstAnswer = answerFor(CORE_QUESTIONS[0]);
  const invalidCases = [
    ["unknown view", progressState({ view: "broken" })],
    ["non-array queue", progressState({ queue: {} })],
    [
      "reordered core queue",
      progressState({ queue: [...CORE_QUESTION_IDS].reverse() }),
    ],
    [
      "unknown calibration question",
      progressState({ queue: [...CORE_QUESTION_IDS, "unknown"] }),
    ],
    [
      "too many calibration questions",
      progressState({
        queue: [
          ...CORE_QUESTION_IDS,
          ...CALIBRATION_QUESTIONS.slice(0, 4).map((question) => question.id),
        ],
      }),
    ],
    ["negative index", progressState({ index: -1 })],
    [
      "index beyond queue",
      progressState({ index: CORE_QUESTION_IDS.length }),
    ],
    ["fractional index", progressState({ index: 0.5 })],
    ["non-array answers", progressState({ answers: {} })],
    ["null answer", progressState({ answers: [null] })],
    [
      "unknown answer question",
      progressState({
        answers: [
          { questionId: "unknown", optionId: "A", value: -3 },
        ],
      }),
    ],
    [
      "unknown answer option",
      progressState({
        answers: [{ ...firstAnswer, optionId: "unknown" }],
      }),
    ],
    [
      "forged answer value",
      progressState({
        answers: [{ ...firstAnswer, value: firstAnswer.value * -1 }],
      }),
    ],
    [
      "duplicate answer",
      progressState({ answers: [firstAnswer, firstAnswer] }),
    ],
    ["invalid timestamp", progressState({ completedAt: "today" })],
    [
      "result without completion timestamp",
      progressState({
        view: "result",
        answers: completeAnswers,
        index: CORE_QUESTION_IDS.length - 1,
      }),
    ],
    [
      "quiz with completion timestamp",
      progressState({
        answers: completeAnswers,
        completedAt,
      }),
    ],
    [
      "incomplete completed state",
      progressState({
        view: "home",
        completedAt,
      }),
    ],
  ];

  for (const [name, stored] of invalidCases) {
    await t.test(name, () => {
      const storage = memoryStorage(JSON.stringify(stored));
      assert.deepEqual(restoreState(storage), freshState());
      assert.equal(storage.removals, 1);
    });
  }
});

test("storage access failures never escape into application startup", () => {
  const unavailableStorage = {
    getItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("still blocked");
    },
  };

  assert.doesNotThrow(() => restoreState(unavailableStorage));
  assert.deepEqual(restoreState(unavailableStorage), freshState());
  assert.doesNotThrow(() =>
    saveState(freshState(), {
      setItem() {
        throw new Error("quota exceeded");
      },
    }),
  );
});
