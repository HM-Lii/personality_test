/**
 * App entry point — wiring only.
 *
 * Creates the shared state container and context, then delegates to the
 * bootstrap, reveal, toast, view-router, quiz-controller, and keyboard
 * modules. Event listeners for data-action clicks and dialog controls are
 * bound here so the modules stay focused on their own concerns.
 */
import { buildTestResult } from "../core/result.mjs";
import {
  FIGURES,
  FIGURE_COUNT,
  MIRROR_PAIRS,
  dimensionMap,
  questionMap,
} from "../data/catalog.mjs";
import { createCancelableTimer } from "./cancelable-timer.mjs";
import {
  buildShareText,
  copyShareText,
  buildResultUrl,
  decodeResultHash,
} from "./share.mjs";
import { freshState, restoreState, saveState } from "./storage.mjs";
import { hashString } from "./utils.mjs";
import { createAppState } from "./app-state.mjs";
import { injectFigureCounts, createInkParticles } from "./bootstrap.mjs";
import { createRevealTracker } from "./reveal.mjs";
import { createToast } from "./toast.mjs";
import { createViewRouter } from "./view-router.mjs";
import { createQuizController } from "./quiz-controller.mjs";
import { bindKeyboard } from "./keyboard.mjs";

const resultDeps = {
  questionMap,
  dimensionMap,
  figures: FIGURES,
  mirrorPairs: MIRROR_PAIRS,
  hashString,
};

export function mountApp({
  app = document.querySelector("#app"),
  methodDialog = document.querySelector("#methodDialog"),
  toast = document.querySelector("#toast"),
  brandButton = document.querySelector("#brandButton"),
  methodButton = document.querySelector("#methodButton"),
  closeMethodButton = document.querySelector("#closeMethodButton"),
} = {}) {
  injectFigureCounts();
  createInkParticles(document.querySelector("#inkParticles"));

  const store = createAppState(restoreState());
  const questionTransition = createCancelableTimer(window);
  let shareMode = false;

  const sharedState = decodeResultHash(location.hash, questionMap);
  if (sharedState) {
    store.replace(sharedState);
    shareMode = true;
  }

  const revealTracker = createRevealTracker(app);
  const showToast = createToast(toast);

  const persist = () => {
    if (shareMode) return;
    saveState(store.get());
  };

  const calculateResult = () =>
    buildTestResult(store.get().answers, resultDeps);

  const ctx = {
    app,
    store,
    questionTransition,
    persist,
    calculateResult,
    resultDeps,
    revealTracker,
    showToast,
    methodDialog,
    setShareMode: (value) => {
      shareMode = value;
    },
  };

  const router = createViewRouter(ctx);
  ctx.router = router;
  const quiz = createQuizController(ctx);

  bindKeyboard(ctx, quiz);

  app.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;

    if (action === "start" || action === "restart") router.startNew();
    if (action === "resume") router.resumeQuiz();
    if (action === "previous") quiz.previousQuestion();
    if (action === "answer") {
      const state = store.get();
      quiz.selectAnswer(
        questionMap.get(state.queue[state.index])?.id,
        target.dataset.optionId,
      );
    }
    if (action === "method") methodDialog.showModal();
    if (action === "share") {
      const shareUrl = buildResultUrl(store.get().answers);
      copyShareText(buildShareText(calculateResult(), shareUrl), { showToast });
    }
  });

  methodButton?.addEventListener("click", () => methodDialog.showModal());
  closeMethodButton?.addEventListener("click", () => methodDialog.close());
  methodDialog?.addEventListener("click", (event) => {
    if (event.target === methodDialog) methodDialog.close();
  });
  brandButton?.addEventListener("click", router.goHome);

  router.render();
}

mountApp();
