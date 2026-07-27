import { MAX_CALIBRATION_ITEMS } from "../core/scoring.mjs";
import {
  CALIBRATION_QUESTIONS,
  CORE_QUESTION_IDS,
  questionMap,
} from "../data/catalog.mjs";

export const STORAGE_KEY = "figure-atlas-state-v2";

const VALID_VIEWS = new Set(["home", "quiz", "result"]);
const CALIBRATION_QUESTION_IDS = new Set(
  CALIBRATION_QUESTIONS.map((question) => question.id),
);

export function initialQueue() {
  return [...CORE_QUESTION_IDS];
}

export function freshState() {
  return {
    view: "home",
    queue: initialQueue(),
    index: 0,
    answers: [],
    completedAt: null,
  };
}

function isIsoTimestamp(value) {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === value;
}

function isValidQueue(queue) {
  if (
    !Array.isArray(queue) ||
    queue.length < CORE_QUESTION_IDS.length ||
    queue.length > CORE_QUESTION_IDS.length + MAX_CALIBRATION_ITEMS ||
    new Set(queue).size !== queue.length
  ) {
    return false;
  }

  if (
    !CORE_QUESTION_IDS.every(
      (questionId, index) => queue[index] === questionId,
    )
  ) {
    return false;
  }

  return queue
    .slice(CORE_QUESTION_IDS.length)
    .every((questionId) => CALIBRATION_QUESTION_IDS.has(questionId));
}

function sanitizeStoredState(stored) {
  if (
    !stored ||
    typeof stored !== "object" ||
    Array.isArray(stored) ||
    !VALID_VIEWS.has(stored.view) ||
    !isValidQueue(stored.queue) ||
    !Number.isInteger(stored.index) ||
    stored.index < 0 ||
    stored.index >= stored.queue.length ||
    !Array.isArray(stored.answers) ||
    !(
      stored.completedAt === null ||
      isIsoTimestamp(stored.completedAt)
    )
  ) {
    return null;
  }

  const queueIds = new Set(stored.queue);
  const answerIds = new Set();
  const answers = [];

  for (const answer of stored.answers) {
    if (
      !answer ||
      typeof answer !== "object" ||
      Array.isArray(answer) ||
      typeof answer.questionId !== "string" ||
      typeof answer.optionId !== "string" ||
      answerIds.has(answer.questionId) ||
      !queueIds.has(answer.questionId)
    ) {
      return null;
    }

    const question = questionMap.get(answer.questionId);
    const option = question?.options.find(
      (candidate) => candidate.id === answer.optionId,
    );
    if (!question || !option || answer.value !== option.value) return null;

    answerIds.add(answer.questionId);
    answers.push({
      questionId: answer.questionId,
      optionId: answer.optionId,
      value: option.value,
    });
  }

  const hasCompletedResult = stored.completedAt !== null;
  if (
    (stored.view === "result" && !hasCompletedResult) ||
    (stored.view === "quiz" && hasCompletedResult) ||
    (hasCompletedResult && answerIds.size !== queueIds.size)
  ) {
    return null;
  }

  return {
    view: stored.view,
    queue: [...stored.queue],
    index: stored.index,
    answers,
    completedAt: stored.completedAt,
  };
}

function removeStoredState(storage) {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    /* localStorage 整体不可用时也必须回退，不能让清理失败造成白屏 */
  }
}

export function restoreState(storage = localStorage) {
  try {
    const serialized = storage.getItem(STORAGE_KEY);
    if (serialized === null) return freshState();

    const restored = sanitizeStoredState(JSON.parse(serialized));
    if (restored) return restored;
  } catch {
    /* 解析失败与读取失败走同一个安全清理路径 */
  }

  removeStoredState(storage);
  return freshState();
}

export function saveState(state, storage = localStorage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 存储不可用（隐私模式/配额满）时静默降级：测试照常进行，只是不记忆进度 */
  }
}
