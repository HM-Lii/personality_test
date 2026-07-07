import {
  needsCalibration,
  selectCalibrationDimension,
} from "../core/scoring.mjs";
import { buildTestResult } from "../core/result.mjs";
import { prepareAnswerUpdate } from "../core/session.mjs";
import {
  CALIBRATION_QUESTIONS,
  CORE_QUESTION_IDS,
  CORE_QUESTIONS,
  FIGURES,
  MIRROR_PAIRS,
  dimensionMap,
  questionMap,
} from "../data/catalog.mjs";
import { renderHome } from "./render-home.mjs";
import { renderQuiz } from "./render-quiz.mjs";
import { renderResult } from "./render-result.mjs";
import { buildShareText, copyShareText } from "./share.mjs";
import { freshState, restoreState, saveState } from "./storage.mjs";
import { hashString } from "./utils.mjs";

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
  let state = restoreState();

  /* 浮动墨点背景：一次性生成 */
  const inkContainer = document.querySelector("#inkParticles");
  if (inkContainer && inkContainer.childElementCount === 0) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < 14; i += 1) {
      const span = document.createElement("span");
      const size = 3 + Math.random() * 7;
      span.style.left = `${Math.random() * 100}%`;
      span.style.width = `${size}px`;
      span.style.height = `${size}px`;
      span.style.animationDuration = `${18 + Math.random() * 22}s`;
      span.style.animationDelay = `${-Math.random() * 30}s`;
      fragment.appendChild(span);
    }
    inkContainer.appendChild(fragment);
  }

  /* 报告卡片滚动揭示 */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  );

  function observeReveals() {
    app
      .querySelectorAll(".reveal:not(.is-visible)")
      .forEach((node) => revealObserver.observe(node));
  }

  function persist() {
    saveState(state);
  }

  function calculateResult() {
    return buildTestResult(state.answers, resultDeps);
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function render() {
    document.body.dataset.view = state.view;
    if (state.view === "quiz") {
      const outcome = renderQuiz(app, state, { CORE_QUESTIONS, questionMap });
      if (outcome?.reset) {
        state = freshState();
        persist();
        renderHome(app, state, { CORE_QUESTIONS });
      }
      return;
    }
    if (state.view === "result") {
      renderResult(app, state, calculateResult(), resultDeps);
      observeReveals();
      return;
    }
    renderHome(app, state, { CORE_QUESTIONS });
  }
  function goHome() {
    state.view = "home";
    persist();
    render();
  }

  function startNew() {
    state = { ...freshState(), view: "quiz" };
    persist();
    render();
  }

  function resumeQuiz() {
    state.view = state.completedAt ? "result" : "quiz";
    persist();
    render();
  }

  function finishResult() {
    state.view = "result";
    state.completedAt = new Date().toISOString();
    persist();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function appendCalibrationOrFinish() {
    const result = calculateResult();
    if (!needsCalibration(result.ranking, result.calibrationCount)) {
      finishResult();
      return;
    }

    const usedDimensions = state.queue
      .slice(CORE_QUESTIONS.length)
      .map((id) => questionMap.get(id)?.dimension)
      .filter(Boolean);
    const dimension = selectCalibrationDimension(result.ranking, usedDimensions);
    const nextQuestion = CALIBRATION_QUESTIONS.find(
      (question) =>
        question.dimension === dimension && !state.queue.includes(question.id),
    );

    if (!nextQuestion) {
      finishResult();
      return;
    }

    state.queue.push(nextQuestion.id);
    state.index += 1;
    persist();
    render();
  }

  function selectAnswer(questionId, optionId) {
    const question = questionMap.get(questionId);
    const selected = question?.options.find((item) => item.id === optionId);
    if (!question || !selected) return;

    const prepared = prepareAnswerUpdate({
      queue: state.queue,
      answers: state.answers,
      index: state.index,
      questionId,
      coreQuestionIds: CORE_QUESTION_IDS,
    });
    state.queue = prepared.queue;
    state.answers = prepared.answers;
    state.answers.push({
      questionId,
      optionId,
      value: selected.value,
    });
    persist();

    const selectedButton = app.querySelector(`[data-option-id="${optionId}"]`);
    selectedButton?.classList.add("selected");

    const card = app.querySelector(".question-card");
    card?.classList.add("leaving");

    window.setTimeout(() => {
      if (state.index < CORE_QUESTIONS.length - 1) {
        state.index += 1;
        persist();
        render();
        return;
      }
      appendCalibrationOrFinish();
    }, 260);
  }

  function previousQuestion() {
    if (state.index === 0) {
      goHome();
      return;
    }
    state.index -= 1;
    persist();
    render();
  }

  function shareResult() {
    copyShareText(buildShareText(calculateResult()), { showToast });
  }

  app.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;

    if (action === "start" || action === "restart") startNew();
    if (action === "resume") resumeQuiz();
    if (action === "previous") previousQuestion();
    if (action === "answer") {
      selectAnswer(
        questionMap.get(state.queue[state.index])?.id,
        target.dataset.optionId,
      );
    }
    if (action === "method") methodDialog.showModal();
    if (action === "share") shareResult();
  });

  methodButton?.addEventListener("click", () => methodDialog.showModal());
  closeMethodButton?.addEventListener("click", () => methodDialog.close());
  methodDialog?.addEventListener("click", (event) => {
    if (event.target === methodDialog) methodDialog.close();
  });
  brandButton?.addEventListener("click", goHome);

  render();
}

mountApp();
