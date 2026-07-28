import { FIGURES } from "../src/data/figures.mjs";
import { DIMENSION_IDS } from "../src/data/dimensions.mjs";
import { SCORE_SPAN, SCORE_MIN, SCORE_MAX } from "../src/core/scoring.mjs";
import {
  BASE_SCORE_LEVELS,
  MIN_FIGURE_DISTANCE,
  SIMULATION_SAMPLE_COUNT,
  SIMULATION_SEED,
} from "./lib/thresholds.mjs";
import {
  vectorOf,
  exactReachability,
  closestPairs,
  createRandom,
  normalSample,
  nearestTwo,
} from "./lib/simulation.mjs";

/**
 * Score levels reachable by 5 core questions per dimension (16 distinct sums).
 * Derived from the same formula as `scoreDimension` in scoring.mjs.
 */
const SCORE_LEVELS = Array.from({ length: BASE_SCORE_LEVELS }, (_, index) =>
  Math.round((SCORE_MIN + SCORE_MAX) / 2 + (SCORE_SPAN / 2 * (-15 + index * 2)) / 15),
);

function plausibleDistribution(vectors, sampleCount = SIMULATION_SAMPLE_COUNT) {
  const random = createRandom(SIMULATION_SEED);
  const winnerCounts = Array(vectors.length).fill(0);

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const scoreVector = DIMENSION_IDS.map(() =>
      Math.min(SCORE_MAX, Math.max(SCORE_MIN, (SCORE_MIN + SCORE_MAX) / 2 + normalSample(random) * 17)),
    );
    winnerCounts[nearestTwo(scoreVector, vectors).firstIndex] += 1;
  }

  return winnerCounts;
}

function validateShape() {
  const ids = new Set();
  const names = new Set();
  const issues = [];

  for (const figure of FIGURES) {
    if (ids.has(figure.id)) issues.push(`duplicate id: ${figure.id}`);
    if (names.has(figure.name)) issues.push(`duplicate name: ${figure.name}`);
    ids.add(figure.id);
    names.add(figure.name);

    for (const id of DIMENSION_IDS) {
      const value = figure.vector[id];
      if (!Number.isFinite(value) || value < 10 || value > 98) {
        issues.push(`${figure.name}.${id} is outside [10, 98]: ${value}`);
      }
    }
  }

  if (issues.length) {
    throw new Error(`Figure data validation failed:\n${issues.join("\n")}`);
  }
}

validateShape();

const vectors = FIGURES.map(vectorOf);
const exact = exactReachability(vectors, SCORE_LEVELS);
const plausibleCounts = plausibleDistribution(vectors);
const rows = FIGURES.map((figure, index) => ({
  name: figure.name,
  era: figure.era,
  gridWins: exact.winnerCounts[index],
  gridShare: `${((exact.winnerCounts[index] / exact.tested) * 100).toFixed(3)}%`,
  normalWins: plausibleCounts[index],
  normalShare: `${((plausibleCounts[index] / SIMULATION_SAMPLE_COUNT) * 100).toFixed(3)}%`,
  meanMargin:
    exact.winnerCounts[index] === 0
      ? "—"
      : (exact.marginSums[index] / exact.winnerCounts[index]).toFixed(4),
})).sort((left, right) => left.gridWins - right.gridWins);

console.log(`人物候选数: ${FIGURES.length}`);
console.log(`穷举核心题可达分数组合: ${exact.tested.toLocaleString("en-US")}`);
console.table(rows);

console.log("\n最接近的人物向量：");
console.table(
  closestPairs(vectors, 12).map((pair) => ({
    first: FIGURES[pair.first].name,
    second: FIGURES[pair.second].name,
    normalizedDistance: pair.distance.toFixed(4),
  })),
);

const unreachable = rows.filter((row) => row.gridWins === 0);
const extremelyRare = rows.filter((row) => row.normalWins < 50);
const closePairs = closestPairs(vectors, 100).filter((pair) => pair.distance < MIN_FIGURE_DISTANCE);

console.log("\n质量门槛：");
console.log(`- 不可达人物: ${unreachable.length}`);
console.log(`- 正态模拟中少于50次: ${extremelyRare.length}`);
console.log(`- 标准化距离小于${MIN_FIGURE_DISTANCE}的人物对: ${closePairs.length}`);

if (unreachable.length || closePairs.length) {
  process.exitCode = 1;
}
