import assert from "node:assert/strict";
import test from "node:test";

import { CORE_QUESTIONS, questionMap } from "../src/data/catalog.mjs";
import { decodeResultHash, encodeResultHash } from "../src/ui/share.mjs";

const sampleAnswers = CORE_QUESTIONS.map((question, index) => {
  const option = question.options[index % question.options.length];
  return { questionId: question.id, optionId: option.id, value: option.value };
});

test("encodeResultHash → decodeResultHash 还原出等价的答题状态", () => {
  const hash = encodeResultHash(sampleAnswers);
  assert.ok(hash.startsWith("#r="));

  const restored = decodeResultHash(hash, questionMap);
  assert.equal(restored.view, "result");
  assert.equal(restored.queue.length, sampleAnswers.length);
  assert.deepEqual(
    restored.answers.map(({ questionId, optionId }) => [questionId, optionId]),
    sampleAnswers.map(({ questionId, optionId }) => [questionId, optionId]),
  );
  /* value 必须按题库重新查出，而不是信任链接里的内容 */
  for (const answer of restored.answers) {
    const question = questionMap.get(answer.questionId);
    const option = question.options.find((item) => item.id === answer.optionId);
    assert.equal(answer.value, option.value);
  }
});

test("decodeResultHash 对非法输入返回 null", () => {
  assert.equal(decodeResultHash("", questionMap), null);
  assert.equal(decodeResultHash("#foo", questionMap), null);
  assert.equal(decodeResultHash("#r=not-base64!!!", questionMap), null);
  assert.equal(
    decodeResultHash(encodeResultHash([{ questionId: "O1", optionId: "Z" }]), questionMap),
    null,
  );
  assert.equal(
    decodeResultHash(encodeResultHash([{ questionId: "NOPE", optionId: "A" }]), questionMap),
    null,
  );
});
