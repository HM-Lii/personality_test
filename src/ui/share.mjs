import { DIMENSIONS } from "../data/catalog.mjs";

export function buildShareText(result, shareUrl = "") {
  const figures = result.dual
    ? result.ranking.slice(0, 2)
    : result.ranking.slice(0, 1);
  const lines = [
    `我的历史人格原型：${figures.map((figure) => figure.name).join(" × ")}`,
    ...DIMENSIONS.map(
      (dimension) => `${dimension.name} ${result.scores[dimension.id]}`,
    ),
    `匹配清晰度：${result.clarity.band}`,
    "人物志 · 分数来自 25–28 道情境选择，古人只是大众文化中的性格隐喻。",
  ];
  if (shareUrl) {
    lines.push(`查看我的完整结果：${shareUrl}`);
  }
  return lines.join("\n");
}

/* ---------- 结果链接：把答案编码进 URL hash，打开即可复现同一份结果 ---------- */

function toBase64Url(text) {
  return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(encoded) {
  const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(base64 + padding);
}

export function encodeResultHash(answers) {
  const pairs = answers.map((answer) => [answer.questionId, answer.optionId]);
  return `#r=${toBase64Url(JSON.stringify(pairs))}`;
}

export function buildResultUrl(answers, baseUrl = location.href.split("#")[0]) {
  return `${baseUrl}${encodeResultHash(answers)}`;
}

/* 从 hash 还原出一份完整状态；数据不合法时返回 null */
export function decodeResultHash(hash, questionMap) {
  if (typeof hash !== "string" || !hash.startsWith("#r=")) return null;
  try {
    const pairs = JSON.parse(fromBase64Url(hash.slice(3)));
    if (!Array.isArray(pairs) || pairs.length === 0) return null;

    const queue = [];
    const answers = [];
    for (const pair of pairs) {
      if (!Array.isArray(pair)) return null;
      const [questionId, optionId] = pair;
      const question = questionMap.get(questionId);
      const option = question?.options.find((item) => item.id === optionId);
      if (!question || !option) return null;
      queue.push(questionId);
      answers.push({ questionId, optionId, value: option.value });
    }

    return {
      view: "result",
      queue,
      index: queue.length - 1,
      answers,
      completedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function copyShareText(text, { showToast }) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("结果已复制");
      return;
    } catch {
      // fall through to legacy copy
    }
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
  showToast("结果已复制");
}
