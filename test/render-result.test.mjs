import assert from "node:assert/strict";
import test from "node:test";

import { buildTestResult } from "../src/core/result.mjs";
import {
  CORE_QUESTIONS,
  FIGURES,
  MIRROR_PAIRS,
  dimensionMap,
  questionMap,
} from "../src/data/catalog.mjs";
import { renderResult } from "../src/ui/render-result.mjs";
import { hashString } from "../src/ui/utils.mjs";

const answers = CORE_QUESTIONS.map((question) => {
  const option = question.options[0];
  return {
    questionId: question.id,
    optionId: option.id,
    value: option.value,
  };
});
const deps = {
  questionMap,
  dimensionMap,
  figures: FIGURES,
  mirrorPairs: MIRROR_PAIRS,
  hashString,
};

test("result page renders the matched figure's historical evidence chains", () => {
  const result = buildTestResult(answers, deps);
  const app = { innerHTML: "" };

  renderResult(
    app,
    {
      answers,
      completedAt: "2026-07-27T00:00:00.000Z",
    },
    result,
    deps,
  );

  const primary = result.ranking[0];
  const renderedChains = app.innerHTML.match(
    /class="history-evidence-item"/g,
  );

  assert.match(app.innerHTML, /历史依据与争议/);
  assert.match(app.innerHTML, /史料来源/);
  assert.match(app.innerHTML, /证据可信度/);
  assert.match(app.innerHTML, /可能争议/);
  assert.match(app.innerHTML, /target="_blank" rel="noopener noreferrer"/);
  assert.equal(renderedChains?.length, primary.evidenceChains.length);
});
