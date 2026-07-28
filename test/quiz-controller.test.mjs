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

  return {
    ctx: {
      app,
      store,
      questionTransition,
      persist: () => {},
      calculateResult: () => buildTestResult(state.answers, resultDeps),
      router,
    },
    state,
    renders,
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

test("selectAnswer on the last core question triggers calibration or finish", () => {
  // Pre-fill 24 answers (all but the last core question)
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

  // After the transition, either calibration is appended or result is finished
  assert.ok(
    state.queue.length > CORE_QUESTIONS.length || state.view === "result",
    "should append calibration or finish",
  );
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
