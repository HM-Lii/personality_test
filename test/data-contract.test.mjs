import assert from "node:assert/strict";
import test from "node:test";

import {
  DIMENSIONS,
  RESPONSE_VALUES,
  normalizedDistance,
  rankFigures,
  CORE_ITEMS_PER_DIMENSION,
  CORE_QUESTION_COUNT,
} from "../src/core/scoring.mjs";
import { DOMAINS } from "../src/data/dimensions.mjs";
import { FIGURES } from "../src/data/figures.mjs";
import {
  CALIBRATION_QUESTIONS,
  CORE_QUESTIONS,
  MIRROR_PAIRS,
} from "../src/data/questions.mjs";
/*
 * Thresholds shared with scripts/validate-questions.mjs and
 * scripts/validate-figures.mjs. Importing them (instead of hardcoding a
 * second copy of each number) keeps this file's assertions and the
 * validation scripts from silently drifting apart when a threshold changes.
 */
import {
  MIN_CALIBRATION_QUESTIONS_PER_DIMENSION,
  MIN_FIGURE_DISTANCE,
  OPTION_TEXT_AVG_MAX_LENGTH,
  OPTION_TEXT_MAX_LENGTH,
} from "../scripts/lib/thresholds.mjs";

const dimensionIds = DIMENSIONS.map((dimension) => dimension.id);
const allQuestions = [...CORE_QUESTIONS, ...CALIBRATION_QUESTIONS];
const allConsistency = { O: 1, C: 1, E: 1, A: 1, R: 1 };

test("the core bank contains five questions for every dimension", () => {
  assert.equal(CORE_QUESTIONS.length, CORE_QUESTION_COUNT);
  for (const dimension of dimensionIds) {
    assert.equal(
      CORE_QUESTIONS.filter((question) => question.dimension === dimension).length,
      CORE_ITEMS_PER_DIMENSION,
    );
  }
});

test("every dimension covers all five scenario domains", () => {
  const expectedDomains = new Set(DOMAINS);
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
  /*
   * This guards a real invariant: quiz-controller.mjs relies on every
   * dimension having enough unique calibration questions that
   * selectCalibrationDimension never has to repeat a dimension within the
   * 3-question budget (see MAX_CALIBRATION_ITEMS in src/core/scoring.mjs).
   * MIN_CALIBRATION_QUESTIONS_PER_DIMENSION is a distinct constant even
   * though both are currently 3 — see the note on that export.
   */
  for (const dimension of dimensionIds) {
    assert.ok(
      CALIBRATION_QUESTIONS.filter(
        (question) => question.dimension === dimension,
      ).length >= MIN_CALIBRATION_QUESTIONS_PER_DIMENSION,
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

  assert.ok(Math.max(...lengths) <= OPTION_TEXT_MAX_LENGTH);
  assert.ok(average <= OPTION_TEXT_AVG_MAX_LENGTH);
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
    assert.ok(
      figure.evidenceChains.length >= 2,
      `${figure.id} missing historical evidence chains`,
    );
    assert.ok(
      new Set(figure.evidenceChains.map((chain) => chain.dimension)).size >= 2,
      `${figure.id} evidence must cover distinct key dimensions`,
    );
    for (const chain of figure.evidenceChains) {
      assert.ok(dimensionIds.includes(chain.dimension));
      assert.ok(chain.event.length >= 10);
      assert.ok(chain.source.title.length >= 2);
      assert.match(chain.source.url, /^https:\/\//);
      assert.ok(chain.source.locator.length >= 3);
      assert.ok(chain.interpretation.length >= 10);
      assert.ok(["high", "medium", "low"].includes(chain.confidence.level));
      assert.ok(chain.confidence.reason.length >= 10);
      assert.ok(chain.controversy.length >= 10);
    }
    assert.ok(
      Array.isArray(figure.tags) &&
        figure.tags.length >= 2 &&
        figure.tags.length <= 3,
      `${figure.id} tags must be 2–3 archetype labels from figures-rationale.json`,
    );
    for (const tag of figure.tags) {
      assert.equal(typeof tag, "string");
      assert.ok(tag.length >= 2, `${figure.id} has empty tag`);
    }
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
  assert.ok(
    minimum >= MIN_FIGURE_DISTANCE,
    `minimum prototype distance: ${minimum}`,
  );
});
