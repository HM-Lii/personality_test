import assert from "node:assert/strict";
import test from "node:test";

import {
  _clearSnapshotCache,
  buildSnapshotSvg,
  computeSnapshotScale,
  inlineCssImports,
  inlineResourceUrls,
  renderResultPagePng,
  resolvePath,
} from "../src/ui/share-page.mjs";

/* ---------- 纯函数 ---------- */

test("resolvePath 解析相对引用", () => {
  assert.equal(resolvePath("styles/base.css", "styles.css"), "styles/base.css");
  assert.equal(resolvePath("b.css", "styles/a.css"), "styles/b.css");
  assert.equal(
    resolvePath("../fonts/NotoSerifSC-subset.woff2", "styles/base.css"),
    "fonts/NotoSerifSC-subset.woff2",
  );
  assert.equal(resolvePath("./x.css", "styles/a.css"), "styles/x.css");
});

test("computeSnapshotScale 在 2x、像素总量与单边上限之间取最小", () => {
  assert.equal(computeSnapshotScale(400, 800), 2);
  const huge = computeSnapshotScale(1180, 6000);
  assert.ok(huge < 2 && huge > 1, `长页应收敛：${huge}`);
  assert.ok(1180 * huge * (6000 * huge) <= 14_000_000);
  assert.equal(
    computeSnapshotScale(40_000, 100, { maxPixels: 1e9, maxSide: 16_000 }),
    0.4,
  );
});

test("buildSnapshotSvg 输出完整 SVG 并带快照修正", () => {
  const svg = buildSnapshotSvg("<article>x</article>", ".a{color:red}", {
    width: 1180,
    height: 6000,
  });
  assert.ok(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="1180" height="6000"`));
  assert.ok(svg.includes("<foreignObject"));
  assert.ok(svg.includes("<article>x</article>"));
  assert.ok(svg.includes(".a{color:red}"));
  /* 快照修正：强制 reveal 可见、隐藏操作按钮、复位雷达描边 */
  assert.ok(svg.includes(".reveal"));
  assert.ok(svg.includes(".result-actions"));
  assert.ok(svg.includes("stroke-dashoffset: 0 !important"));
});

/* ---------- CSS 内联 ---------- */

const FAKE_CSS = {
  "styles.css": '@import url("styles/a.css");\n@import url("styles/b.css");\n.root{color:red}',
  "styles/a.css":
    '@import url("b.css");\n.a{background:url("../fonts/f.woff2")}',
  "styles/b.css": '.b{mask:url(#m);border-image:url("data:image/png;base64,x")}',
  "styles/c.css":
    ".c{background:url(\"data:image/svg+xml,%3Csvg%3E%3Crect filter='url(%23n)'/%3E%3C/svg%3E\")}",
};

test("inlineCssImports 递归展开 @import、去重并按文件目录内联资源", async () => {
  const calls = [];
  const fetchText = (path) => {
    calls.push(path);
    return Promise.resolve(FAKE_CSS[path]);
  };
  const fetchData = (path) => Promise.resolve(`data:inline(${path})`);

  const css = await inlineCssImports("styles.css", fetchText, fetchData);

  assert.ok(!css.includes("@import"), "@import 应全部展开");
  assert.ok(css.includes(".root{color:red}"));
  assert.ok(css.includes('.a{background:url("data:inline(fonts/f.woff2)")}'));
  assert.ok(css.includes(".b{mask:url(#m)"), "fragment 引用保持不变");
  assert.ok(css.includes('url("data:image/png;base64,x")'), "data: 引用保持不变");
  /* b.css 被两处 @import，但只加载一次 */
  assert.deepEqual(
    [...calls].sort(),
    ["styles.css", "styles/a.css", "styles/b.css"].sort(),
  );
});

test("inlineResourceUrls 逐项替换外部资源", async () => {
  const out = await inlineResourceUrls(
    '.x{a:url("../f.woff2");b:url("../f.woff2")}',
    "styles/x.css",
    (path) => Promise.resolve(`data:${path}`),
  );
  assert.equal(out, '.x{a:url("data:f.woff2");b:url("data:f.woff2")}');
});

test("inlineResourceUrls 不触碰 data URI 内部的编码片段引用", async () => {
  const noise =
    '.c{background:url("data:image/svg+xml,%3Csvg%3E%3Crect filter=\'url(%23n)\'/%3E%3C/svg%3E")}';
  const out = await inlineResourceUrls(noise, "styles/c.css", () =>
    Promise.reject(new Error("不应发起外部请求")),
  );
  assert.equal(out, noise);
});

/* ---------- renderResultPagePng ---------- */

function fakeElement(width = 1180, height = 6000) {
  return {
    getBoundingClientRect: () => ({ width }),
    scrollHeight: height,
    cloneNode: () => ({ xhtml: "<article>report</article>" }),
  };
}

function stubGlobals() {
  const calls = { drawImage: 0, imageSrc: "" };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      scale: () => {},
      drawImage: () => {
        calls.drawImage += 1;
      },
    }),
    toBlob(callback, type) {
      callback(new Blob(["png"], { type }));
    },
  };
  const originals = {
    XMLSerializer: globalThis.XMLSerializer,
    Image: globalThis.Image,
    document: globalThis.document,
  };
  globalThis.XMLSerializer = class {
    serializeToString(node) {
      return node.xhtml;
    }
  };
  globalThis.Image = class {
    set src(value) {
      this._src = value;
      calls.imageSrc = value;
      queueMicrotask(() => this.onload?.());
    }
    get src() {
      return this._src;
    }
  };
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, "canvas");
      return canvas;
    },
  };
  return {
    calls,
    canvas,
    restore() {
      globalThis.XMLSerializer = originals.XMLSerializer;
      globalThis.Image = originals.Image;
      globalThis.document = originals.document;
      if (originals.XMLSerializer === undefined) delete globalThis.XMLSerializer;
      if (originals.Image === undefined) delete globalThis.Image;
      if (originals.document === undefined) delete globalThis.document;
    },
  };
}

const okFetchText = () => Promise.resolve(".a{color:red}");
const okFetchData = () => Promise.resolve("data:x");

test("renderResultPagePng 渲染元素为缩放后的 PNG Blob 并复用样式缓存", async () => {
  _clearSnapshotCache();
  const { calls, canvas, restore } = stubGlobals();
  let cssLoads = 0;
  const fetchText = (path) => {
    cssLoads += 1;
    return okFetchText(path);
  };
  try {
    const first = await renderResultPagePng(fakeElement(), {
      fetchText,
      fetchData: okFetchData,
    });
    const second = await renderResultPagePng(fakeElement(), {
      fetchText,
      fetchData: okFetchData,
    });

    assert.ok(first instanceof Blob && second instanceof Blob);
    const scale = computeSnapshotScale(1180, 6000);
    assert.equal(canvas.width, Math.round(1180 * scale));
    assert.equal(canvas.height, Math.round(6000 * scale));
    assert.equal(calls.drawImage, 2);
    assert.ok(
      calls.imageSrc.startsWith("data:image/svg+xml"),
      "快照必须以 data: URL 载入（blob: 会被 Chrome 污染画布）",
    );
    assert.equal(cssLoads, 1, "样式表只应在首次生成时加载");
  } finally {
    restore();
  }
});

test("renderResultPagePng 样式加载失败时拒绝且不缓存失败", async () => {
  _clearSnapshotCache();
  let attempts = 0;
  const fetchText = () => {
    attempts += 1;
    return Promise.reject(new Error("network"));
  };
  await assert.rejects(() =>
    renderResultPagePng(fakeElement(), { fetchText, fetchData: okFetchData }),
  );
  _clearSnapshotCache();
  await assert.rejects(() =>
    renderResultPagePng(fakeElement(), { fetchText, fetchData: okFetchData }),
  );
  assert.equal(attempts, 2, "失败后重试应重新加载样式");
});
