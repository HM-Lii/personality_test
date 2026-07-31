/**
 * 整页长图：把结果页 DOM 快照渲染成一张 PNG。
 *
 * 技术路线：克隆 `.result-page` → XMLSerializer 序列化为 XHTML → 嵌入
 * SVG `<foreignObject>`（样式表经 @import 展开、字体等外部资源内联为
 * data: URL）→ 整体编码为 data: URL 载入 Image → 绘制到 canvas。
 * 不能用 Blob URL：Chrome 对 blob: 来源的 foreignObject SVG 会污染画布，
 * 导致 toBlob 失败；data: URL 则无此限制。零依赖。
 *
 * 快照内的修正（SNAPSHOT_OVERRIDES）：
 * - 禁用动画/过渡，并强制 .reveal 可见——否则未滚动到的卡片保持 opacity 0；
 * - 复位雷达图描边动画的 dashoffset——否则轮廓线停在起点；
 * - 隐藏 .result-actions——按钮在静态图片里没有意义。
 */
/* ---------- 纯函数 ---------- */

/** 相对路径解析（不依赖 location，便于单测）。 */
export function resolvePath(ref, parentPath) {
  const segments = parentPath.split("/").slice(0, -1);
  for (const segment of ref.split("/")) {
    if (segment === "..") segments.pop();
    else if (segment !== "." && segment !== "") segments.push(segment);
  }
  return segments.join("/");
}

const IMPORT_RE = /@import\s+url\(["']?([^"')]+)["']?\)\s*;/g;
/* data: 与片段引用（含 data URI 内编码后的 %23）都不是外部资源 */
const RESOURCE_RE = /url\(["']?(?!data:|#|%23)([^"')]+)["']?\)/g;

/** 把 CSS 中的 url(...) 外部资源替换为 data: URL。 */
export async function inlineResourceUrls(css, parentPath, fetchData) {
  let output = css;
  for (const match of css.matchAll(RESOURCE_RE)) {
    const dataUrl = await fetchData(resolvePath(match[1], parentPath));
    output = output.split(match[0]).join(`url("${dataUrl}")`);
  }
  return output;
}

/** 递归展开 @import，并按各文件自身的目录内联其外部资源。 */
export async function inlineCssImports(path, fetchText, fetchData, seen = new Set()) {
  if (seen.has(path)) return "";
  seen.add(path);
  const raw = await fetchText(path);
  const chunks = [];
  for (const match of raw.matchAll(IMPORT_RE)) {
    chunks.push(
      await inlineCssImports(resolvePath(match[1], path), fetchText, fetchData, seen),
    );
  }
  const css = await inlineResourceUrls(raw.replace(IMPORT_RE, ""), path, fetchData);
  return chunks.join("\n") + "\n" + css;
}

/** 快照约束：像素总量（iOS 画布上限约 16.7M）与单边上限之内，最高 2x。 */
export function computeSnapshotScale(
  width,
  height,
  { maxPixels = 14_000_000, maxSide = 16_000 } = {},
) {
  const byPixels = Math.sqrt(maxPixels / (width * height));
  const bySide = maxSide / Math.max(width, height);
  return Math.min(2, byPixels, bySide);
}

const SNAPSHOT_OVERRIDES = `
.share-snapshot-root {
  box-sizing: border-box;
  width: 100%;
  min-height: 100%;
  padding-bottom: 40px;
  color: var(--ink);
  background: var(--paper);
  font-family: var(--sans);
  font-size: 15px;
  line-height: var(--lh-body);
  letter-spacing: var(--track-body);
}
.share-snapshot-root * {
  animation: none !important;
  transition: none !important;
}
.share-snapshot-root .reveal {
  opacity: 1 !important;
  translate: none !important;
}
.share-snapshot-root .radar-area {
  stroke-dasharray: none !important;
  stroke-dashoffset: 0 !important;
}
.share-snapshot-root .result-actions {
  display: none !important;
}`;

export function buildSnapshotSvg(xhtml, css, { width, height }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" class="share-snapshot-root"><style>${css}\n${SNAPSHOT_OVERRIDES}</style>${xhtml}</div></foreignObject></svg>`;
}

/* ---------- 运行时（浏览器） ---------- */

function defaultFetchText(path) {
  return fetch(path).then((response) => {
    if (!response.ok) throw new Error(`加载样式失败：${path}`);
    return response.text();
  });
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return btoa(binary);
}

function defaultFetchData(path) {
  return fetch(path)
    .then((response) => {
      if (!response.ok) throw new Error(`加载资源失败：${path}`);
      return response.arrayBuffer();
    })
    .then((buffer) => {
      const mime = path.endsWith(".woff2") ? "font/woff2" : "application/octet-stream";
      return `data:${mime};base64,${toBase64(buffer)}`;
    });
}

/* 样式表 + 字体较大，首次生成后缓存；失败不缓存，允许重试 */
let snapshotCssPromise = null;

function getSnapshotCss(deps) {
  snapshotCssPromise ??= inlineCssImports(
    "styles.css",
    deps.fetchText,
    deps.fetchData,
  ).catch((error) => {
    snapshotCssPromise = null;
    throw error;
  });
  return snapshotCssPromise;
}

/** 仅供测试：清空样式缓存。 */
export function _clearSnapshotCache() {
  snapshotCssPromise = null;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("结果页快照渲染失败"));
    image.src = url;
  });
}

/**
 * 把结果页元素渲染为 PNG Blob。宽度取元素当前布局宽度（媒体查询随之
 * 匹配，所见即所得），高度取完整滚动高度，清晰度按画布上限自动收敛。
 */
export async function renderResultPagePng(
  element,
  { fetchText = defaultFetchText, fetchData = defaultFetchData } = {},
) {
  const width = Math.max(1, Math.round(element.getBoundingClientRect().width));
  const height = Math.max(1, element.scrollHeight);
  const scale = computeSnapshotScale(width, height);
  const css = await getSnapshotCss({ fetchText, fetchData });
  const xhtml = new XMLSerializer().serializeToString(element.cloneNode(true));
  const svg = buildSnapshotSvg(xhtml, css, { width, height });
  const image = await loadImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.drawImage(image, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob 返回空"))),
      "image/png",
    );
  });
}

