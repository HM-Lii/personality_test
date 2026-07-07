import { DIMENSIONS } from "../data/catalog.mjs";

export function buildShareText(result) {
  const figures = result.dual
    ? result.ranking.slice(0, 2)
    : result.ranking.slice(0, 1);
  return [
    `我的历史人格原型：${figures.map((figure) => figure.name).join(" × ")}`,
    ...DIMENSIONS.map(
      (dimension) => `${dimension.name} ${result.scores[dimension.id]}`,
    ),
    `匹配清晰度：${result.clarity.band}`,
    "人物志 · 分数来自25–28道情境选择，古人只是个性格上的比喻。",
  ].join("\n");
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
