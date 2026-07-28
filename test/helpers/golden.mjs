/**
 * Golden snapshot helpers.
 *
 * Builds fixed, deterministic inputs for every render function so their
 * string output can be snapshot-tested. Nothing here should touch the DOM or
 * the real `requestAnimationFrame`; callers are expected to run under
 * `node --test` with no browser.
 *
 * Update snapshots with:  UPDATE_GOLDEN=1 npm test
 */
import { buildTestResult } from "../../src/core/result.mjs";
import {
  CALIBRATION_QUESTIONS,
  CORE_QUESTIONS,
  MIRROR_PAIRS,
} from "../../src/data/questions.mjs";
import { FIGURES } from "../../src/data/figures.mjs";
import { DIMENSIONS } from "../../src/core/scoring.mjs";

const dimensionMap = new Map(DIMENSIONS.map((d) => [d.id, d]));
const questionMap = new Map(
  [...CORE_QUESTIONS, ...CALIBRATION_QUESTIONS].map((q) => [q.id, q]),
);

/** Fixed hashString so report IDs are stable across runs. */
export function fixedHashString(input) {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** Fixed completedAt so report IDs and result timestamps don't drift. */
export const FIXED_COMPLETED_AT = "2026-07-27T00:00:00.000Z";

/** Shared deps bundle passed to render functions and buildTestResult. */
export const renderDeps = {
  questionMap,
  dimensionMap,
  figures: FIGURES,
  mirrorPairs: MIRROR_PAIRS,
  hashString: fixedHashString,
};

/** A minimal fake app element that just captures innerHTML assignments. */
export function fakeApp() {
  return { innerHTML: "", focus() {} };
}

/**
 * Stub `requestAnimationFrame` on the given object (or a plain object if
 * none given) so renderQuiz's focus call doesn't blow up under node.
 * Returns a function that restores the previous value.
 */
export function stubRequestAnimationFrame(target = {}) {
  const previous = target.requestAnimationFrame;
  target.requestAnimationFrame = (fn) => fn();
  return () => {
    target.requestAnimationFrame = previous;
  };
}

/** All 25 core answers set to option A. */
function coreAnswersOptionA() {
  return CORE_QUESTIONS.map((q) => {
    const opt = q.options[0];
    return { questionId: q.id, optionId: opt.id, value: opt.value };
  });
}

/**
 * Single-archetype result: option A on all core + calibration
 * RX1:A, AX1:D, CX1:A. Primary = 司马光, dual = false.
 */
export function singleArchetypeAnswers() {
  const calibration = [
    { questionId: "RX1", optionId: "A", value: 3 },
    { questionId: "AX1", optionId: "D", value: 3 },
    { questionId: "CX1", optionId: "A", value: 3 },
  ];
  return [...coreAnswersOptionA(), ...calibration];
}

/**
 * Dual-archetype result: option A on all core + calibration
 * RX1:C, AX1:C, OX1:C. Primary = 嵇康, secondary = 刘伶, dual = true.
 */
export function dualArchetypeAnswers() {
  const calibration = [
    { questionId: "RX1", optionId: "C", value: -1 },
    { questionId: "AX1", optionId: "C", value: 1 },
    { questionId: "OX1", optionId: "C", value: 1 },
  ];
  return [...coreAnswersOptionA(), ...calibration];
}

/**
 * Full queue: 25 core IDs + the 3 calibration IDs the adaptive flow actually
 * appends for the given answer set. Both fixtures start with RX1 and AX1; they
 * diverge on the third question because the top-two candidates differ by then.
 */
export function fullQueue(calibrationIds = ["RX1", "AX1", "CX1"]) {
  const core = CORE_QUESTIONS.map((q) => q.id);
  return [...core, ...calibrationIds];
}

/** Build a real result for the given answer set. */
export function buildResult(answers) {
  return buildTestResult(answers, renderDeps);
}

/**
 * Synthetic result that triggers the empty-evidence fallback: two figures
 * with identical vectors so no dimension has a deciding advantage.
 */
export function emptyEvidenceResult() {
  const vector = { O: 70, C: 70, E: 70, A: 70, R: 70 };
  const twinA = {
    id: "twin-a",
    name: "甲原型",
    era: "示例",
    archetype: "用于测试的等距原型甲",
    vector,
    bio: "测试用合成原型，与乙原型五维完全相同。",
    tags: ["测试"],
    rationale: "合成数据。",
    evidenceChains: [],
    narrativeBasis: "合成数据",
  };
  const twinB = {
    ...twinA,
    id: "twin-b",
    name: "乙原型",
    archetype: "用于测试的等距原型乙",
    bio: "测试用合成原型，与甲原型五维完全相同。",
  };
  return {
    records: [],
    scores: { ...vector },
    consistency: { O: 1, C: 1, E: 1, A: 1, R: 1 },
    ranking: [
      { ...twinA, distance: 0, similarity: 100 },
      { ...twinB, distance: 0, similarity: 100 },
    ],
    calibrationCount: 3,
    clarity: { score: 50, band: "存在邻近原型" },
    dual: true,
  };
}

/**
 * Synthetic result that triggers the empty-contrast fallback: user scores
 * exactly match the primary figure's vector so every dimension gap is 0.
 */
export function emptyContrastResult() {
  const primary = FIGURES[0];
  return {
    records: [],
    scores: { ...primary.vector },
    consistency: { O: 1, C: 1, E: 1, A: 1, R: 1 },
    ranking: [
      { ...primary, distance: 0, similarity: 100 },
      { ...FIGURES[1], distance: 0.5, similarity: 50 },
    ],
    calibrationCount: 3,
    clarity: { score: 75, band: "轮廓较清晰" },
    dual: false,
  };
}

/** Home page states. */
export function homeStateFresh() {
  return { view: "home", answers: [], queue: [], index: 0, completedAt: null };
}

export function homeStateInProgress() {
  return {
    view: "home",
    answers: CORE_QUESTIONS.slice(0, 3).map((q) => {
      const opt = q.options[0];
      return { questionId: q.id, optionId: opt.id, value: opt.value };
    }),
    queue: CORE_QUESTIONS.slice(0, 3).map((q) => q.id),
    index: 3,
    completedAt: null,
  };
}

export function homeStateCompleted() {
  return {
    view: "home",
    answers: singleArchetypeAnswers(),
    queue: fullQueue(),
    index: 27,
    completedAt: FIXED_COMPLETED_AT,
  };
}

/** Quiz page states. */
export function quizStateCore() {
  return {
    view: "quiz",
    answers: [],
    queue: CORE_QUESTIONS.map((q) => q.id),
    index: 0,
    completedAt: null,
  };
}

export function quizStateCalibration() {
  return {
    view: "quiz",
    answers: coreAnswersOptionA(),
    queue: fullQueue(),
    index: CORE_QUESTIONS.length,
    completedAt: null,
  };
}

/** Result page states. */
export function resultStateSingle() {
  return {
    view: "result",
    answers: singleArchetypeAnswers(),
    queue: fullQueue(),
    index: 27,
    completedAt: FIXED_COMPLETED_AT,
  };
}

export function resultStateDual() {
  return {
    view: "result",
    answers: dualArchetypeAnswers(),
    queue: fullQueue(["RX1", "AX1", "OX1"]),
    index: 27,
    completedAt: FIXED_COMPLETED_AT,
  };
}
