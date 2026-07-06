import assert from "node:assert/strict";
import test from "node:test";

import { prepareAnswerUpdate } from "../src/core/session.mjs";
import { CORE_QUESTIONS } from "../src/data/questions.mjs";

const coreQuestionIds = CORE_QUESTIONS.map((question) => question.id);

test("answering the first core question keeps the remaining core queue", () => {
  const result = prepareAnswerUpdate({
    queue: coreQuestionIds,
    answers: [],
    index: 0,
    questionId: coreQuestionIds[0],
    coreQuestionIds,
  });

  assert.equal(result.queue.length, 25);
  assert.equal(result.queue[1], coreQuestionIds[1]);
});

test("answering a core question restores the canonical core queue", () => {
  const result = prepareAnswerUpdate({
    queue: coreQuestionIds.slice(0, 3),
    answers: [],
    index: 1,
    questionId: coreQuestionIds[1],
    coreQuestionIds,
  });
  assert.deepEqual(result.queue, coreQuestionIds);
});

test("changing a core answer keeps answers to all other core questions", () => {
  const result = prepareAnswerUpdate({
    queue: coreQuestionIds,
    answers: [
      { questionId: "O1", value: 1 },
      { questionId: "C1", value: 1 },
      { questionId: "E1", value: -1 },
    ],
    index: 1,
    questionId: "C1",
    coreQuestionIds,
  });

  assert.deepEqual(result.answers, [
    { questionId: "O1", value: 1 },
    { questionId: "E1", value: -1 },
  ]);
});

test("changing a core answer removes all adaptive calibration state", () => {
  const result = prepareAnswerUpdate({
    queue: [...coreQuestionIds, "OX1", "CX1"],
    answers: [
      { questionId: "O1", value: 1 },
      { questionId: "C1", value: 1 },
      { questionId: "OX1", value: 3 },
      { questionId: "CX1", value: -1 },
    ],
    index: 0,
    questionId: "O1",
    coreQuestionIds,
  });

  assert.deepEqual(result.queue, coreQuestionIds);
  assert.deepEqual(result.answers, [{ questionId: "C1", value: 1 }]);
});

test("changing a calibration answer preserves earlier calibration answers", () => {
  const result = prepareAnswerUpdate({
    queue: [...coreQuestionIds, "OX1", "CX1", "EX1"],
    answers: [
      { questionId: "O1", value: 1 },
      { questionId: "OX1", value: 3 },
      { questionId: "CX1", value: -1 },
      { questionId: "EX1", value: 1 },
    ],
    index: 26,
    questionId: "CX1",
    coreQuestionIds,
  });

  assert.equal(result.queue.at(-1), "CX1");
  assert.deepEqual(result.answers, [
    { questionId: "O1", value: 1 },
    { questionId: "OX1", value: 3 },
  ]);
});

test("prepareAnswerUpdate returns new arrays and does not mutate its inputs", () => {
  const queue = [...coreQuestionIds, "OX1"];
  const answers = [{ questionId: "O1", value: 1 }];
  const queueSnapshot = [...queue];
  const answersSnapshot = structuredClone(answers);

  const result = prepareAnswerUpdate({
    queue,
    answers,
    index: 0,
    questionId: "O1",
    coreQuestionIds,
  });

  assert.notEqual(result.queue, queue);
  assert.notEqual(result.answers, answers);
  assert.deepEqual(queue, queueSnapshot);
  assert.deepEqual(answers, answersSnapshot);
});
