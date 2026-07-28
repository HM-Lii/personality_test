export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// 中文可在任意字间断行，标题直接折行会把词劈开（如“无法”拆到两行）。
// 用 Intl.Segmenter 切词，每个词包一层 inline-block，断行只发生在词边界；
// 标点并入前一个词，避免标点落到行首。不支持 Segmenter 的环境退回纯文本。
const wordSegmenter =
  typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("zh", { granularity: "word" })
    : null;

export function breakableWords(text) {
  const value = String(text);
  if (!wordSegmenter) return escapeHtml(value);

  const words = [];
  for (const { segment, isWordLike } of wordSegmenter.segment(value)) {
    if (!isWordLike && words.length > 0) {
      words[words.length - 1] += segment;
    } else {
      words.push(segment);
    }
  }
  return words
    .map((word) => `<span class="wb">${escapeHtml(word)}</span>`)
    .join("");
}

export function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function displayedOptions(question) {
  const items = [...question.options];
  let seed = hashString(`figure-atlas:${question.id}`);
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    [items[index], items[swapWith]] = [items[swapWith], items[index]];
  }
  return items;
}
