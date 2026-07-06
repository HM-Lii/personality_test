import assert from "node:assert/strict";
import test from "node:test";

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

function evaluate(answers) {
  const scores = calculateScores(answers);
  const consistency = calculateConsistency(answers, MIRROR_PAIRS);
  const ranking = rankFigures(scores, FIGURES, consistency);
  return { scores, consistency, ranking };
}

test("an all-low core path produces the minimum five scores", () => {
  const answers = CORE_QUESTIONS.map((question) => ({
    questionId: question.id,
    dimension: question.dimension,
    value: -3,
  }));
  assert.deepEqual(calculateScores(answers), {
    O: 10,
    C: 10,
    E: 10,
    A: 10,
    R: 10,
  });
});

test("an all-high core path produces the maximum five scores", () => {
  const answers = CORE_QUESTIONS.map((question) => ({
    questionId: question.id,
    dimension: question.dimension,
    value: 3,
  }));
  assert.deepEqual(calculateScores(answers), {
    O: 90,
    C: 90,
    E: 90,
    A: 90,
    R: 90,
  });
});

test("a complete adaptive run asks no more than three unique calibration questions", () => {
  const answers = CORE_QUESTIONS.map((question) => ({
    questionId: question.id,
    dimension: question.dimension,
    value: 1,
  }));
  const usedDimensions = [];
  const usedQuestionIds = [];
  let result = evaluate(answers);
  let calibrationCount = 0;

  assert.equal(needsCalibration(result.ranking, calibrationCount), true);

  while (needsCalibration(result.ranking, calibrationCount)) {
    const dimension = selectCalibrationDimension(
      result.ranking,
      usedDimensions,
    );
    const question = CALIBRATION_QUESTIONS.find(
      (item) =>
        item.dimension === dimension && !usedQuestionIds.includes(item.id),
    );
    assert.ok(question);

    answers.push({
      questionId: question.id,
      dimension: question.dimension,
      value: calibrationCount % 2 === 0 ? 1 : -1,
    });
    usedDimensions.push(dimension);
    usedQuestionIds.push(question.id);
    calibrationCount += 1;
    result = evaluate(answers);
  }

  assert.ok(calibrationCount <= 3);
  assert.equal(new Set(usedQuestionIds).size, usedQuestionIds.length);
  assert.equal(new Set(usedDimensions).size, usedDimensions.length);
  assert.equal(needsCalibration(result.ranking, calibrationCount), false);
  assert.ok(result.ranking.length === FIGURES.length);
});

test("a final result is either one clear archetype or an allowed dual archetype", () => {
  const answers = CORE_QUESTIONS.map((question) => ({
    questionId: question.id,
    dimension: question.dimension,
    value: 1,
  }));
  const result = evaluate(answers);
  const dual = isDualArchetype(result.ranking, 3);

  assert.equal(typeof result.ranking[0].name, "string");
  assert.equal(typeof dual, "boolean");
  assert.ok(result.ranking[0].distance <= result.ranking[1].distance);
});
