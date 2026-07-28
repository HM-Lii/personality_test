/**
 * Unit tests for the view router.
 *
 * Stubs the render functions, document, and window so the routing logic
 * (view dispatch, start-new, resume, go-home) can be tested without a
 * browser.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createAppState } from "../src/ui/app-state.mjs";
import { createViewRouter } from "../src/ui/view-router.mjs";
import { CORE_QUESTIONS, FIGURES, questionMap, dimensionMap, MIRROR_PAIRS } from "../src/data/catalog.mjs";
import { buildTestResult } from "../src/core/result.mjs";

function setupDom({
  reduceMotion = true,
  startViewTransition,
} = {}) {
  const savedDocument = globalThis.document;
  const savedWindow = globalThis.window;
  const savedRaf = globalThis.requestAnimationFrame;
  const savedHistory = globalThis.history;
  const savedLocation = globalThis.location;

  globalThis.document = {
    body: { dataset: {} },
    startViewTransition,
  };
  globalThis.window = {
    matchMedia: () => ({ matches: reduceMotion }),
  };
  globalThis.requestAnimationFrame = (fn) => fn();
  globalThis.history = { replaceState: () => {} };
  globalThis.location = { hash: "", pathname: "/", search: "" };

  return () => {
    globalThis.document = savedDocument;
    globalThis.window = savedWindow;
    globalThis.requestAnimationFrame = savedRaf;
    globalThis.history = savedHistory;
    globalThis.location = savedLocation;
  };
}

function makeCtx(overrides = {}) {
  const initialState = {
    view: "home",
    answers: [],
    queue: CORE_QUESTIONS.map((q) => q.id),
    index: 0,
    completedAt: null,
    ...overrides.state,
  };
  const store = createAppState(initialState);
  const persistCalls = [];
  const revealTracker = { check: () => {} };
  let shareMode = false;

  return {
    ctx: {
      app: { querySelector: () => null, querySelectorAll: () => [], focus: () => {} },
      store,
      questionTransition: { cancel: () => {}, pending: false, schedule: () => {} },
      persist: () => persistCalls.push(store.get()),
      calculateResult: () => buildTestResult(store.get().answers, {
        questionMap,
        dimensionMap,
        figures: FIGURES,
        mirrorPairs: MIRROR_PAIRS,
        hashString: (s) => { let h = 5381; for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h >>> 0; },
      }),
      resultDeps: { questionMap, dimensionMap, figures: FIGURES, mirrorPairs: MIRROR_PAIRS, hashString: (s) => { let h = 5381; for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h >>> 0; } },
      revealTracker,
      setShareMode: (v) => {
        shareMode = v;
      },
      getShareMode: () => shareMode,
    },
    store,
    persistCalls,
    get state() {
      return store.get();
    },
  };
}

test("render sets document.body.dataset.view to the current view", () => {
  const cleanup = setupDom();
  try {
    const fixture = makeCtx({ state: { view: "quiz" } });
    const router = createViewRouter(fixture.ctx);
    router.render();
    assert.equal(globalThis.document.body.dataset.view, "quiz");
  } finally {
    cleanup();
  }
});

test("startNew replaces state with a fresh quiz state and clears share mode", () => {
  const cleanup = setupDom();
  try {
    const fixture = makeCtx();
    const router = createViewRouter(fixture.ctx);
    router.startNew();
    assert.equal(fixture.state.view, "quiz");
    assert.equal(fixture.state.answers.length, 0);
    assert.equal(fixture.state.index, 0);
    assert.equal(fixture.ctx.getShareMode(), false, "share mode should be cleared");
  } finally {
    cleanup();
  }
});

test("resumeQuiz goes to result when completedAt is set", () => {
  const cleanup = setupDom();
  try {
    const fixture = makeCtx({
      state: { completedAt: "2026-07-27T00:00:00.000Z" },
    });
    const router = createViewRouter(fixture.ctx);
    router.resumeQuiz();
    assert.equal(fixture.state.view, "result");
  } finally {
    cleanup();
  }
});

test("resumeQuiz goes to quiz when not completed", () => {
  const cleanup = setupDom();
  try {
    const fixture = makeCtx({ state: { completedAt: null } });
    const router = createViewRouter(fixture.ctx);
    router.resumeQuiz();
    assert.equal(fixture.state.view, "quiz");
  } finally {
    cleanup();
  }
});

test("goHome sets view to home and persists", () => {
  const cleanup = setupDom();
  try {
    const fixture = makeCtx({ state: { view: "quiz" } });
    const router = createViewRouter(fixture.ctx);
    router.goHome();
    assert.equal(fixture.state.view, "home");
    assert.equal(fixture.persistCalls.length, 1);
  } finally {
    cleanup();
  }
});

test("stale view-transition callbacks cannot overwrite the latest view", () => {
  const callbacks = [];
  const cleanup = setupDom({
    reduceMotion: false,
    startViewTransition: (update) => {
      callbacks.push(update);
      return {};
    },
  });
  try {
    const fixture = makeCtx();
    const router = createViewRouter(fixture.ctx);
    router.render();

    router.startNew();
    router.goHome();

    assert.equal(callbacks.length, 2);
    assert.equal(fixture.state.view, "home");

    callbacks[1]();
    callbacks[0]();

    assert.equal(fixture.state.view, "home");
    assert.equal(globalThis.document.body.dataset.view, "home");
    assert.match(fixture.ctx.app.innerHTML, /class="hero"/);
    assert.doesNotMatch(fixture.ctx.app.innerHTML, /class="quiz-shell"/);
  } finally {
    cleanup();
  }
});
