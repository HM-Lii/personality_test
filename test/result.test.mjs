import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReportId,
  buildTestResult,
  compareTopCandidates,
  contrastDimensions,
  evidenceItems,
  scoreBand,
  toAnswerRecords,
} from "../src/core/result.mjs";
import { DIMENSIONS } from "../src/core/scoring.mjs";

const dimensionMap = new Map(
  DIMENSIONS.map((dimension) => [dimension.id, dimension]),
);
const consistency = { O: 1, C: 1, E: 1, A: 1, R: 1 };
const primary = {
  id: "primary",
  name: "甲",
  distance: 0.1,
  vector: { O: 70, C: 60, E: 50, A: 50, R: 50 },
};
const secondary = {
  id: "secondary",
  name: "乙",
  distance: 0.2,
  vector: { O: 40, C: 50, E: 50, A: 50, R: 50 },
};

function comparisonResult(overrides = {}) {
  return {
    scores: { O: 70, C: 50, E: 50, A: 50, R: 50 },
    consistency,
    ranking: [primary, secondary],
    records: [],
    ...overrides,
  };
}

test("candidate comparison identifies the dimensions that overcome second place", () => {
  const comparison = compareTopCandidates(comparisonResult());

  assert.equal(comparison.primary.name, "甲");
  assert.equal(comparison.secondary.name, "乙");
  assert.deepEqual(
    comparison.decidingDimensions.map((dimension) => dimension.id),
    ["O"],
  );
  assert.equal(comparison.dimensions.find((item) => item.id === "O").advantage, 900);
  assert.equal(comparison.dimensions.find((item) => item.id === "C").advantage, -100);
  assert.equal(comparison.positiveAdvantage, 900);
  assert.equal(comparison.opposingAdvantage, 100);
  assert.equal(comparison.netAdvantage, 800);
});

test("candidate comparison returns null without two ranked candidates", () => {
  assert.equal(
    compareTopCandidates({
      scores: comparisonResult().scores,
      consistency,
      ranking: [primary],
    }),
    null,
  );
  assert.equal(
    compareTopCandidates({
      scores: comparisonResult().scores,
      consistency,
      ranking: [],
    }),
    null,
  );
});

test("candidate comparison finds the minimum set that offsets opposing dimensions", () => {
  const tiedPrimary = {
    ...primary,
    vector: { O: 50, C: 50, E: 70, A: 70, R: 50 },
  };
  const tiedSecondary = {
    ...secondary,
    vector: { O: 70, C: 70, E: 50, A: 50, R: 60 },
  };
  const comparison = compareTopCandidates({
    scores: { O: 50, C: 50, E: 50, A: 50, R: 50 },
    consistency,
    ranking: [tiedPrimary, tiedSecondary],
  });

  assert.deepEqual(
    comparison.primaryAdvantages.map((item) => item.id),
    ["O", "C", "R"],
  );
  assert.deepEqual(
    comparison.secondaryAdvantages.map((item) => item.id),
    ["E", "A"],
  );
  assert.deepEqual(
    comparison.decidingDimensions.map((item) => item.id),
    ["O", "C", "R"],
  );
});

test("result assembly enriches answers and derives ranking metadata", () => {
  const questionMap = new Map([
    ["OX1", { id: "OX1", dimension: "O" }],
  ]);
  const figures = [
    {
      id: "near",
      vector: { O: 90, C: 50, E: 50, A: 50, R: 50 },
    },
    {
      id: "far",
      vector: { O: 10, C: 50, E: 50, A: 50, R: 50 },
    },
  ];
  questionMap.set("O1", { id: "O1", dimension: "O" });
  const answers = [
    { questionId: "OX1", optionId: "D", value: 3 },
    { questionId: "O1", optionId: "D", value: 3 },
  ];
  const result = buildTestResult(answers, {
    questionMap,
    figures,
    mirrorPairs: [],
  });

  assert.equal(result.records[0].dimension, "O");
  assert.equal(result.scores.O, 90);
  assert.equal(result.ranking[0].id, "near");
  assert.equal(result.calibrationCount, 1);
  assert.equal(typeof result.clarity.score, "number");
  assert.equal(result.dual, false);
  assert.equal(
    toAnswerRecords([{ questionId: "missing", value: 1 }], questionMap)[0]
      .dimension,
    undefined,
  );
});

test("score bands cover high, middle and low results", () => {
  assert.equal(scoreBand(65), "high");
  assert.equal(scoreBand(35), "low");
  assert.equal(scoreBand(50), "middle");
});

test("candidate comparison uses documented defaults for missing scores and consistency", () => {
  const comparison = compareTopCandidates({
    scores: {},
    consistency: {},
    ranking: [primary, secondary],
  });
  const openness = comparison.dimensions.find((item) => item.id === "O");

  assert.equal(openness.score, 50);
  assert.ok(Math.abs(openness.weight - 0.95) < 1e-12);
});

test("answer evidence comes from choices that support winning dimensions", () => {
  const questions = [
    ["O1", "尝试新路线", 3],
    ["OX1", "接受陌生方案", 3],
    ["O2", "保留探索空间", 3],
    ["O3", "坚持熟悉办法", -1],
    ["O4", "沿用既有经验", -1],
    ["E1", "主动认识所有人", 3],
  ];
  const questionMap = new Map(
    questions.map(([id, title, value]) => [
      id,
      {
        id,
        title,
        options: [{ id: "picked", text: `${title}的选择`, value }],
      },
    ]),
  );
  const records = questions.map(([questionId, , value]) => ({
    questionId,
    optionId: "picked",
    dimension: questionId.startsWith("O") ? "O" : "E",
    value,
  }));
  const result = comparisonResult({
    records,
    scores: { O: 69, C: 50, E: 50, A: 50, R: 50 },
  });
  const evidence = evidenceItems(result, questionMap, dimensionMap);

  assert.equal(evidence.length, 3);
  assert.equal(evidence[0].questionId, "OX1");
  assert.ok(evidence.every((item) => item.dimension.id === "O"));
  assert.ok(evidence.every((item) => item.answerAdvantage > 0));
  assert.ok(evidence.every((item) => item.tendency.includes("偏向")));
  assert.ok(evidence.every((item) => item.supportReason.includes("扩大了甲相对乙")));
  assert.ok(!evidence.some((item) => item.questionId === "O3"));
  assert.ok(!evidence.some((item) => item.questionId === "E1"));
});

test("answer evidence ignores records without complete question metadata", () => {
  const result = comparisonResult({
    records: [
      {
        questionId: "missing",
        optionId: "missing",
        dimension: "O",
        value: 3,
      },
    ],
  });

  assert.deepEqual(evidenceItems(result, new Map(), dimensionMap), []);

  const questionWithoutOption = new Map([
    [
      "missing-option",
      { id: "missing-option", title: "缺少选项", options: [] },
    ],
  ]);
  assert.deepEqual(
    evidenceItems(
      comparisonResult({
        records: [
          {
            questionId: "missing-option",
            optionId: "missing",
            dimension: "O",
            value: 3,
          },
        ],
      }),
      questionWithoutOption,
      dimensionMap,
    ),
    [],
  );

  const completeQuestion = new Map([
    [
      "complete",
      {
        id: "complete",
        title: "完整题目",
        options: [{ id: "picked", text: "完整选项", value: 3 }],
      },
    ],
  ]);
  assert.deepEqual(
    evidenceItems(
      comparisonResult({
        records: [
          {
            questionId: "complete",
            optionId: "picked",
            dimension: "unknown",
            value: 3,
          },
        ],
      }),
      completeQuestion,
      dimensionMap,
    ),
    [],
  );
  assert.deepEqual(
    evidenceItems(
      comparisonResult({
        records: [
          {
            questionId: "complete",
            optionId: "picked",
            dimension: "O",
            value: 3,
          },
        ],
      }),
      completeQuestion,
      new Map(),
    ),
    [],
  );
});

test("answer evidence explains low-end and moderate tendencies", () => {
  const lowPrimary = {
    ...primary,
    vector: { ...primary.vector, O: 30 },
  };
  const highSecondary = {
    ...secondary,
    vector: { ...secondary.vector, O: 70 },
  };
  const values = [-1, 1, 3, -3, -3];
  const questionMap = new Map(
    values.map((value, index) => [
      `L${index}`,
      {
        id: `L${index}`,
        title: `低分方向题${index}`,
        options: [{ id: "picked", text: "保留熟悉做法", value }],
      },
    ]),
  );
  const records = values.map((value, index) => ({
    questionId: `L${index}`,
    optionId: "picked",
    dimension: "O",
    value,
  }));
  const result = comparisonResult({
    scores: { O: 42, C: 50, E: 50, A: 50, R: 50 },
    ranking: [lowPrimary, highSecondary],
    records,
  });
  const evidence = evidenceItems(result, questionMap, dimensionMap);

  assert.ok(evidence.some((item) => item.value === -1));
  assert.ok(evidence.some((item) => item.tendency.startsWith("略微")));
  assert.ok(evidence.some((item) => item.tendency.includes("熟悉方法")));
});

test("answer evidence is empty when candidate comparison is unavailable", () => {
  assert.deepEqual(
    evidenceItems(
      { records: [], ranking: [primary], scores: {}, consistency: {} },
      new Map(),
      dimensionMap,
    ),
    [],
  );
});

test("answer evidence first covers three different winning dimensions", () => {
  const threeDimensionPrimary = {
    ...primary,
    vector: { O: 90, C: 90, E: 90, A: 50, R: 50 },
  };
  const threeDimensionSecondary = {
    ...secondary,
    vector: { O: 10, C: 10, E: 10, A: 50, R: 50 },
  };
  const records = ["O", "C", "E"].map((dimension) => ({
    questionId: `${dimension}1`,
    optionId: "picked",
    dimension,
    value: 3,
  }));
  const questionMap = new Map(
    records.map((record) => [
      record.questionId,
      {
        id: record.questionId,
        title: `${record.dimension}维题目`,
        options: [{ id: "picked", text: "高分选择", value: 3 }],
      },
    ]),
  );
  const result = comparisonResult({
    scores: { O: 90, C: 90, E: 90, A: 50, R: 50 },
    ranking: [threeDimensionPrimary, threeDimensionSecondary],
    records,
  });

  assert.deepEqual(
    evidenceItems(result, questionMap, dimensionMap).map(
      (item) => item.dimension.id,
    ),
    ["O", "C", "E"],
  );
});

test("contrast dimensions return the one or two largest profile gaps", () => {
  const result = comparisonResult({
    scores: { O: 70, C: 50, E: 80, A: 50, R: 50 },
  });
  const contrasts = contrastDimensions(result, primary);

  assert.deepEqual(
    contrasts.map((dimension) => [dimension.id, dimension.gap]),
    [
      ["E", 30],
      ["C", 10],
    ],
  );
  assert.equal(contrasts[0].score, 80);
  assert.equal(contrasts[0].target, 50);
});

test("contrast dimensions handle exact matches and missing figures", () => {
  const exact = comparisonResult({
    scores: { ...primary.vector },
  });

  assert.deepEqual(contrastDimensions(exact, primary), []);
  assert.deepEqual(contrastDimensions({ scores: {}, ranking: [] }), []);
  assert.deepEqual(contrastDimensions({ scores: {}, ranking: [primary] }, primary, -1), []);
});

test("contrast dimensions keep catalog order when gaps tie", () => {
  const contrasts = contrastDimensions(
    {
      scores: { O: 70, C: 50, E: 60, A: 50, R: 50 },
      ranking: [primary],
    },
    primary,
  );

  assert.deepEqual(
    contrasts.map((item) => item.id),
    ["C", "E"],
  );
});

test("report IDs are stable with dated and local reports", () => {
  const answers = [{ optionId: "A" }, { optionId: "D" }];
  const hashString = () => 0xabcde;

  assert.equal(
    buildReportId("2026-07-27T12:00:00.000Z", answers, hashString),
    "FA-20260727-ABCD",
  );
  assert.equal(buildReportId(null, answers, hashString), "FA-LOCAL-ABCD");
});
