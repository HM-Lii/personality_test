import { DIMENSIONS } from "../core/scoring.mjs";
import {
  CALIBRATION_QUESTIONS,
  CORE_QUESTIONS,
  MIRROR_PAIRS,
} from "./questions.mjs";

export { DIMENSIONS } from "../core/scoring.mjs";
export { FIGURES } from "./figures.mjs";
export {
  CALIBRATION_QUESTIONS,
  CORE_QUESTIONS,
  MIRROR_PAIRS,
} from "./questions.mjs";

export const ALL_QUESTIONS = [...CORE_QUESTIONS, ...CALIBRATION_QUESTIONS];
export const CORE_QUESTION_IDS = CORE_QUESTIONS.map((question) => question.id);
export const questionMap = new Map(
  ALL_QUESTIONS.map((question) => [question.id, question]),
);
export const dimensionMap = new Map(
  DIMENSIONS.map((dimension) => [dimension.id, dimension]),
);
