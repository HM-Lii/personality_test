export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
