/**
 * Unit tests for keyboard shortcuts in the quiz view.
 *
 * bindKeyboard reads `window.addEventListener` directly (unlike
 * questionTransition, which callers inject), so every test here installs a
 * fake `window` before binding and restores the previous value afterward.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { bindKeyboard } from "../src/ui/keyboard.mjs";
import { CORE_QUESTIONS, questionMap } from "../src/data/catalog.mjs";
import { displayedOptions } from "../src/ui/utils.mjs";

function fakeWindow() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      listeners.set(type, fn);
    },
    removeEventListener(type, fn) {
      if (listeners.get(type) === fn) listeners.delete(type);
    },
    dispatch(type, event) {
      listeners.get(type)?.(event);
    },
    hasListener(type) {
      return listeners.has(type);
    },
  };
}

function fakeEvent(key, overrides = {}) {
  return {
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    ...overrides,
  };
}

function withFakeWindow(run) {
  const previous = globalThis.window;
  const win = fakeWindow();
  globalThis.window = win;
  try {
    run(win);
  } finally {
    globalThis.window = previous;
  }
}

function makeCtx({ view = "quiz", index = 0, pending = false, methodDialog = { open: false } } = {}) {
  const state = {
    view,
    queue: CORE_QUESTIONS.map((question) => question.id),
    index,
  };
  return { store: { get: () => state }, questionTransition: { pending }, methodDialog };
}

function makeQuizSpy() {
  const selectAnswerCalls = [];
  const previousQuestionCalls = [];
  return {
    selectAnswer: (...args) => selectAnswerCalls.push(args),
    previousQuestion: () => previousQuestionCalls.push(true),
    selectAnswerCalls,
    previousQuestionCalls,
  };
}

test("a digit key selects the option at that position in the displayed (shuffled) order", () => {
  withFakeWindow((win) => {
    const ctx = makeCtx();
    const quiz = makeQuizSpy();
    bindKeyboard(ctx, quiz);

    const question = questionMap.get(CORE_QUESTIONS[0].id);
    const expectedOption = displayedOptions(question)[1];

    win.dispatch("keydown", fakeEvent("2"));

    assert.deepEqual(quiz.selectAnswerCalls, [[question.id, expectedOption.id]]);
  });
});

test("a letter key (a–d) selects the option at that position, case-insensitively", () => {
  withFakeWindow((win) => {
    const ctx = makeCtx();
    const quiz = makeQuizSpy();
    bindKeyboard(ctx, quiz);

    const question = questionMap.get(CORE_QUESTIONS[0].id);
    const expectedOption = displayedOptions(question)[2];

    win.dispatch("keydown", fakeEvent("C"));

    assert.deepEqual(quiz.selectAnswerCalls, [[question.id, expectedOption.id]]);
  });
});

test("the answer keys operate on the question currently at state.queue[state.index]", () => {
  withFakeWindow((win) => {
    const ctx = makeCtx({ index: 3 });
    const quiz = makeQuizSpy();
    bindKeyboard(ctx, quiz);

    const question = questionMap.get(CORE_QUESTIONS[3].id);
    const expectedOption = displayedOptions(question)[0];

    win.dispatch("keydown", fakeEvent("1"));

    assert.deepEqual(quiz.selectAnswerCalls, [[question.id, expectedOption.id]]);
  });
});

test("ArrowLeft and Backspace go to the previous question instead of answering", () => {
  withFakeWindow((win) => {
    const ctx = makeCtx();
    const quiz = makeQuizSpy();
    bindKeyboard(ctx, quiz);

    const arrowEvent = fakeEvent("ArrowLeft");
    win.dispatch("keydown", arrowEvent);
    const backspaceEvent = fakeEvent("Backspace");
    win.dispatch("keydown", backspaceEvent);

    assert.equal(quiz.previousQuestionCalls.length, 2);
    assert.equal(quiz.selectAnswerCalls.length, 0);
    assert.ok(arrowEvent.defaultPrevented);
    assert.ok(backspaceEvent.defaultPrevented);
  });
});

test("modifier keys (ctrl / meta / alt) suppress all shortcuts", () => {
  withFakeWindow((win) => {
    const ctx = makeCtx();
    const quiz = makeQuizSpy();
    bindKeyboard(ctx, quiz);

    win.dispatch("keydown", fakeEvent("1", { ctrlKey: true }));
    win.dispatch("keydown", fakeEvent("1", { metaKey: true }));
    win.dispatch("keydown", fakeEvent("1", { altKey: true }));
    win.dispatch("keydown", fakeEvent("ArrowLeft", { ctrlKey: true }));

    assert.equal(quiz.selectAnswerCalls.length, 0);
    assert.equal(quiz.previousQuestionCalls.length, 0);
  });
});

test("shortcuts are ignored while a question transition is pending", () => {
  withFakeWindow((win) => {
    const ctx = makeCtx({ pending: true });
    const quiz = makeQuizSpy();
    bindKeyboard(ctx, quiz);

    win.dispatch("keydown", fakeEvent("1"));

    assert.equal(quiz.selectAnswerCalls.length, 0);
  });
});

test("shortcuts are ignored while the method dialog is open, including navigation", () => {
  withFakeWindow((win) => {
    const ctx = makeCtx({ methodDialog: { open: true } });
    const quiz = makeQuizSpy();
    bindKeyboard(ctx, quiz);

    win.dispatch("keydown", fakeEvent("1"));
    win.dispatch("keydown", fakeEvent("ArrowLeft"));

    assert.equal(quiz.selectAnswerCalls.length, 0);
    assert.equal(quiz.previousQuestionCalls.length, 0);
  });
});

test("shortcuts are ignored outside the quiz view, and a missing methodDialog is tolerated", () => {
  withFakeWindow((win) => {
    const ctx = makeCtx({ view: "result", methodDialog: undefined });
    const quiz = makeQuizSpy();
    bindKeyboard(ctx, quiz);

    win.dispatch("keydown", fakeEvent("1"));

    assert.equal(quiz.selectAnswerCalls.length, 0);
  });
});

test("keys outside 1–4 / a–d / arrow / backspace do nothing", () => {
  withFakeWindow((win) => {
    const ctx = makeCtx();
    const quiz = makeQuizSpy();
    bindKeyboard(ctx, quiz);

    win.dispatch("keydown", fakeEvent("5"));
    win.dispatch("keydown", fakeEvent("z"));
    win.dispatch("keydown", fakeEvent("Enter"));

    assert.equal(quiz.selectAnswerCalls.length, 0);
    assert.equal(quiz.previousQuestionCalls.length, 0);
  });
});

test("the returned cleanup function removes the keydown listener", () => {
  withFakeWindow((win) => {
    const ctx = makeCtx();
    const quiz = makeQuizSpy();
    const unbind = bindKeyboard(ctx, quiz);

    assert.ok(win.hasListener("keydown"));
    unbind();
    assert.equal(win.hasListener("keydown"), false);

    win.dispatch("keydown", fakeEvent("1"));
    assert.equal(quiz.selectAnswerCalls.length, 0);
  });
});
