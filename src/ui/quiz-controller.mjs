/**
 * Quiz state machine: answer selection, navigation, calibration flow.
 *
 * All functions go through the shared `questionTransition` timer so that
 * rapid input (double-click, keyboard during animation) cannot corrupt the
 * quiz index or skip questions.
 */
import {
  needsCalibration,
  selectCalibrationDimension,
} from "../core/scoring.mjs";
import { prepareAnswerUpdate } from "../core/session.mjs";
import {
  CALIBRATION_QUESTIONS,
  CORE_QUESTION_IDS,
  CORE_QUESTIONS,
  questionMap,
} from "../data/catalog.mjs";

const ANSWER_TRANSITION_MS = 260;

export function createQuizController(ctx) {
  const { app, store, questionTransition, persist, calculateResult, router } = ctx;

  function finishResult() {
    store.patch({
      view: "result",
      completedAt: new Date().toISOString(),
    });
    persist();
    router.render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function appendCalibrationOrFinish() {
    const state = store.get();
    const result = calculateResult();
    if (!needsCalibration(result.ranking, result.calibrationCount)) {
      finishResult();
      return;
    }

    const usedDimensions = state.queue
      .slice(CORE_QUESTIONS.length)
      .map((id) => questionMap.get(id)?.dimension)
      .filter(Boolean);
    const dimension = selectCalibrationDimension(
      result.ranking,
      usedDimensions,
    );
    const nextQuestion = CALIBRATION_QUESTIONS.find(
      (question) =>
        question.dimension === dimension && !state.queue.includes(question.id),
    );

    if (!nextQuestion) {
      finishResult();
      return;
    }

    store.patch({
      queue: [...state.queue, nextQuestion.id],
      index: state.index + 1,
    });
    persist();
    router.render();
  }

  function selectAnswer(questionId, optionId) {
    if (questionTransition.pending) return;

    const state = store.get();
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

    store.patch({
      queue: prepared.queue,
      answers: [...prepared.answers, { questionId, optionId, value: selected.value }],
    });
    persist();

    const selectedButton = app.querySelector(`[data-option-id="${optionId}"]`);
    selectedButton?.classList.add("selected");

    const card = app.querySelector(".question-card");
    card?.classList.add("leaving");

    questionTransition.schedule(() => {
      const current = store.get();
      if (current.index < CORE_QUESTIONS.length - 1) {
        store.patch({ index: current.index + 1 });
        persist();
        router.render();
        return;
      }
      appendCalibrationOrFinish();
    }, ANSWER_TRANSITION_MS);
  }

  function previousQuestion() {
    const state = store.get();
    if (state.index === 0) {
      router.goHome();
      return;
    }
    store.patch({ index: state.index - 1 });
    persist();
    router.render();
  }

  return { selectAnswer, previousQuestion, appendCalibrationOrFinish, finishResult };
}
