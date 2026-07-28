import {
  calculateConsistency,
  calculateScores,
  isDualArchetype,
  rankFigures,
  selectCalibrationDimension,
  CALIBRATION_GAP_THRESHOLD,
  DUAL_ARCHETYPE_GAP_THRESHOLD,
} from "../src/core/scoring.mjs";
import { FIGURES } from "../src/data/figures.mjs";
import {
  CALIBRATION_QUESTIONS,
  CORE_QUESTIONS,
  MIRROR_PAIRS,
} from "../src/data/questions.mjs";
import { DIMENSION_IDS } from "../src/data/dimensions.mjs";
import {
  PHASE_A_THRESHOLDS,
  DUAL_GAP_SENSITIVITY,
  CALIBRATION_GAP_SENSITIVITY,
  SIMULATION_SAMPLE_COUNT,
  SIMULATION_SAMPLE_COUNT_FAST,
  EXACT_GRID_SIZE,
  SIMULATION_SEED,
  BASE_SCORE_LEVELS,
} from "./lib/thresholds.mjs";
import {
  createRandom,
  normalSample,
  responseFor,
  vectorOf,
  exactReachability,
  closestPairs,
  nearestTwo,
  createEvaluator,
  needsCalibrationAtGap,
} from "./lib/simulation.mjs";
import { formatPercent, printChecksReport } from "./lib/report.mjs";

// 阶段 A 验收门槛（见 docs/PHASE_A.md 任务 7）
const THRESHOLDS = {
  ...PHASE_A_THRESHOLDS,
  calibrationGapThreshold: CALIBRATION_GAP_THRESHOLD,
  dualGapThreshold: DUAL_ARCHETYPE_GAP_THRESHOLD,
  dualGapSensitivity: DUAL_GAP_SENSITIVITY,
  calibrationGapSensitivity: CALIBRATION_GAP_SENSITIVITY,
};

// 开工前基线（docs/phase-a-baseline.md，57 人、阈值 0.035）
const BASELINE = {
  figureCount: 57,
  topFigureName: "项羽",
  topFigureShare: 0.179,
  dualRate: 0.1983,
  calibrationTriggerRate: 0.6098,
  unreachable: 0,
  closePairs: 0,
  calibrationGapThreshold: 0.035,
};

const EXACT_SAMPLES = EXACT_GRID_SIZE;
const NORMAL_SAMPLES = SIMULATION_SAMPLE_COUNT;
const FLOW_SAMPLES = SIMULATION_SAMPLE_COUNT_FAST;

const SCORE_LEVELS = Array.from({ length: BASE_SCORE_LEVELS }, (_, index) =>
  Math.round(50 + (40 * (-15 + index * 2)) / 15),
);

const evaluate = createEvaluator({ FIGURES, MIRROR_PAIRS });

function simulateFlow(random, calibrationGapThreshold = THRESHOLDS.calibrationGapThreshold) {
  const figureCounts = new Map(FIGURES.map((figure) => [figure.id, 0]));
  const calibrationCounts = [0, 0, 0, 0];
  let dualCount = 0;
  const gapSensitivity = new Map(
    THRESHOLDS.dualGapSensitivity.map((threshold) => [threshold, 0]),
  );

  for (let sample = 0; sample < FLOW_SAMPLES; sample += 1) {
    const latent = Object.fromEntries(
      DIMENSION_IDS.map((dimension) => [dimension, normalSample(random) * 0.8]),
    );
    const answers = CORE_QUESTIONS.map((question) => ({
      questionId: question.id,
      dimension: question.dimension,
      value: responseFor(latent[question.dimension], random),
    }));
    const usedCalibrationDimensions = [];
    let result = evaluate(answers);
    let calibrationCount = 0;

    while (needsCalibrationAtGap(result.ranking, calibrationCount, calibrationGapThreshold)) {
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
    if (isDualArchetype(result.ranking, calibrationCount)) dualCount += 1;
    figureCounts.set(
      result.ranking[0].id,
      (figureCounts.get(result.ranking[0].id) ?? 0) + 1,
    );
    const finalGap = result.ranking[1].distance - result.ranking[0].distance;
    for (const threshold of gapSensitivity.keys()) {
      if (calibrationCount === 3 && finalGap < threshold) {
        gapSensitivity.set(threshold, gapSensitivity.get(threshold) + 1);
      }
    }
  }

  return { figureCounts, calibrationCounts, dualCount, gapSensitivity };
}

const random = createRandom(SIMULATION_SEED);
const vectors = FIGURES.map(vectorOf);

console.log("=== 阶段 A 模拟验收报告 ===\n");

console.log(`人物候选数: ${FIGURES.length}`);
console.log(`穷举可达组合: ${EXACT_SAMPLES.toLocaleString("en-US")}`);
console.log(`正态模拟样本: ${NORMAL_SAMPLES.toLocaleString("en-US")}`);
console.log(`自适应流模拟样本: ${FLOW_SAMPLES.toLocaleString("en-US")}\n`);

const exact = exactReachability(vectors, SCORE_LEVELS);
const exactWinners = exact.winnerCounts;
const normalWinners = (() => {
  const r = createRandom(SIMULATION_SEED);
  const counts = Array(vectors.length).fill(0);
  for (let sample = 0; sample < NORMAL_SAMPLES; sample += 1) {
    const scoreVector = DIMENSION_IDS.map(() =>
      Math.min(90, Math.max(10, 50 + normalSample(r) * 17)),
    );
    counts[nearestTwo(scoreVector, vectors).firstIndex] += 1;
  }
  return counts;
})();

const unreachable = FIGURES.filter(
  (_, index) => exactWinners[index] === 0,
).map((figure) => figure.name);

const normalShares = FIGURES.map((figure, index) => ({
  name: figure.name,
  share: normalWinners[index] / NORMAL_SAMPLES,
})).sort((left, right) => right.share - left.share);
const topFigure = normalShares[0];
const rareFigures = FIGURES.filter(
  (_, index) => normalWinners[index] < 50,
).map((figure) => figure.name);

const pairs = closestPairs(vectors);
const closePairs = pairs
  .filter((pair) => pair.distance < THRESHOLDS.closePairDistance)
  .map((pair) => ({
    first: FIGURES[pair.first].name,
    second: FIGURES[pair.second].name,
    distance: pair.distance,
  }));

const flow = simulateFlow(random);
const dualRate = flow.dualCount / FLOW_SAMPLES;
const calibrationTriggerRate =
  (flow.calibrationCounts[1] +
    flow.calibrationCounts[2] +
    flow.calibrationCounts[3]) /
  FLOW_SAMPLES;

const calibrationGapSensitivity = THRESHOLDS.calibrationGapSensitivity.map(
  (threshold) => {
    const sensitivityRandom = createRandom(20260707 + Math.round(threshold * 10_000));
    const sensitivityFlow = simulateFlow(sensitivityRandom, threshold);
    const sensitivityDualRate = sensitivityFlow.dualCount / FLOW_SAMPLES;
    const sensitivityTriggerRate =
      (sensitivityFlow.calibrationCounts[1] +
        sensitivityFlow.calibrationCounts[2] +
        sensitivityFlow.calibrationCounts[3]) /
      FLOW_SAMPLES;
    return {
      threshold,
      calibrationTriggerRate: sensitivityTriggerRate,
      dualRate: sensitivityDualRate,
      inCalibrationBand:
        sensitivityTriggerRate >= THRESHOLDS.calibrationTriggerMin &&
        sensitivityTriggerRate <= THRESHOLDS.calibrationTriggerMax,
      inDualBand:
        sensitivityDualRate >= THRESHOLDS.dualRateMin &&
        sensitivityDualRate <= THRESHOLDS.dualRateMax,
    };
  },
);

console.log("=== 对照基线（docs/phase-a-baseline.md）===");
console.table([
  {
    指标: "Top1 集中度",
    基线: `${BASELINE.topFigureName} ${formatPercent(BASELINE.topFigureShare)}`,
    当前: `${topFigure.name} ${formatPercent(topFigure.share)}`,
    变化: `${((topFigure.share - BASELINE.topFigureShare) * 100).toFixed(2)}%`,
  },
  {
    指标: "双原型率",
    基线: formatPercent(BASELINE.dualRate),
    当前: formatPercent(dualRate),
    变化: `${((dualRate - BASELINE.dualRate) * 100).toFixed(2)}%`,
  },
  {
    指标: "辨析触发率",
    基线: formatPercent(BASELINE.calibrationTriggerRate),
    当前: formatPercent(calibrationTriggerRate),
    变化: `${((calibrationTriggerRate - BASELINE.calibrationTriggerRate) * 100).toFixed(2)}%`,
  },
  {
    指标: "人物数",
    基线: `${BASELINE.figureCount}`,
    当前: `${FIGURES.length}`,
    变化: `+${FIGURES.length - BASELINE.figureCount}`,
  },
  {
    指标: "辨析 gap 阈值",
    基线: `${BASELINE.calibrationGapThreshold}`,
    当前: `${THRESHOLDS.calibrationGapThreshold}`,
    变化: `${THRESHOLDS.calibrationGapThreshold - BASELINE.calibrationGapThreshold}`,
  },
]);

console.log("\n人物集中度（正态模拟 Top5）：");
console.table(normalShares.slice(0, 5));

console.log("\n最接近的人物向量对 Top5：");
console.table(
  pairs.slice(0, 5).map((pair) => ({
    first: FIGURES[pair.first].name,
    second: FIGURES[pair.second].name,
    distance: pair.distance.toFixed(4),
  })),
);

console.log("\n自适应流程：");
console.table({
  双原型率: formatPercent(dualRate),
  辨析触发率_需1到3题: formatPercent(calibrationTriggerRate),
  辨析题分布: {
    "0题": formatPercent(flow.calibrationCounts[0] / FLOW_SAMPLES),
    "1题": formatPercent(flow.calibrationCounts[1] / FLOW_SAMPLES),
    "2题": formatPercent(flow.calibrationCounts[2] / FLOW_SAMPLES),
    "3题": formatPercent(flow.calibrationCounts[3] / FLOW_SAMPLES),
  },
});

console.log("\n辨析 gap 阈值敏感性（needsCalibration 扫描）：");
console.table(
  calibrationGapSensitivity.map((row) => ({
    阈值: row.threshold,
    辨析触发率: formatPercent(row.calibrationTriggerRate),
    双原型率: formatPercent(row.dualRate),
    辨析达标: row.inCalibrationBand ? "✓" : "✗",
    双原型达标: row.inDualBand ? "✓" : "✗",
    当前: row.threshold === THRESHOLDS.calibrationGapThreshold ? "← 采用" : "",
  })),
);

const selectedCalibrationRow = calibrationGapSensitivity.find(
  (row) => row.threshold === THRESHOLDS.calibrationGapThreshold,
);
const bothBandsAtSelected =
  selectedCalibrationRow?.inCalibrationBand && selectedCalibrationRow?.inDualBand;

console.log(
  `\n阈值决策：辨析 gap 采用 ${THRESHOLDS.calibrationGapThreshold}（自 ${BASELINE.calibrationGapThreshold} 下调）。` +
    (bothBandsAtSelected
      ? `敏感性扫描显示该阈值为区间内唯一同时满足辨析 ${THRESHOLDS.calibrationTriggerMin * 100}%–${THRESHOLDS.calibrationTriggerMax * 100}% 与双原型 ${THRESHOLDS.dualRateMin * 100}%–${THRESHOLDS.dualRateMax * 100}% 的取值。`
      : `在可扫描区间内无法同时满足辨析与双原型区间；当前取值为工程折中，详见 docs/phase-a-task7-report.md。`),
);

console.log("\n双原型 gap 阈值敏感性（calibrationCount=3 且 finalGap < 阈值）：");
console.table(
  [...flow.gapSensitivity].map(([threshold, count]) => ({
    阈值: threshold,
    双原型率: formatPercent(count / FLOW_SAMPLES),
    当前: threshold === THRESHOLDS.dualGapThreshold ? "（仅参考，当前代码用 0.01）" : "",
  })),
);
console.log(
  `双原型判定采用 ${THRESHOLDS.dualGapThreshold}（calibrationCount=3 且 D2-D1 严格小于阈值）。` +
    "扫描 0.025–0.045 时双原型率均远超 25%，故维持 0.01 不变。",
);

const checks = [
  {
    name: "人物集中度（Top1 < 8%）",
    pass: topFigure.share < THRESHOLDS.topFigureShareMax,
    detail: `${topFigure.name} = ${formatPercent(topFigure.share)}`,
  },
  {
    name: `双原型率（${THRESHOLDS.dualRateMin * 100}%–${THRESHOLDS.dualRateMax * 100}%）`,
    pass:
      dualRate >= THRESHOLDS.dualRateMin && dualRate <= THRESHOLDS.dualRateMax,
    detail: formatPercent(dualRate),
  },
  {
    name: `辨析触发率（${THRESHOLDS.calibrationTriggerMin * 100}%–${THRESHOLDS.calibrationTriggerMax * 100}%）`,
    pass:
      calibrationTriggerRate >= THRESHOLDS.calibrationTriggerMin &&
      calibrationTriggerRate <= THRESHOLDS.calibrationTriggerMax,
    detail: formatPercent(calibrationTriggerRate),
    structural: true,
  },
  {
    name: "不可达人物 = 0",
    pass: unreachable.length <= THRESHOLDS.unreachableMax,
    detail:
      unreachable.length === 0
        ? "0"
        : `${unreachable.length}：${unreachable.join("、")}`,
  },
  {
    name: `极近人物对（< ${THRESHOLDS.closePairDistance}）= 0`,
    pass: closePairs.length <= THRESHOLDS.closePairsMax,
    detail:
      closePairs.length === 0
        ? "0"
        : `${closePairs.length}：${closePairs.map((pair) => `${pair.first}-${pair.second}`).join("、")}`,
  },
];

console.log("\n=== 验收门槛 ===");
const allPassed = printChecksReport(checks);

if (rareFigures.length > 0) {
  console.log(
    `\n提示：正态模拟中命中 < 50 次的人物 ${rareFigures.length} 位（非硬门槛）：${rareFigures.join("、")}`,
  );
}

if (!allPassed) {
  process.exitCode = 1;
}
