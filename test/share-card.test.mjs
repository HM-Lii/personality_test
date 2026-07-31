import assert from "node:assert/strict";
import test from "node:test";

import {
  CARD_HEIGHT,
  CARD_WIDTH,
  SHARE_VERDICTS,
  _clearNoiseCache,
  buildShareCardModel,
  drawShareCard,
  loadNoiseImage,
  renderShareCardPng,
  shareCardImage,
  verdictLines,
} from "../src/ui/share-card.mjs";

/* ---------- 测试替身 ---------- */

/** 记录全部调用的 2D 上下文；measureText 按当前字号近似估算宽度。 */
function createMockContext() {
  const calls = [];
  const ctx = {
    calls,
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textAlign: "",
    textBaseline: "",
    lineWidth: 1,
    save: () => calls.push({ type: "save" }),
    restore: () => calls.push({ type: "restore" }),
    translate: (x, y) => calls.push({ type: "translate", x, y }),
    rotate: (angle) => calls.push({ type: "rotate", angle }),
    scale: (x, y) => calls.push({ type: "scale", x, y }),
    beginPath: () => calls.push({ type: "beginPath" }),
    moveTo: (x, y) => calls.push({ type: "moveTo", x, y }),
    lineTo: (x, y) => calls.push({ type: "lineTo", x, y }),
    arcTo: (...args) => calls.push({ type: "arcTo", args }),
    ellipse: (...args) => calls.push({ type: "ellipse", args }),
    closePath: () => calls.push({ type: "closePath" }),
    fill: () => calls.push({ type: "fill" }),
    stroke: () => calls.push({ type: "stroke" }),
    fillRect: (x, y, w, h) => calls.push({ type: "fillRect", x, y, w, h }),
    strokeRect: (x, y, w, h) => calls.push({ type: "strokeRect", x, y, w, h }),
    fillText: (text, x, y) =>
      calls.push({ type: "fillText", text, x, y, font: ctx.font, fillStyle: ctx.fillStyle }),
    measureText: (text) => ({ width: text.length * fontSizeOf(ctx) }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createPattern: () => {
      calls.push({ type: "createPattern" });
      return {};
    },
  };
  return ctx;
}

function fontSizeOf(ctx) {
  const match = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
  return match ? Number(match[1]) : 16;
}

function fillTexts(ctx) {
  return ctx.calls.filter((call) => call.type === "fillText");
}

function fakeViewModel(overrides = {}) {
  return {
    displayName: "诸葛亮",
    displayTitle: "长期主义的系统规划者",
    primary: { name: "诸葛亮" },
    highest: { id: "C", name: "结构执行", score: 88 },
    reportId: "FA-20260730-3F2A",
    result: { dual: false, clarity: { band: "轮廓较清晰" } },
    ...overrides,
  };
}

/** Node 18 没有全局 File；仅在缺失时补一个最小实现。 */
if (typeof globalThis.File === "undefined") {
  globalThis.File = class File extends Blob {
    constructor(parts, name, options = {}) {
      super(parts, options);
      this.name = name;
    }
  };
}

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

async function withStubbedDocument(value, run) {
  const previousDocument = globalThis.document;
  globalThis.document = value;
  try {
    await run();
  } finally {
    globalThis.document = previousDocument;
  }
}

/* ---------- buildShareCardModel ---------- */

test("buildShareCardModel 提取海报内容并按最高分维度选判词", () => {
  const model = buildShareCardModel(fakeViewModel());

  assert.equal(model.displayName, "诸葛亮");
  assert.equal(model.displayTitle, "长期主义的系统规划者");
  assert.equal(model.stampChar, "诸");
  assert.equal(model.verdict, SHARE_VERDICTS.C.high);
  assert.equal(model.verdictDimension, "结构执行");
  assert.equal(model.reportId, "FA-20260730-3F2A");
  assert.equal(model.clarityBand, "轮廓较清晰");
  assert.equal(model.dual, false);
});

test("buildShareCardModel 按分档切换判词（middle / low）", () => {
  const middle = buildShareCardModel(
    fakeViewModel({ highest: { id: "O", name: "探索开放", score: 50 } }),
  );
  assert.equal(middle.verdict, SHARE_VERDICTS.O.middle);

  const low = buildShareCardModel(
    fakeViewModel({ highest: { id: "R", name: "复原稳定", score: 30 } }),
  );
  assert.equal(low.verdict, SHARE_VERDICTS.R.low);
});

test("buildShareCardModel 双原型保留双名与副题", () => {
  const model = buildShareCardModel(
    fakeViewModel({
      displayName: "诸葛亮 × 张良",
      displayTitle: "长期主义的系统规划者，也带着一点谋定后动的影子",
      result: { dual: true, clarity: { band: "情境型/混合轮廓" } },
    }),
  );

  assert.equal(model.displayName, "诸葛亮 × 张良");
  assert.equal(model.dual, true);
  assert.equal(model.clarityBand, "情境型/混合轮廓");
});

/* ---------- drawShareCard ---------- */

test("drawShareCard 绘制背景、内框、印章与全部文案", () => {
  const ctx = createMockContext();
  const model = buildShareCardModel(fakeViewModel());
  drawShareCard(ctx, model);

  const texts = fillTexts(ctx).map((call) => call.text);
  for (const expected of [
    "未见 · 历史人格原型",
    model.reportId,
    model.stampChar,
    model.displayName,
    model.displayTitle,
    `主导倾向 · ${model.verdictDimension}`,
    `匹配清晰度 · ${model.clarityBand}`,
    "历史人格原型是大众文化中的性格隐喻 · 分数来自 25–28 道情境题",
    "未见之我",
  ]) {
    assert.ok(texts.includes(expected), `缺少绘制文案：${expected}`);
  }

  /* 纸色底铺满画布、卷宗内框、印章与水印带倾斜、印章走椭圆弧路径 */
  assert.ok(
    ctx.calls.some(
      (call) =>
        call.type === "fillRect" &&
        call.x === 0 &&
        call.y === 0 &&
        call.w === CARD_WIDTH &&
        call.h === CARD_HEIGHT,
    ),
  );
  assert.ok(ctx.calls.some((call) => call.type === "strokeRect"));
  assert.ok(ctx.calls.some((call) => call.type === "rotate"));
  assert.ok(ctx.calls.some((call) => call.type === "ellipse"));

  /* 人名以衬线绘制；未提供噪点图时不创建图案 */
  const nameCall = fillTexts(ctx).find((call) => call.text === model.displayName);
  assert.match(nameCall.font, /Noto Serif SC/);
  assert.ok(!ctx.calls.some((call) => call.type === "createPattern"));
});

test("drawShareCard 判词按逗号拆行并作为主字号绘制", () => {
  const ctx = createMockContext();
  const model = buildShareCardModel(fakeViewModel());
  drawShareCard(ctx, model);

  /* 「谋定而后动，事必有成」应拆为两行 */
  const verdictCalls = fillTexts(ctx).filter(
    (call) => call.text === "谋定而后动" || call.text === "事必有成",
  );
  assert.equal(verdictCalls.length, 2);
  assert.ok(verdictCalls[0].y < verdictCalls[1].y, "第一行应在第二行之上");
  /* 判词字号不得小于人名（视觉主角） */
  const nameCall = fillTexts(ctx).find((call) => call.text === model.displayName);
  assert.ok(fontSizeOf(verdictCalls[0]) >= fontSizeOf(nameCall));
});

test("drawShareCard 单句判词绘为单行；提供噪点图时铺纸纹", () => {
  const ctx = createMockContext();
  const model = buildShareCardModel(
    fakeViewModel({ highest: { id: "R", name: "复原稳定", score: 80 } }),
  );
  assert.equal(model.verdict, "风浪不改其度");
  drawShareCard(ctx, model, { noiseImage: { fake: true } });

  const verdictCalls = fillTexts(ctx).filter((call) => call.text === model.verdict);
  assert.equal(verdictCalls.length, 1);
  assert.ok(ctx.calls.some((call) => call.type === "createPattern"));
});

test("verdictLines 按逗号拆行", () => {
  assert.deepEqual(verdictLines("谋定而后动，事必有成"), ["谋定而后动", "事必有成"]);
  assert.deepEqual(verdictLines("可谋定，可应变，不拘一格"), [
    "可谋定",
    "可应变",
    "不拘一格",
  ]);
  assert.deepEqual(verdictLines("风浪不改其度"), ["风浪不改其度"]);
});

test("drawShareCard 双原型长名完整绘制，超长副题缩字号适配", () => {
  const ctx = createMockContext();
  const longTitle = "以铁律推转世局的变法者，也带着一点冷眼解剖世情的旁观者的影子";
  const model = buildShareCardModel(
    fakeViewModel({
      displayName: "诸葛亮 × 张良",
      displayTitle: longTitle,
      result: { dual: true, clarity: { band: "情境型/混合轮廓" } },
    }),
  );
  drawShareCard(ctx, model);

  const nameCall = fillTexts(ctx).find((call) => call.text === model.displayName);
  assert.equal(fontSizeOf(nameCall), 72, "双名在 72px 下应完整放下");
  const titleCall = fillTexts(ctx).find((call) => call.text === longTitle);
  assert.ok(fontSizeOf(titleCall) < 30, "超长副题应触发缩字号");
});

/* ---------- renderShareCardPng ---------- */

test("renderShareCardPng 以 2x 分辨率离屏渲染并产出 PNG Blob", async () => {
  const ctx = createMockContext();
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toBlob(callback, type) {
      callback(new Blob(["png"], { type }));
    },
  };
  const model = buildShareCardModel(fakeViewModel());

  let blob;
  await withStubbedDocument(
    {
      fonts: { ready: Promise.resolve() },
      createElement(tag) {
        assert.equal(tag, "canvas");
        return canvas;
      },
    },
    async () => {
      blob = await renderShareCardPng(model);
    },
  );

  assert.ok(blob instanceof Blob);
  assert.equal(canvas.width, CARD_WIDTH * 2);
  assert.equal(canvas.height, CARD_HEIGHT * 2);
  assert.ok(ctx.calls.some((call) => call.type === "scale" && call.x === 2));
  assert.ok(fillTexts(ctx).some((call) => call.text === model.displayName));
});

test("renderShareCardPng 在 toBlob 返回空时拒绝", async () => {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => createMockContext(),
    toBlob(callback) {
      callback(null);
    },
  };

  await withStubbedDocument(
    {
      fonts: { ready: Promise.resolve() },
      createElement: () => canvas,
    },
    async () => {
      await assert.rejects(
        () => renderShareCardPng(buildShareCardModel(fakeViewModel())),
        /toBlob/,
      );
    },
  );
});

/* ---------- loadNoiseImage ---------- */

function withStubbedImage(implementation, run) {
  const previousImage = globalThis.Image;
  globalThis.Image = implementation;
  return run().finally(() => {
    if (previousImage === undefined) delete globalThis.Image;
    else globalThis.Image = previousImage;
  });
}

test("loadNoiseImage 加载噪点纹理并缓存", async () => {
  _clearNoiseCache();
  let loads = 0;
  await withStubbedImage(
    class {
      set src(value) {
        loads += 1;
        this._src = value;
        queueMicrotask(() => this.onload?.());
      }
      get src() {
        return this._src;
      }
    },
    async () => {
      const first = await loadNoiseImage();
      const second = await loadNoiseImage();
      assert.ok(first);
      assert.equal(first, second, "第二次应命中缓存");
      assert.equal(loads, 1);
      assert.ok(first.src.startsWith("data:image/svg+xml"));
    },
  );
});

test("loadNoiseImage 加载失败时拒绝且允许重试", async () => {
  _clearNoiseCache();
  let attempts = 0;
  await withStubbedImage(
    class {
      set src(value) {
        attempts += 1;
        queueMicrotask(() => this.onerror?.());
      }
    },
    async () => {
      await assert.rejects(() => loadNoiseImage(), /噪点纹理/);
      await assert.rejects(() => loadNoiseImage(), /噪点纹理/);
      assert.equal(attempts, 2, "失败不缓存，应重新加载");
    },
  );
});

/* ---------- shareCardImage ---------- */

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";

test("shareCardImage 移动端支持 Web Share 时直接分享文件", async () => {
  const shared = [];
  const blob = new Blob(["png"], { type: "image/png" });

  let outcome;
  await withStubbedNavigator(
    {
      userAgent: MOBILE_UA,
      canShare: () => true,
      share: async (payload) => shared.push(payload),
    },
    async () => {
      outcome = await shareCardImage(blob, { showToast: () => {} });
    },
  );

  assert.equal(outcome, "shared");
  assert.equal(shared.length, 1);
  assert.equal(shared[0].files[0].type, "image/png");
});

test("shareCardImage 用户取消分享时静默返回 aborted", async () => {
  const toasts = [];
  const blob = new Blob(["png"], { type: "image/png" });
  const abortError = Object.assign(new Error("cancelled"), { name: "AbortError" });

  let outcome;
  await withStubbedNavigator(
    {
      userAgent: MOBILE_UA,
      canShare: () => true,
      share: async () => {
        throw abortError;
      },
    },
    async () => {
      outcome = await shareCardImage(blob, {
        showToast: (message) => toasts.push(message),
      });
    },
  );

  assert.equal(outcome, "aborted");
  assert.deepEqual(toasts, []);
});

test("shareCardImage 分享通道异常与不支持时退回下载", async () => {
  const blob = new Blob(["png"], { type: "image/png" });
  const clicked = [];
  const toasts = [];
  const appended = [];
  const fakeLink = {
    href: "",
    download: "",
    removed: false,
    click() {
      clicked.push(this.download);
    },
    remove() {
      this.removed = true;
    },
  };
  const fakeDocument = {
    createElement(tag) {
      assert.equal(tag, "a");
      fakeLink.removed = false;
      return fakeLink;
    },
    body: {
      append(element) {
        appended.push(element);
      },
    },
  };
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = () => "blob:fake";
  URL.revokeObjectURL = () => {};

  try {
    /* 场景一：移动端 canShare 存在但 share 抛非 AbortError */
    await withStubbedNavigator(
      {
        userAgent: MOBILE_UA,
        canShare: () => true,
        share: async () => {
          throw new Error("share broken");
        },
      },
      () =>
        withStubbedDocument(fakeDocument, async () => {
          const outcome = await shareCardImage(blob, {
            showToast: (message) => toasts.push(message),
            fileName: "未见·诸葛亮.png",
          });
          assert.equal(outcome, "downloaded");
        }),
    );

    /* 场景二：桌面端（无移动端 UA）即使有 share 也直接下载 */
    await withStubbedNavigator(
      {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        canShare: () => true,
        share: async () => {
          assert.fail("桌面端不应走系统分享");
        },
      },
      () =>
        withStubbedDocument(fakeDocument, async () => {
          const outcome = await shareCardImage(blob, {
            showToast: (message) => toasts.push(message),
            fileName: "未见·诸葛亮.png",
          });
          assert.equal(outcome, "downloaded");
        }),
    );

    /* 场景三：根本不支持 Web Share */
    await withStubbedNavigator({}, () =>
      withStubbedDocument(fakeDocument, async () => {
        const outcome = await shareCardImage(blob, {
          showToast: (message) => toasts.push(message),
          fileName: "未见·诸葛亮.png",
        });
        assert.equal(outcome, "downloaded");
      }),
    );
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }

  assert.deepEqual(clicked, [
    "未见·诸葛亮.png",
    "未见·诸葛亮.png",
    "未见·诸葛亮.png",
  ]);
  assert.deepEqual(toasts, ["分享图已下载", "分享图已下载", "分享图已下载"]);
  assert.equal(appended.length, 3, "下载链接必须先挂载再点击");
  assert.equal(fakeLink.removed, true, "点击后应移除链接元素");
});
