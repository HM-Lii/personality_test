import {
  CALIBRATION_QUESTIONS,
  CORE_QUESTIONS,
  MIRROR_PAIRS,
} from "../src/data/questions.mjs";
import { RESPONSE_VALUES, CORE_ITEMS_PER_DIMENSION, CORE_QUESTION_COUNT } from "../src/core/scoring.mjs";
import { DIMENSION_IDS, DOMAINS } from "../src/data/dimensions.mjs";
import { OPTION_TEXT_MAX_LENGTH, OPTION_TEXT_AVG_MAX_LENGTH } from "./lib/thresholds.mjs";

const BANNED_WORDS = ["不负责", "冲动", "自私", "善良", "懒惰", "你总是", "你从不"];
const FORMAL_OPTION_WORDS = [
  "逐项",
  "据此",
  "迁移",
  "交付物",
  "不可替代",
  "收敛",
  "隐含",
  "采用",
  "预留",
];

const issues = [];
const allQuestions = [...CORE_QUESTIONS, ...CALIBRATION_QUESTIONS];
const ids = new Set();

for (const question of allQuestions) {
  if (ids.has(question.id)) issues.push(`题目 ID 重复：${question.id}`);
  ids.add(question.id);

  if (!DIMENSION_IDS.includes(question.dimension)) {
    issues.push(`${question.id} 使用未知维度：${question.dimension}`);
  }
  if (!DOMAINS.includes(question.domain)) {
    issues.push(`${question.id} 使用未知场景领域：${question.domain}`);
  }
  if (question.options.length !== 4) {
    issues.push(`${question.id} 不是四个选项`);
  }

  const values = question.options.map((item) => item.value).sort((a, b) => a - b);
  if (values.join(",") !== RESPONSE_VALUES.join(",")) {
    issues.push(`${question.id} 的分值不是 -3, -1, 1, 3`);
  }

  const optionIds = new Set(question.options.map((item) => item.id));
  if (optionIds.size !== question.options.length) {
    issues.push(`${question.id} 存在重复选项 ID`);
  }

  const fullText = `${question.title}${question.context}${question.options
    .map((item) => item.text)
    .join("")}`;
  for (const banned of BANNED_WORDS) {
    if (fullText.includes(banned)) issues.push(`${question.id} 包含价值诱导词：“${banned}”`);
  }

  for (const item of question.options) {
    const length = [...item.text].length;
    if (length > OPTION_TEXT_MAX_LENGTH) {
      issues.push(`${question.id} 选项超过${OPTION_TEXT_MAX_LENGTH}字（${length}字）：${item.text}`);
    }
    for (const formalWord of FORMAL_OPTION_WORDS) {
      if (item.text.includes(formalWord)) {
        issues.push(`${question.id} 选项包含书面词：“${formalWord}”`);
      }
    }
  }
}

if (CORE_QUESTIONS.length !== CORE_QUESTION_COUNT) {
  issues.push(`核心题应为${CORE_QUESTION_COUNT}道，实际为${CORE_QUESTIONS.length}道`);
}

for (const dimension of DIMENSION_IDS) {
  const core = CORE_QUESTIONS.filter((question) => question.dimension === dimension);
  const calibration = CALIBRATION_QUESTIONS.filter(
    (question) => question.dimension === dimension,
  );
  const domains = new Set(core.map((question) => question.domain));
  const mirrorPairs = MIRROR_PAIRS.filter((pair) => pair.dimension === dimension);
  const mixedOptionOrders = core.filter((question) => {
    const values = question.options.map((item) => item.value);
    const ascending = [...values].sort((a, b) => a - b);
    const descending = [...ascending].reverse();
    return (
      values.join(",") !== ascending.join(",") && values.join(",") !== descending.join(",")
    );
  });

  if (core.length !== CORE_ITEMS_PER_DIMENSION) issues.push(`${dimension} 核心题应为${CORE_ITEMS_PER_DIMENSION}道，实际为${core.length}道`);
  if (calibration.length < 3) {
    issues.push(`${dimension} 辨析题至少3道，实际为${calibration.length}道`);
  }
  if (domains.size !== 5) {
    issues.push(`${dimension} 核心题没有覆盖全部5类场景`);
  }
  if (mirrorPairs.length !== 2) {
    issues.push(`${dimension} 镜像题对应该为2组，实际为${mirrorPairs.length}组`);
  }
  if (mixedOptionOrders.length < 2) {
    issues.push(`${dimension} 至少需要2道混排选项，实际为${mixedOptionOrders.length}道`);
  }
}

for (const pair of MIRROR_PAIRS) {
  const first = CORE_QUESTIONS.find((question) => question.id === pair.first);
  const second = CORE_QUESTIONS.find((question) => question.id === pair.second);
  if (!first || !second) {
    issues.push(`镜像题不存在：${pair.first}/${pair.second}`);
  } else if (first.dimension !== pair.dimension || second.dimension !== pair.dimension) {
    issues.push(`镜像题维度错误：${pair.first}/${pair.second}`);
  }
}

const textFingerprints = new Set();
const optionLengths = [];
for (const question of allQuestions) {
  for (const item of question.options) {
    optionLengths.push([...item.text].length);
    const fingerprint = item.text.replace(/[，。；、\s]/g, "");
    if (textFingerprints.has(fingerprint)) {
      issues.push(`选项文案重复：${question.id} / ${item.text}`);
    }
    textFingerprints.add(fingerprint);
  }
}

const averageOptionLength =
  optionLengths.reduce((sum, length) => sum + length, 0) / optionLengths.length;
if (averageOptionLength > OPTION_TEXT_AVG_MAX_LENGTH) {
  issues.push(`选项平均长度应不超过${OPTION_TEXT_AVG_MAX_LENGTH}字，实际为${averageOptionLength.toFixed(1)}字`);
}

const summary = DIMENSION_IDS.map((dimension) => ({
  dimension,
  core: CORE_QUESTIONS.filter((question) => question.dimension === dimension).length,
  calibration: CALIBRATION_QUESTIONS.filter(
    (question) => question.dimension === dimension,
  ).length,
  domains: new Set(
    CORE_QUESTIONS.filter((question) => question.dimension === dimension).map(
      (question) => question.domain,
    ),
  ).size,
  mirrorPairs: MIRROR_PAIRS.filter((pair) => pair.dimension === dimension).length,
}));

console.log(`核心题：${CORE_QUESTIONS.length}`);
console.log(`辨析题：${CALIBRATION_QUESTIONS.length}`);
console.log(
  `选项文字：平均${averageOptionLength.toFixed(1)}字，最长${Math.max(...optionLengths)}字`,
);
console.table(summary);

if (issues.length) {
  console.error("\n题库校验失败：");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log("\n题库结构校验通过。");
}
