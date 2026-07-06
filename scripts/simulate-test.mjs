import {
  calculateConsistency,
  calculateScores,
  isDualArchetype,
  needsCalibration,
  rankFigures,
  selectCalibrationDimension,
} from "../src/core/scoring.mjs";
import { FIGURES } from "../src/data/figures.mjs";
import {
  CALIBRATION_QUESTIONS,
  CORE_QUESTIONS,
  MIRROR_PAIRS,
} from "../src/data/questions.mjs";

const DIMENSIONS = ["O", "C", "E", "A", "R"];
const SAMPLE_COUNT = 100_000;

function createRandom(seed = 20260706) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function normalSample(random) {
  const first = Math.max(random(), Number.EPSILON);
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function responseFor(latent, random) {
  const observed = latent + normalSample(random) * 0.85;
  if (observed < -0.75) return -3;
  if (observed < 0) return -1;
  if (observed < 0.75) return 1;
  return 3;
}

function evaluate(answers) {
  const scores = calculateScores(answers);
  const consistency = calculateConsistency(answers, MIRROR_PAIRS);
  const ranking = rankFigures(scores, FIGURES, consistency);
  return { scores, consistency, ranking };
}

const random = createRandom();
const calibrationCounts = [0, 0, 0, 0];
const figureCounts = new Map(FIGURES.map((figure) => [figure.id, 0]));
let dualCount = 0;
let clarityGapTotal = 0;
const gapThresholdCounts = new Map(
  [0.005, 0.01, 0.015, 0.02, 0.025, 0.035].map((threshold) => [threshold, 0]),
);

for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
  const latent = Object.fromEntries(
    DIMENSIONS.map((dimension) => [dimension, normalSample(random) * 0.8]),
  );
  const answers = CORE_QUESTIONS.map((question) => ({
    questionId: question.id,
    dimension: question.dimension,
    value: responseFor(latent[question.dimension], random),
  }));
  const usedCalibrationDimensions = [];
  let result = evaluate(answers);
  let calibrationCount = 0;

  while (needsCalibration(result.ranking, calibrationCount)) {
    const dimension = selectCalibrationDimension(
      result.ranking,
      usedCalibrationDimensions,
    );
    const question = CALIBRATION_QUESTIONS.find(
      (item) =>
        item.dimension === dimension &&
        !answers.some((answer) => answer.questionId === item.id),
    );
    if (!question) break;

    answers.push({
      questionId: question.id,
      dimension: question.dimension,
      value: responseFor(latent[question.dimension], random),
    });
    usedCalibrationDimensions.push(dimension);
    calibrationCount += 1;
    result = evaluate(answers);
  }

  calibrationCounts[calibrationCount] += 1;
  const dual = isDualArchetype(result.ranking, calibrationCount);
  if (dual) dualCount += 1;
  figureCounts.set(
    result.ranking[0].id,
    (figureCounts.get(result.ranking[0].id) ?? 0) + 1,
  );
  const finalGap = result.ranking[1].distance - result.ranking[0].distance;
  clarityGapTotal += finalGap;
  for (const threshold of gapThresholdCounts.keys()) {
    if (calibrationCount === 3 && finalGap < threshold) {
      gapThresholdCounts.set(threshold, gapThresholdCounts.get(threshold) + 1);
    }
  }
}

const resultDistribution = FIGURES.map((figure) => ({
  name: figure.name,
  count: figureCounts.get(figure.id),
  share: `${((figureCounts.get(figure.id) / SAMPLE_COUNT) * 100).toFixed(2)}%`,
})).sort((left, right) => right.count - left.count);

console.log(`模拟答卷：${SAMPLE_COUNT.toLocaleString("en-US")}`);
console.table(
  calibrationCounts.map((count, questions) => ({
    calibrationQuestions: questions,
    count,
    share: `${((count / SAMPLE_COUNT) * 100).toFixed(2)}%`,
  })),
);
console.log(`双原型比例：${((dualCount / SAMPLE_COUNT) * 100).toFixed(2)}%`);
console.log(
  `最终前两名平均距离差：${(clarityGapTotal / SAMPLE_COUNT).toFixed(4)}`,
);
console.table(
  [...gapThresholdCounts].map(([threshold, count]) => ({
    dualGapThreshold: threshold,
    count,
    overallShare: `${((count / SAMPLE_COUNT) * 100).toFixed(2)}%`,
  })),
);
console.log("\n结果分布（前15）：");
console.table(resultDistribution.slice(0, 15));
console.log(
  `模拟中出现过的主原型：${resultDistribution.filter((row) => row.count > 0).length}/${FIGURES.length}`,
);

if (calibrationCounts.reduce((sum, count) => sum + count, 0) !== SAMPLE_COUNT) {
  throw new Error("辨析题计数与样本数不一致");
}
