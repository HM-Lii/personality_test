import assert from "node:assert/strict";
import test from "node:test";

import {
  DIMENSIONS,
  RESPONSE_VALUES,
  normalizedDistance,
  rankFigures,
} from "../src/core/scoring.mjs";
import { FIGURES } from "../src/data/figures.mjs";
import {
  CALIBRATION_QUESTIONS,
  CORE_QUESTIONS,
  MIRROR_PAIRS,
} from "../src/data/questions.mjs";

const dimensionIds = DIMENSIONS.map((dimension) => dimension.id);
const allQuestions = [...CORE_QUESTIONS, ...CALIBRATION_QUESTIONS];
const allConsistency = { O: 1, C: 1, E: 1, A: 1, R: 1 };

test("the core bank contains five questions for every dimension", () => {
  assert.equal(CORE_QUESTIONS.length, 25);
  for (const dimension of dimensionIds) {
    assert.equal(
      CORE_QUESTIONS.filter((question) => question.dimension === dimension).length,
      5,
    );
  }
});

test("every dimension covers all five scenario domains", () => {
  const expectedDomains = new Set([
    "工作与学习",
    "合作与关系",
    "冲突与压力",
    "新环境与不确定性",
    "个人恢复与长期选择",
  ]);
  for (const dimension of dimensionIds) {
    const domains = new Set(
      CORE_QUESTIONS.filter(
        (question) => question.dimension === dimension,
      ).map((question) => question.domain),
    );
    assert.deepEqual(domains, expectedDomains);
  }
});

test("the calibration bank contains at least three questions per dimension", () => {
  for (const dimension of dimensionIds) {
    assert.ok(
      CALIBRATION_QUESTIONS.filter(
        (question) => question.dimension === dimension,
      ).length >= 3,
    );
  }
});

test("question IDs are unique across both banks", () => {
  const ids = allQuestions.map((question) => question.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every question has the complete four-value response scale", () => {
  for (const question of allQuestions) {
    assert.equal(question.options.length, 4, question.id);
    assert.deepEqual(
      question.options.map((option) => option.value).sort((a, b) => a - b),
      RESPONSE_VALUES,
      question.id,
    );
    assert.equal(
      new Set(question.options.map((option) => option.id)).size,
      4,
      question.id,
    );
  }
});

test("all option text satisfies the readability budget", () => {
  const lengths = allQuestions.flatMap((question) =>
    question.options.map((option) => [...option.text].length),
  );
  const average = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;

  assert.ok(Math.max(...lengths) <= 20);
  assert.ok(average <= 17);
});

test("mirror pairs reference existing same-dimension core questions", () => {
  const coreMap = new Map(
    CORE_QUESTIONS.map((question) => [question.id, question]),
  );
  const used = [];

  for (const pair of MIRROR_PAIRS) {
    const first = coreMap.get(pair.first);
    const second = coreMap.get(pair.second);
    assert.ok(first, pair.first);
    assert.ok(second, pair.second);
    assert.equal(first.dimension, pair.dimension);
    assert.equal(second.dimension, pair.dimension);
    used.push(pair.first, pair.second);
  }

  assert.equal(new Set(used).size, used.length);
  for (const dimension of dimensionIds) {
    assert.equal(
      MIRROR_PAIRS.filter((pair) => pair.dimension === dimension).length,
      2,
    );
  }
});

test("the figure library has unique IDs, names and complete metadata", () => {
  assert.ok(FIGURES.length >= 40 && FIGURES.length <= 80);
  assert.equal(new Set(FIGURES.map((figure) => figure.id)).size, FIGURES.length);
  assert.equal(new Set(FIGURES.map((figure) => figure.name)).size, FIGURES.length);

  for (const figure of FIGURES) {
    assert.ok(figure.id.length > 0);
    assert.ok(figure.name.length > 0);
    assert.ok(figure.era.length > 0);
    assert.ok(figure.archetype.length > 0);
    assert.ok(figure.narrativeBasis.length > 0);
    assert.ok(
      figure.rationale.length >= 8,
      `${figure.id} missing vector rationale`,
    );
    assert.equal(figure.tags.length, 3);
    assert.deepEqual(Object.keys(figure.vector).sort(), [...dimensionIds].sort());
    for (const value of Object.values(figure.vector)) {
      assert.ok(Number.isFinite(value));
      assert.ok(value >= 10 && value <= 98);
    }
  }
});

test("every figure is its own nearest archetype at its prototype vector", () => {
  for (const figure of FIGURES) {
    assert.equal(rankFigures(figure.vector, FIGURES)[0].id, figure.id);
  }
});

test("no two figure prototypes are closer than the library quality threshold", () => {
  let minimum = Number.POSITIVE_INFINITY;
  for (let first = 0; first < FIGURES.length; first += 1) {
    for (let second = first + 1; second < FIGURES.length; second += 1) {
      minimum = Math.min(
        minimum,
        normalizedDistance(
          FIGURES[first].vector,
          FIGURES[second].vector,
          allConsistency,
        ),
      );
    }
  }
  assert.ok(minimum >= 0.065, `minimum prototype distance: ${minimum}`);
});
