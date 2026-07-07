export const DIMENSIONS = [
  {
    id: "O",
    name: "探索开放",
    high: "偏爱新思路、抽象信息与变化",
    low: "偏爱熟悉方法、具体信息与可预期性",
  },
  {
    id: "C",
    name: "结构执行",
    high: "习惯规划、持续推进并按标准完成",
    low: "习惯保持弹性，依据现场即时调整",
  },
  {
    id: "E",
    name: "外向驱动",
    high: "从互动中获得能量，倾向主动发起",
    low: "从独处中恢复能量，倾向先观察再表达",
  },
  {
    id: "A",
    name: "协作共情",
    high: "重视关系、信任与共同利益",
    low: "重视原则、竞争与独立判断",
  },
  {
    id: "R",
    name: "复原稳定",
    high: "压力下相对平稳，恢复速度较快",
    low: "对风险和情绪信号更加敏感",
  },
];

export const RESPONSE_VALUES = [-3, -1, 1, 3];
export const CORE_ITEMS_PER_DIMENSION = 5;
export const MAX_CALIBRATION_ITEMS = 3;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const isStrictlyBelow = (value, threshold) => value < threshold - 1e-12;

/**
 * Convert a dimension's keyed answers from [-3, 3] to a tendency score in [10, 90].
 * Calibration items have the same weight as core items.
 */
export function scoreDimension(values) {
  if (!values.length) return 50;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(50 + (40 * mean) / 3);
}

export function calculateScores(answerRecords) {
  return Object.fromEntries(
    DIMENSIONS.map(({ id }) => [
      id,
      scoreDimension(
        answerRecords
          .filter((answer) => answer.dimension === id)
          .map((answer) => answer.value),
      ),
    ]),
  );
}

/**
 * Semantic mirror pairs are declared in the question bank.
 * The result describes contextual stability; it is not a validity or honesty score.
 */
export function calculateConsistency(answerRecords, mirrorPairs) {
  return Object.fromEntries(
    DIMENSIONS.map(({ id }) => {
      const pairs = mirrorPairs.filter((pair) => pair.dimension === id);
      const differences = pairs
        .map((pair) => {
          const first = answerRecords.find((answer) => answer.questionId === pair.first);
          const second = answerRecords.find((answer) => answer.questionId === pair.second);
          if (!first || !second) return null;
          return Math.abs(first.value - second.value);
        })
        .filter((value) => value !== null);

      if (!differences.length) return [id, 0.75];
      const meanDifference =
        differences.reduce((sum, value) => sum + value, 0) / differences.length;
      return [id, clamp(1 - meanDifference / 6, 0, 1)];
    }),
  );
}

export function normalizedDistance(scores, figureVector, consistency = {}) {
  let weightedSquares = 0;
  let totalWeight = 0;

  for (const { id } of DIMENSIONS) {
    const weight = 0.8 + 0.2 * (consistency[id] ?? 0.75);
    const difference = (scores[id] - figureVector[id]) / 80;
    weightedSquares += weight * difference * difference;
    totalWeight += weight;
  }

  return Math.sqrt(weightedSquares / totalWeight);
}

export function rankFigures(scores, figures, consistency = {}) {
  return figures
    .map((figure) => {
      const distance = normalizedDistance(scores, figure.vector, consistency);
      return {
        ...figure,
        distance,
        similarity: clamp(Math.round(100 * (1 - distance)), 0, 100),
      };
    })
    .sort((first, second) => first.distance - second.distance);
}

export function needsCalibration(ranking, calibrationCount = 0) {
  if (calibrationCount >= MAX_CALIBRATION_ITEMS || ranking.length < 2) return false;
  return isStrictlyBelow(ranking[1].distance - ranking[0].distance, 0.015);
}

export function isDualArchetype(ranking, calibrationCount) {
  if (calibrationCount < MAX_CALIBRATION_ITEMS || ranking.length < 2) return false;
  return isStrictlyBelow(ranking[1].distance - ranking[0].distance, 0.01);
}

export function selectCalibrationDimension(ranking, answeredDimensions = []) {
  if (ranking.length < 2) return null;
  const [first, second] = ranking;

  return DIMENSIONS.map(({ id }) => ({
    id,
    difference: Math.abs(first.vector[id] - second.vector[id]),
    alreadyUsed: answeredDimensions.includes(id),
  })).sort(
    (left, right) =>
      Number(left.alreadyUsed) - Number(right.alreadyUsed) ||
      right.difference - left.difference,
  )[0]?.id;
}

export function calculateClarity(ranking, consistency) {
  if (ranking.length < 2) return { score: 0, band: "情境型/混合轮廓" };

  const gap = clamp((ranking[1].distance - ranking[0].distance) / 0.1, 0, 1);
  const consistencyMean =
    DIMENSIONS.reduce((sum, { id }) => sum + (consistency[id] ?? 0.75), 0) /
    DIMENSIONS.length;
  const score = Math.round(100 * (0.65 * gap + 0.35 * consistencyMean));

  return {
    score,
    band:
      score >= 75 ? "轮廓较清晰" : score >= 50 ? "存在邻近原型" : "情境型/混合轮廓",
  };
}
