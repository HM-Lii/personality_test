/**
 * View router: renders the current view and handles view-level transitions.
 *
 * Uses the View Transition API for cross-view fades when available, falling
 * back to direct rendering otherwise. Same-view advances (next question,
 * previous question) bypass the transition and keep their own orchestration.
 */
import { freshState } from "./storage.mjs";
import { renderHome } from "./render-home.mjs";
import { renderQuiz } from "./render-quiz.mjs";
import { renderResult } from "./render-result.mjs";
import {
  CORE_QUESTIONS,
  FIGURE_COUNT,
  questionMap,
} from "../data/catalog.mjs";

export function createViewRouter(ctx) {
  const { app, store, questionTransition, persist, calculateResult, resultDeps, revealTracker } = ctx;
  let currentView;
  let renderGeneration = 0;

  function render() {
    questionTransition.cancel();
    const targetView = store.get().view;
    const generation = ++renderGeneration;
    const update = () => {
      /* View Transition callbacks may finish out of order. */
      if (generation !== renderGeneration) return;
      const state = store.get();
      document.body.dataset.view = state.view;
      if (state.view === "quiz") {
        const outcome = renderQuiz(app, state, { CORE_QUESTIONS, questionMap });
        if (outcome?.reset) {
          store.replace(freshState());
          persist();
          renderHome(app, store.get(), { CORE_QUESTIONS, FIGURE_COUNT });
        }
        return;
      }
      if (state.view === "result") {
        renderResult(app, state, calculateResult(), resultDeps);
        revealTracker.check();
        return;
      }
      renderHome(app, state, { CORE_QUESTIONS, FIGURE_COUNT });
    };
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (
      currentView !== undefined &&
      targetView !== currentView &&
      !reduceMotion &&
      typeof document.startViewTransition === "function"
    ) {
      document.startViewTransition(update);
    } else {
      update();
    }
    currentView = targetView;
  }

  function goHome() {
    store.patch({ view: "home" });
    persist();
    render();
  }

  function startNew() {
    store.replace({ ...freshState(), view: "quiz" });
    ctx.setShareMode(false);
    history.replaceState(null, "", location.pathname + location.search);
    persist();
    render();
  }

  function resumeQuiz() {
    const state = store.get();
    store.patch({ view: state.completedAt ? "result" : "quiz" });
    persist();
    render();
  }

  return { render, goHome, startNew, resumeQuiz };
}
