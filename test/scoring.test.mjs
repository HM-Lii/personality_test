import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateClarity,
  calculateConsistency,
  calculateScores,
  isDualArchetype,
  needsCalibration,
  normalizedDistance,
  rankFigures,
  scoreDimension,
  selectCalibrationDimension,
} from "../src/core/scoring.mjs";
import { FIGURES } from "../src/data/figures.mjs";
import {
  CORE_QUESTIONS,
  MIRROR_PAIRS,
} from "../src/data/questions.mjs";

const allConsistency = (value) => ({
  O: value,
  C: value,
  E: value,
  A: value,
  R: value,
});

test("scoreDimension maps minimum, center and maximum responses", () => {
  assert.equal(scoreDimension([-3, -3, -3, -3, -3]), 10);
  assert.equal(scoreDimension([-3, 3]), 50);
  assert.equal(scoreDimension([3, 3, 3, 3, 3]), 90);
});

test("scoreDimension rounds to the nearest tendency score", () => {
  assert.equal(scoreDimension([-3, -1, 1, 1, 3]), 53);
  assert.equal(scoreDimension([-3, -1, -1, 1, 3]), 47);
});

test("scoreDimension returns a neutral score when no answer exists", () => {
  assert.equal(scoreDimension([]), 50);
});

test("calculateScores keeps unanswered dimensions neutral", () => {
  assert.deepEqual(
    calculateScores([{ questionId: "O1", dimension: "O", value: 3 }]),
    { O: 90, C: 50, E: 50, A: 50, R: 50 },
  );
});

test("changing one answer only changes its assigned dimension", () => {
  const baseline = CORE_QUESTIONS.map((question) => ({
    questionId: question.id,
    dimension: question.dimension,
    value: -1,
  }));
  const changed = baseline.map((answer) =>
    answer.questionId === "O1" ? { ...answer, value: 3 } : answer,
  );
  const before = calculateScores(baseline);
  const after = calculateScores(changed);

  assert.ok(after.O > before.O);
  for (const dimension of ["C", "E", "A", "R"]) {
    assert.equal(after[dimension], before[dimension]);
  }
});

test("unknown dimensions do not affect the five published scores", () => {
  const result = calculateScores([
    { questionId: "unknown", dimension: "X", value: 3 },
  ]);
  assert.deepEqual(result, { O: 50, C: 50, E: 50, A: 50, R: 50 });
});

test("matching mirror answers produce full contextual consistency", () => {
  const answers = [
    { questionId: "O1", dimension: "O", value: 3 },
    { questionId: "O4", dimension: "O", value: 3 },
    { questionId: "O2", dimension: "O", value: -1 },
    { questionId: "O5", dimension: "O", value: -1 },
  ];
  assert.equal(calculateConsistency(answers, MIRROR_PAIRS).O, 1);
});

test("maximally conflicting mirror answers produce zero consistency", () => {
  const answers = [
    { questionId: "O1", dimension: "O", value: 3 },
    { questionId: "O4", dimension: "O", value: -3 },
    { questionId: "O2", dimension: "O", value: -3 },
    { questionId: "O5", dimension: "O", value: 3 },
  ];
  assert.equal(calculateConsistency(answers, MIRROR_PAIRS).O, 0);
});

test("a partially answered mirror pair uses the available pair only", () => {
  const answers = [
    { questionId: "O1", dimension: "O", value: 3 },
    { questionId: "O4", dimension: "O", value: 1 },
  ];
  assert.ok(
    Math.abs(calculateConsistency(answers, MIRROR_PAIRS).O - 2 / 3) < 1e-12,
  );
});

test("dimensions without complete mirror pairs use the documented fallback", () => {
  assert.deepEqual(calculateConsistency([], MIRROR_PAIRS), allConsistency(0.75));
});

test("distance is zero for identical vectors", () => {
  const vector = { O: 70, C: 40, E: 60, A: 80, R: 30 };
  assert.equal(normalizedDistance(vector, vector), 0);
});

test("distance is one across the complete published score range", () => {
  const low = { O: 10, C: 10, E: 10, A: 10, R: 10 };
  const high = { O: 90, C: 90, E: 90, A: 90, R: 90 };
  assert.equal(normalizedDistance(low, high, allConsistency(1)), 1);
});

test("an inconsistent dimension receives slightly less matching weight", () => {
  const scores = { O: 90, C: 50, E: 50, A: 50, R: 50 };
  const figure = { O: 10, C: 50, E: 50, A: 50, R: 50 };
  const stable = normalizedDistance(scores, figure, allConsistency(1));
  const contextual = normalizedDistance(scores, figure, {
    ...allConsistency(1),
    O: 0,
  });
  assert.ok(contextual < stable);
});

test("rankFigures returns a deterministic ascending ranking", () => {
  const scores = { O: 84, C: 94, E: 40, A: 72, R: 78 };
  const firstRun = rankFigures(scores, FIGURES);
  const secondRun = rankFigures(scores, FIGURES);

  assert.equal(firstRun[0].name, "诸葛亮");
  assert.deepEqual(
    firstRun.map((figure) => figure.id),
    secondRun.map((figure) => figure.id),
  );
  for (let index = 1; index < firstRun.length; index += 1) {
    assert.ok(firstRun[index - 1].distance <= firstRun[index].distance);
  }
});

test("rankFigures does not mutate the source figure data", () => {
  const before = JSON.stringify(FIGURES);
  rankFigures({ O: 50, C: 50, E: 50, A: 50, R: 50 }, FIGURES);
  assert.equal(JSON.stringify(FIGURES), before);
});

test("similarity is always clamped to the display range", () => {
  const result = rankFigures(
    { O: 10, C: 10, E: 10, A: 10, R: 10 },
    [
      {
        id: "far",
        vector: { O: 98, C: 98, E: 98, A: 98, R: 98 },
      },
    ],
  );
  assert.equal(result[0].similarity, 0);
});

test("rankFigures keeps input order for exact ties", () => {
  const figures = [
    { id: "first", vector: { O: 50, C: 50, E: 50, A: 50, R: 50 } },
    { id: "second", vector: { O: 50, C: 50, E: 50, A: 50, R: 50 } },
  ];
  const ranking = rankFigures(
    { O: 50, C: 50, E: 50, A: 50, R: 50 },
    figures,
  );
  assert.deepEqual(
    ranking.map((figure) => figure.id),
    ["first", "second"],
  );
});

test("calibration starts only below the strict distance-gap threshold", () => {
  assert.equal(
    needsCalibration([{ distance: 0.1 }, { distance: 0.134999 }], 0),
    true,
  );
  assert.equal(
    needsCalibration([{ distance: 0.1 }, { distance: 0.135 }], 0),
    false,
  );
});

test("calibration stops after three questions or with fewer than two candidates", () => {
  const closeRanking = [{ distance: 0.1 }, { distance: 0.11 }];
  assert.equal(needsCalibration(closeRanking, 3), false);
  assert.equal(needsCalibration([], 0), false);
  assert.equal(needsCalibration([{ distance: 0.1 }], 0), false);
});

test("dual archetype requires three calibrations and a strict final tie", () => {
  const tied = [{ distance: 0.1 }, { distance: 0.109999 }];
  const boundary = [{ distance: 0.1 }, { distance: 0.11 }];
  assert.equal(isDualArchetype(tied, 2), false);
  assert.equal(isDualArchetype(tied, 3), true);
  assert.equal(isDualArchetype(boundary, 3), false);
});

test("calibration targets the largest unused candidate difference", () => {
  const ranking = [
    { vector: { O: 80, C: 80, E: 30, A: 70, R: 70 } },
    { vector: { O: 78, C: 40, E: 70, A: 68, R: 68 } },
  ];

  assert.equal(selectCalibrationDimension(ranking), "C");
  assert.equal(selectCalibrationDimension(ranking, ["C"]), "E");
});

test("calibration returns null when candidate comparison is impossible", () => {
  assert.equal(selectCalibrationDimension([]), null);
  assert.equal(
    selectCalibrationDimension([
      { vector: { O: 50, C: 50, E: 50, A: 50, R: 50 } },
    ]),
    null,
  );
});

test("calibration falls back to the largest difference after all dimensions were used", () => {
  const ranking = [
    { vector: { O: 80, C: 60, E: 50, A: 50, R: 50 } },
    { vector: { O: 20, C: 40, E: 50, A: 50, R: 50 } },
  ];
  assert.equal(
    selectCalibrationDimension(ranking, ["O", "C", "E", "A", "R"]),
    "O",
  );
});

test("clarity reports clear, neighboring and mixed bands at their boundaries", () => {
  const clear = calculateClarity(
    [{ distance: 0.1 }, { distance: 0.2 }],
    allConsistency(1),
  );
  const neighboring = calculateClarity(
    [{ distance: 0.1 }, { distance: 0.15 }],
    allConsistency(0.5),
  );
  const mixed = calculateClarity(
    [{ distance: 0.1 }, { distance: 0.1 }],
    allConsistency(0),
  );

  assert.deepEqual(clear, { score: 100, band: "轮廓较清晰" });
  assert.deepEqual(neighboring, { score: 50, band: "存在邻近原型" });
  assert.deepEqual(mixed, { score: 0, band: "情境型/混合轮廓" });
});

test("clarity handles an incomplete ranking", () => {
  assert.deepEqual(calculateClarity([], allConsistency(1)), {
    score: 0,
    band: "情境型/混合轮廓",
  });
});
