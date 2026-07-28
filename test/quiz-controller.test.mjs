/**
 * Unit tests for the quiz controller.
 *
 * The controller is exercised through a fake context that stubs the DOM,
 * the state store, the cancelable timer, and the router. This covers the
 * state-machine logic (answer selection, navigation, calibration flow)
 * without needing a browser.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createQuizController } from "../src/ui/quiz-controller.mjs";
import {
  CORE_QUESTIONS,
  CALIBRATION_QUESTIONS,
  questionMap,
} from "../src/data/catalog.mjs";
import { buildTestResult } from "../src/core/result.mjs";
import { FIGURES } from "../src/data/figures.mjs";
import { MIRROR_PAIRS } from "../src/data/questions.mjs";
import { DIMENSIONS } from "../src/core/scoring.mjs";

const dimensionMap = new Map(DIMENSIONS.map((d) => [d.id, d]));
const hashString = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
};
const resultDeps = { questionMap, dimensionMap, figures: FIGURES, mirrorPairs: MIRROR_PAIRS, hashString };

/**
 * finishResult() calls the global `window.scrollTo`, which quiz-controller.mjs
 * reads directly rather than through an injected dependency (unlike
 * questionTransition, which callers inject). Plain `node --test` has no
 * global `window`, so any test that reaches finishResult must stub one first
 * or the call throws ReferenceError.
 */
function stubWindow() {
  const previous = globalThis.window;
  const scrollCalls = [];
  globalThis.window = {
    scrollTo: (options) => scrollCalls.push(options),
  };
  return {
    scrollCalls,
    restore() {
      globalThis.window = previous;
    },
  };
}

function makeCtx(overrides = {}) {
  const state = {
    view: "quiz",
    answers: [],
    queue: CORE_QUESTIONS.map((q) => q.id),
    index: 0,
    completedAt: null,
    ...overrides.state,
  };
  const store = {
    get: () => state,
    patch(partial) {
      Object.assign(state, partial);
      if (partial.answers) state.answers = partial.answers;
      if (partial.queue) state.queue = partial.queue;
    },
    replace(next) {
      Object.assign(state, next);
    },
  };
  const renders = [];
  const router = {
    render() {
      renders.push({ view: state.view, index: state.index });
    },
    goHome() {
      renders.push({ goHome: true });
    },
  };
  let pending = false;
  let scheduledFn = null;
  const questionTransition = {
    get pending() {
      return pending;
    },
    cancel() {
      pending = false;
      scheduledFn = null;
    },
    schedule(fn) {
      pending = true;
      scheduledFn = fn;
    },
  };
  const app = {
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  const persistCalls = [];

  return {
    ctx: {
      app,
      store,
      questionTransition,
      persist: () => persistCalls.push(true),
      calculateResult: () => buildTestResult(state.answers, resultDeps),
      router,
    },
    state,
    renders,
    persistCalls,
    fireTransition: () => {
      if (scheduledFn) {
        const fn = scheduledFn;
        pending = false;
        scheduledFn = null;
        fn();
      }
    },
  };
}

test("selectAnswer ignores input while a transition is pending", () => {
  const { ctx, state, renders } = makeCtx();
  const quiz = createQuizController(ctx);

  // Simulate a pending transition
  ctx.questionTransition.schedule(() => {});
  const firstQuestion = CORE_QUESTIONS[0];
  const option = firstQuestion.options[0];

  quiz.selectAnswer(firstQuestion.id, option.id);

  assert.equal(state.answers.length, 0, "no answer should be recorded");
  assert.equal(renders.length, 0, "no render should happen");
});

test("selectAnswer records the answer and schedules a transition", () => {
  const { ctx, state, fireTransition } = makeCtx();
  const quiz = createQuizController(ctx);

  const question = CORE_QUESTIONS[0];
  const option = question.options[0];

  quiz.selectAnswer(question.id, option.id);

  assert.equal(state.answers.length, 1);
  assert.equal(state.answers[0].questionId, question.id);
  assert.equal(state.answers[0].optionId, option.id);
  assert.equal(state.answers[0].value, option.value);
  assert.ok(ctx.questionTransition.pending, "transition should be pending");

  fireTransition();

  assert.equal(state.index, 1, "index should advance after transition fires");
});

test("selectAnswer on the last core question hands off to appendCalibrationOrFinish", () => {
  // Pre-fill 24 answers (all but the last core question) with option A, which
  // is known to leave the top two real figures too close to call
  // (gap ≈ 0.009, well under CALIBRATION_GAP_THRESHOLD) — so this exercises
  // the real end-to-end wiring for the "append a calibration question"
  // branch specifically. The finish branch is covered deterministically by
  // the synthetic-result tests below instead of depending on where real
  // figure data happens to land.
  const answers = CORE_QUESTIONS.slice(0, -1).map((q) => {
    const opt = q.options[0];
    return { questionId: q.id, optionId: opt.id, value: opt.value };
  });
  const { ctx, state, fireTransition } = makeCtx({
    state: { answers, queue: CORE_QUESTIONS.map((q) => q.id), index: CORE_QUESTIONS.length - 1 },
  });
  const quiz = createQuizController(ctx);

  const lastQuestion = CORE_QUESTIONS[CORE_QUESTIONS.length - 1];
  const option = lastQuestion.options[0];

  quiz.selectAnswer(lastQuestion.id, option.id);

  assert.equal(state.answers.length, CORE_QUESTIONS.length, "all 25 core answers should be present");
  assert.ok(ctx.questionTransition.pending);

  fireTransition();

  assert.equal(state.view, "quiz", "should still be answering, not on the result page");
  assert.equal(
    state.queue.length,
    CORE_QUESTIONS.length + 1,
    "should append exactly one calibration question",
  );
  const addedQuestion = CALIBRATION_QUESTIONS.find(
    (question) => question.id === state.queue.at(-1),
  );
  assert.ok(addedQuestion, "the appended id should be a real calibration question");
});

test("finishResult marks the state complete, persists, renders, and scrolls to top", () => {
  const { ctx, state, renders, persistCalls } = makeCtx();
  const win = stubWindow();
  const quiz = createQuizController(ctx);

  try {
    quiz.finishResult();
  } finally {
    win.restore();
  }

  assert.equal(state.view, "result");
  assert.match(state.completedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  assert.equal(persistCalls.length, 1);
  assert.equal(renders.at(-1)?.view, "result");
  assert.deepEqual(win.scrollCalls, [{ top: 0, behavior: "smooth" }]);
});

test("appendCalibrationOrFinish appends a question for the most different dimension when the gap is too close to call", () => {
  const { ctx, state, renders } = makeCtx();
  const startingQueueLength = state.queue.length;
  ctx.calculateResult = () => ({
    ranking: [
      { id: "near-a", distance: 0.1, vector: { O: 90, C: 50, E: 50, A: 50, R: 50 } },
      { id: "near-b", distance: 0.101, vector: { O: 10, C: 50, E: 50, A: 50, R: 50 } },
    ],
    calibrationCount: 0,
  });
  const quiz = createQuizController(ctx);

  quiz.appendCalibrationOrFinish();

  assert.equal(state.view, "quiz", "should not finish while the gap is unresolved");
  assert.equal(state.queue.length, startingQueueLength + 1);
  const addedId = state.queue.at(-1);
  const addedQuestion = CALIBRATION_QUESTIONS.find((question) => question.id === addedId);
  assert.equal(addedQuestion?.dimension, "O", "O has the largest vector gap between the two candidates");
  assert.equal(renders.at(-1)?.view, "quiz");
});

test("appendCalibrationOrFinish finishes immediately once the ranking is already clear", () => {
  const { ctx, state } = makeCtx();
  const win = stubWindow();
  ctx.calculateResult = () => ({
    ranking: [{ id: "clear-a", distance: 0 }, { id: "clear-b", distance: 1 }],
    calibrationCount: 0,
  });
  const quiz = createQuizController(ctx);

  try {
    quiz.appendCalibrationOrFinish();
  } finally {
    win.restore();
  }

  assert.equal(state.view, "result");
});

test("appendCalibrationOrFinish finishes once the calibration budget is spent, even with a narrow gap", () => {
  const { ctx, state } = makeCtx();
  const win = stubWindow();
  ctx.calculateResult = () => ({
    // Gap is far below CALIBRATION_GAP_THRESHOLD, but calibrationCount has
    // already reached MAX_CALIBRATION_ITEMS (3), so needsCalibration must
    // return false regardless of how close the candidates are.
    ranking: [{ id: "tied-a", distance: 0.1 }, { id: "tied-b", distance: 0.1005 }],
    calibrationCount: 3,
  });
  const quiz = createQuizController(ctx);

  try {
    quiz.appendCalibrationOrFinish();
  } finally {
    win.restore();
  }

  assert.equal(state.view, "result");
});

test("previousQuestion at index 0 goes home", () => {
  const { ctx, renders } = makeCtx({ state: { index: 0 } });
  const quiz = createQuizController(ctx);

  quiz.previousQuestion();

  assert.equal(renders.length, 1);
  assert.ok(renders[0].goHome, "should call goHome");
});

test("previousQuestion at index > 0 decrements index", () => {
  const { ctx, state, renders } = makeCtx({ state: { index: 5 } });
  const quiz = createQuizController(ctx);

  quiz.previousQuestion();

  assert.equal(state.index, 4);
  assert.equal(renders.length, 1);
  assert.equal(renders[0].view, "quiz");
});
