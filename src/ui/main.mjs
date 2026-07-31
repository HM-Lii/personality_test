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
import { buildViewModel } from "./result/view-model.mjs";
import {
  buildShareCardModel,
  renderShareCardPng,
  shareCardImage,
} from "./share-card.mjs";
import { renderResultPagePng } from "./share-page.mjs";
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
  shareDialog = document.querySelector("#shareDialog"),
  toast = document.querySelector("#toast"),
  brandButton = document.querySelector("#brandButton"),
  methodButton = document.querySelector("#methodButton"),
  closeMethodButton = document.querySelector("#closeMethodButton"),
  closeShareButton = document.querySelector("#closeShareButton"),
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
    if (action === "share-menu") shareDialog?.showModal();
    if (action === "to-top") window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* 分享菜单：判词海报、整页长图或复制文字结果 */
  const shareText = () => {
    const shareUrl = buildResultUrl(store.get().answers);
    copyShareText(buildShareText(calculateResult(), shareUrl), { showToast });
  };

  const sharePoster = () => {
    const vm = buildViewModel(store.get(), calculateResult(), resultDeps);
    const model = buildShareCardModel(vm);
    renderShareCardPng(model)
      .then((blob) =>
        shareCardImage(blob, {
          showToast,
          fileName: `未见·${vm.displayName}.png`,
        }),
      )
      .catch(() => showToast("生成失败，请重试"));
  };

  const shareFullPage = () => {
    const element = app.querySelector(".result-page");
    if (!element) return;
    showToast("正在生成整页长图…");
    const name = app.querySelector("#result-name")?.textContent.trim() || "结果";
    renderResultPagePng(element)
      .then((blob) =>
        shareCardImage(blob, {
          showToast,
          fileName: `未见·${name}-完整报告.png`,
        }),
      )
      .catch(() => showToast("生成失败，请重试"));
  };

  shareDialog?.addEventListener("click", (event) => {
    if (event.target === shareDialog) {
      shareDialog.close();
      return;
    }
    const option = event.target.closest("[data-share-option]")?.dataset.shareOption;
    if (!option) return;
    shareDialog.close();
    if (option === "poster") sharePoster();
    if (option === "page") shareFullPage();
    if (option === "text") shareText();
  });
  closeShareButton?.addEventListener("click", () => shareDialog.close());

  /* 回到顶部按钮只在页面滚动后出现 */
  window.addEventListener(
    "scroll",
    () => {
      app
        .querySelector(".float-actions")
        ?.classList.toggle("is-scrolled", window.scrollY > 480);
    },
    { passive: true },
  );

  methodButton?.addEventListener("click", () => methodDialog.showModal());
  closeMethodButton?.addEventListener("click", () => methodDialog.close());
  methodDialog?.addEventListener("click", (event) => {
    if (event.target === methodDialog) methodDialog.close();
  });
  brandButton?.addEventListener("click", router.goHome);

  router.render();
}

mountApp();
