/**
 * Validation-layer parameters that must NOT leak into `src/`.
 *
 * These thresholds govern simulation, figure-distance checks, and phase-A
 * acceptance gates. They are intentionally separate from the production
 * scoring constants in `src/core/scoring.mjs` because they encode *quality
 * bar* decisions (how close is "too close", how many samples to draw) rather
 * than scoring semantics.
 */

/** Minimum normalized distance between any two figure prototypes. */
export const MIN_FIGURE_DISTANCE = 0.065;

/** Sample counts for Monte-Carlo simulation. */
export const SIMULATION_SAMPLE_COUNT = 200_000;
export const SIMULATION_SAMPLE_COUNT_FAST = 100_000;

/** RNG seed shared across simulation scripts so runs are reproducible. */
export const SIMULATION_SEED = 20260706;

/** Option-text readability budget (characters per option). */
export const OPTION_TEXT_MAX_LENGTH = 20;
export const OPTION_TEXT_AVG_MAX_LENGTH = 17;

/** Minimum calibration questions per dimension in the bank (not the same as
 *  MAX_CALIBRATION_ITEMS, which caps how many a single user is asked). */
export const MIN_CALIBRATION_QUESTIONS_PER_DIMENSION = 3;

/** Exact-reachability grid: 4^? response combinations per dimension. */
export const BASE_SCORE_LEVELS = 16;
export const EXACT_GRID_SIZE = BASE_SCORE_LEVELS ** 5;

/** Phase-A acceptance thresholds (see docs/PHASE_A.md task 7). */
export const PHASE_A_THRESHOLDS = {
  topFigureShareMax: 0.08,
  dualRateMin: 0.05,
  dualRateMax: 0.25,
  calibrationTriggerMin: 0.2,
  calibrationTriggerMax: 0.5,
  unreachableMax: 0,
  closePairsMax: 0,
  closePairDistance: MIN_FIGURE_DISTANCE,
};

/** Sensitivity sweeps around the production gap thresholds. */
export const DUAL_GAP_SENSITIVITY = [0.01, 0.015, 0.02, 0.025];
export const CALIBRATION_GAP_SENSITIVITY = [0.015, 0.02, 0.025, 0.03, 0.035];
