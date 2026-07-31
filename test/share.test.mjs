import assert from "node:assert/strict";
import test from "node:test";

import {
  CALIBRATION_QUESTIONS,
  CORE_QUESTIONS,
  DIMENSIONS,
  questionMap,
} from "../src/data/catalog.mjs";
import {
  buildResultUrl,
  buildShareText,
  copyShareText,
  decodeResultHash,
  encodeResultHash,
} from "../src/ui/share.mjs";

const sampleAnswers = CORE_QUESTIONS.map((question, index) => {
  const option = question.options[index % question.options.length];
  return { questionId: question.id, optionId: option.id, value: option.value };
});

/**
 * Node exposes a built-in `navigator` global as a getter-only accessor
 * property, so a plain `globalThis.navigator = ...` assignment throws.
 * Redefining the whole property (and restoring the original descriptor
 * afterward) works around that for tests that need to stub it.
 */
async function withStubbedNavigator(value, run) {
  const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true,
    writable: true,
  });
  try {
    await run();
  } finally {
    if (previousDescriptor) {
      Object.defineProperty(globalThis, "navigator", previousDescriptor);
    } else {
      delete globalThis.navigator;
    }
  }
}

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

test("decodeResultHash 接受完整核心题和最多 3 道合法辨析题", () => {
  const calibrationAnswers = CALIBRATION_QUESTIONS.slice(0, 3).map(
    (question) => ({
      questionId: question.id,
      optionId: question.options[0].id,
      value: question.options[0].value,
    }),
  );

  const restored = decodeResultHash(
    encodeResultHash([...sampleAnswers, ...calibrationAnswers]),
    questionMap,
  );

  assert.equal(restored.answers.length, 28);
});

test("decodeResultHash 拒绝缺少核心题、重复题和超过 3 道辨析题", () => {
  const missingCore = sampleAnswers.slice(0, -1);
  assert.equal(
    decodeResultHash(encodeResultHash(missingCore), questionMap),
    null,
  );

  const duplicateCore = [...sampleAnswers.slice(0, -1), sampleAnswers[0]];
  assert.equal(
    decodeResultHash(encodeResultHash(duplicateCore), questionMap),
    null,
  );

  const fourCalibrationAnswers = CALIBRATION_QUESTIONS.slice(0, 4).map(
    (question) => ({
      questionId: question.id,
      optionId: question.options[0].id,
      value: question.options[0].value,
    }),
  );
  assert.equal(
    decodeResultHash(
      encodeResultHash([...sampleAnswers, ...fourCalibrationAnswers]),
      questionMap,
    ),
    null,
  );

  const duplicatedCalibration = {
    questionId: CALIBRATION_QUESTIONS[0].id,
    optionId: CALIBRATION_QUESTIONS[0].options[0].id,
  };
  assert.equal(
    decodeResultHash(
      encodeResultHash([
        ...sampleAnswers,
        duplicatedCalibration,
        duplicatedCalibration,
      ]),
      questionMap,
    ),
    null,
  );
});

/* ---------- buildShareText ---------- */

test("buildShareText lists the primary archetype, all five scores, and the clarity band", () => {
  const result = {
    dual: false,
    ranking: [{ name: "刘伶" }, { name: "嵇康" }],
    scores: { O: 46, C: 37, E: 37, A: 46, R: 54 },
    clarity: { score: 47, band: "情境型/混合轮廓" },
  };

  const lines = buildShareText(result).split("\n");

  assert.equal(lines[0], "我的历史人格原型：刘伶");
  for (const dimension of DIMENSIONS) {
    assert.ok(
      lines.includes(`${dimension.name} ${result.scores[dimension.id]}`),
      `missing score line for ${dimension.name}`,
    );
  }
  assert.ok(lines.includes("匹配清晰度：情境型/混合轮廓"));
  assert.ok(lines.some((line) => line.includes("历史人格原型是大众文化中的性格隐喻")));
  assert.ok(
    !lines.some((line) => line.startsWith("查看我的完整结果：")),
    "no share link should appear when none is given",
  );
});

test("buildShareText joins both names for a dual result and appends the share link when given one", () => {
  const result = {
    dual: true,
    ranking: [{ name: "嵇康" }, { name: "刘伶" }, { name: "third" }],
    scores: { O: 46, C: 37, E: 37, A: 46, R: 54 },
    clarity: { score: 17, band: "情境型/混合轮廓" },
  };

  const text = buildShareText(result, "https://example.test/#r=abc");
  const lines = text.split("\n");

  assert.equal(lines[0], "我的历史人格原型：嵇康 × 刘伶");
  assert.equal(lines.at(-1), "查看我的完整结果：https://example.test/#r=abc");
});

/* ---------- buildResultUrl ---------- */

test("buildResultUrl appends the encoded answer hash to the given base URL", () => {
  const url = buildResultUrl(sampleAnswers, "https://example.test/app");

  assert.equal(url, `https://example.test/app${encodeResultHash(sampleAnswers)}`);
  assert.ok(url.includes("#r="));
});

/* ---------- copyShareText ---------- */

test("copyShareText writes to the clipboard and skips the DOM fallback when the API is available", async () => {
  const writeCalls = [];
  const toasts = [];

  await withStubbedNavigator(
    {
      clipboard: {
        async writeText(text) {
          writeCalls.push(text);
        },
      },
    },
    () => copyShareText("hello", { showToast: (message) => toasts.push(message) }),
  );

  assert.deepEqual(writeCalls, ["hello"]);
  assert.deepEqual(toasts, ["结果已复制"]);
});

function fakeDocument({ execCommandResult = true } = {}) {
  const created = [];
  const appended = [];
  const execCommandCalls = [];
  return {
    document: {
      createElement(tag) {
        assert.equal(tag, "textarea");
        const element = {
          style: {},
          selected: false,
          removed: false,
          select() {
            element.selected = true;
          },
          remove() {
            element.removed = true;
          },
        };
        created.push(element);
        return element;
      },
      body: {
        append(element) {
          appended.push(element);
        },
      },
      execCommand(command) {
        execCommandCalls.push(command);
        return execCommandResult;
      },
    },
    created,
    appended,
    execCommandCalls,
  };
}

test("copyShareText falls back to a hidden textarea when the clipboard API is unavailable", async () => {
  const previousDocument = globalThis.document;
  const { document, created, appended, execCommandCalls } = fakeDocument();
  globalThis.document = document;
  const toasts = [];

  try {
    await withStubbedNavigator({}, () =>
      copyShareText("fallback text", { showToast: (message) => toasts.push(message) }),
    );
  } finally {
    globalThis.document = previousDocument;
  }

  assert.equal(created.length, 1);
  assert.equal(created[0].value, "fallback text");
  assert.equal(created[0].style.position, "fixed");
  assert.equal(created[0].style.opacity, "0");
  assert.equal(created[0].selected, true);
  assert.equal(created[0].removed, true);
  assert.deepEqual(appended, created);
  assert.deepEqual(execCommandCalls, ["copy"]);
  assert.deepEqual(toasts, ["结果已复制"]);
});

test("copyShareText falls back to the textarea when clipboard.writeText rejects", async () => {
  const previousDocument = globalThis.document;
  const { document, execCommandCalls } = fakeDocument();
  globalThis.document = document;
  const toasts = [];

  try {
    await withStubbedNavigator(
      {
        clipboard: {
          async writeText() {
            throw new Error("denied");
          },
        },
      },
      () => copyShareText("retry text", { showToast: (message) => toasts.push(message) }),
    );
  } finally {
    globalThis.document = previousDocument;
  }

  assert.deepEqual(execCommandCalls, ["copy"]);
  assert.deepEqual(toasts, ["结果已复制"]);
});
