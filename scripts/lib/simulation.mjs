/**
 * Shared simulation primitives for validation and reporting scripts.
 *
 * Extracted from simulate-test.mjs, phase-a-report.mjs, and validate-figures.mjs
 * to eliminate triplicated random/normal/distance/reachability logic.
 */
import {
  calculateConsistency,
  calculateScores,
  rankFigures,
} from "../../src/core/scoring.mjs";
import { DIMENSION_IDS } from "../../src/data/dimensions.mjs";
import { SCORE_SPAN } from "../../src/core/scoring.mjs";

/**
 * Deterministic linear congruential generator (LCG).
 * Same seed → same sequence across runs, enabling reproducible simulations.
 */
export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/**
 * Box–Muller transform: produces a standard-normal sample from two uniform samples.
 */
export function normalSample(random) {
  const first = Math.max(random(), Number.EPSILON);
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

/**
 * Maps a latent trait value to a discrete response (-3, -1, 1, 3) with noise.
 */
export function responseFor(latent, random) {
  const observed = latent + normalSample(random) * 0.85;
  if (observed < -0.75) return -3;
  if (observed < 0) return -1;
  if (observed < 0.75) return 1;
  return 3;
}

/**
 * Extracts a figure's vector as an ordered array matching DIMENSION_IDS.
 */
export function vectorOf(figure) {
  return DIMENSION_IDS.map((id) => figure.vector[id]);
}

/**
 * Unweighted squared distance between two score vectors.
 * Intentionally differs from production `normalizedDistance` (which applies
 * consistency weighting) — validation needs pure geometric distance.
 */
export function squaredDistance(left, right) {
  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    const difference = (left[index] - right[index]) / SCORE_SPAN;
    total += difference * difference;
  }
  return total / left.length;
}

/**
 * Finds the two nearest vectors to a score vector.
 * Returns indices and distances for both.
 */
export function nearestTwo(scoreVector, vectors) {
  let firstIndex = -1;
  let secondIndex = -1;
  let firstDistance = Number.POSITIVE_INFINITY;
  let secondDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < vectors.length; index += 1) {
    const distance = squaredDistance(scoreVector, vectors[index]);
    if (distance < firstDistance) {
      secondIndex = firstIndex;
      secondDistance = firstDistance;
      firstIndex = index;
      firstDistance = distance;
    } else if (distance < secondDistance) {
      secondIndex = index;
      secondDistance = distance;
    }
  }
  return { firstIndex, secondIndex, firstDistance, secondDistance };
}

/**
 * Exhaustive grid reachability: for every combination of base score levels,
 * find the winning figure. Returns per-figure win counts, margin sums, and
 * the total number of tested combinations.
 */
export function exactReachability(vectors, scoreLevels) {
  const winnerCounts = Array(vectors.length).fill(0);
  const marginSums = Array(vectors.length).fill(0);
  let tested = 0;

  for (const O of scoreLevels) {
    for (const C of scoreLevels) {
      for (const E of scoreLevels) {
        for (const A of scoreLevels) {
          for (const R of scoreLevels) {
            const nearest = nearestTwo([O, C, E, A, R], vectors);
            winnerCounts[nearest.firstIndex] += 1;
            marginSums[nearest.firstIndex] +=
              Math.sqrt(nearest.secondDistance) - Math.sqrt(nearest.firstDistance);
            tested += 1;
          }
        }
      }
    }
  }
  return { winnerCounts, marginSums, tested };
}

/**
 * Monte-Carlo plausible distribution: samples normal score vectors and
 * counts wins per figure. The caller supplies the random generator so
 * that sensitivity sweeps can re-seed independently.
 */
export function plausibleDistribution(vectors, random, sampleCount, scoreMin, scoreMax) {
  const winnerCounts = Array(vectors.length).fill(0);
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const scoreVector = DIMENSION_IDS.map(() =>
      Math.min(scoreMax, Math.max(scoreMin, (scoreMin + scoreMax) / 2 + normalSample(random) * 17)),
    );
    winnerCounts[nearestTwo(scoreVector, vectors).firstIndex] += 1;
  }
  return winnerCounts;
}

/**
 * All pairwise distances sorted ascending. Optional limit truncates the list.
 */
export function closestPairs(vectors, limit) {
  const pairs = [];
  for (let first = 0; first < vectors.length; first += 1) {
    for (let second = first + 1; second < vectors.length; second += 1) {
      pairs.push({
        first,
        second,
        distance: Math.sqrt(squaredDistance(vectors[first], vectors[second])),
      });
    }
  }
  pairs.sort((left, right) => left.distance - right.distance);
  return limit ? pairs.slice(0, limit) : pairs;
}

/**
 * Factory: creates an `evaluate(answers)` function bound to the supplied
 * figure library and mirror-pair definitions.
 */
export function createEvaluator({ FIGURES, MIRROR_PAIRS }) {
  return function evaluate(answers) {
    const scores = calculateScores(answers);
    const consistency = calculateConsistency(answers, MIRROR_PAIRS);
    const ranking = rankFigures(scores, FIGURES, consistency);
    return { scores, consistency, ranking };
  };
}

/**
 * Calibration check with a caller-supplied gap threshold (used by
 * sensitivity sweeps that vary the threshold).
 */
export function needsCalibrationAtGap(ranking, calibrationCount, gapThreshold) {
  if (calibrationCount >= 3 || ranking.length < 2) return false;
  return ranking[1].distance - ranking[0].distance < gapThreshold - 1e-12;
}
