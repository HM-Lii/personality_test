/**
 * 极简判词海报：把结果凝练成一张可分享的竖版图片。
 *
 * 设计：判词是视觉主角（晒图晒的是"夸我的那句话"），人名与私章为署名
 * 层级。纸纹底 + 巨型水印字 + 有机形朱砂章（与 og-card 同源的
 * border-radius 比例）+ 卷眉细线 + 右下角「未见之我」落款。
 * 优越感来自判词、私章与专属编号，不使用无常模依据的百分位宣称。
 *
 * 绘制全部走 Canvas 2D，无外部依赖。buildShareCardModel 为纯函数，
 * 可脱离 DOM 单测；drawShareCard 接受任意 2D 上下文，测试用 mock 覆盖。
 */
import { scoreBand } from "../core/result.mjs";

/** 判词：按主导维度 + 分档（high/middle/low）各一句，夸倾向不夸能力。 */
export const SHARE_VERDICTS = {
  O: {
    high: "敢想旁人未想，见得他人未见",
    middle: "于新旧之间，自有一杆秤",
    low: "不逐新潮，出手皆有分寸",
  },
  C: {
    high: "谋定而后动，事必有成",
    middle: "可谋定，可应变，不拘一格",
    low: "逢山开路，水到渠成",
  },
  E: {
    high: "你到之处，自成场域",
    middle: "入得人群，守得住独处",
    low: "不喧哗，自有声",
  },
  A: {
    high: "心怀众人，远路有伴",
    middle: "刚柔并济，远近有度",
    low: "敢把真话，摆上台面",
  },
  R: {
    high: "风浪不改其度",
    middle: "乱过，仍站得回来",
    low: "暗涌未起，你先看见",
  },
};

/** 从结果页视图模型提取海报所需的全部内容（纯函数）。 */
export function buildShareCardModel(vm) {
  const band = scoreBand(vm.highest.score);
  return {
    displayName: vm.displayName,
    displayTitle: vm.displayTitle,
    stampChar: vm.primary.name.at(0),
    verdict: SHARE_VERDICTS[vm.highest.id][band],
    verdictDimension: vm.highest.name,
    reportId: vm.reportId,
    clarityBand: vm.result.clarity.band,
    dual: vm.result.dual,
  };
}

/* ---------- 绘制 ---------- */

export const CARD_WIDTH = 900;
export const CARD_HEIGHT = 1350;

const COLORS = {
  paper: "#f4efe3",
  ink: "#1a1a16",
  inkSoft: "#3a382f",
  muted: "#756f62",
  rust: "#9d432b",
  rustLight: "#ab4e33",
  rustDeep: "#8d3a24",
  gold: "#b68a4d",
  white: "#fffdf7",
  line: "rgba(26, 26, 22, 0.12)",
};
const SERIF = '"Noto Serif SC", "Songti SC", "SimSun", serif';
const SANS = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';

/** 逐步缩小字号直到文本宽度不超过 maxWidth，返回最终字号。 */
function fitFont(ctx, text, { maxWidth, size, min, weight = 500, family = SERIF }) {
  let fontSize = size;
  ctx.font = `${weight} ${fontSize}px ${family}`;
  while (fontSize > min && ctx.measureText(text).width > maxWidth) {
    fontSize -= 2;
    ctx.font = `${weight} ${fontSize}px ${family}`;
  }
  return fontSize;
}

function setTracking(ctx, value) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = value;
}

function drawGlow(ctx, cx, cy, radius, color) {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(244, 239, 227, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

/* 与站点一致的纸张噪点（base.css 同款 feTurbulence 瓦片） */
const NOISE_SVG =
  "<svg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.88' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='.08'/></svg>";

let noiseImagePromise = null;

/** 预加载噪点纹理；失败清空缓存允许下次重试。 */
export function loadNoiseImage() {
  noiseImagePromise ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("噪点纹理加载失败"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(NOISE_SVG)}`;
  }).catch((error) => {
    noiseImagePromise = null;
    throw error;
  });
  return noiseImagePromise;
}

/** 仅供测试：清空噪点缓存。 */
export function _clearNoiseCache() {
  noiseImagePromise = null;
}

function drawNoise(ctx, noiseImage) {
  if (!noiseImage) return;
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = ctx.createPattern(noiseImage, "repeat");
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.restore();
}

/** 巨型水印：人物首字，极淡，出血排布，呼应结果页 hero 的 data-character。 */
function drawWatermark(ctx, char) {
  ctx.save();
  ctx.translate(CARD_WIDTH * 0.68, CARD_HEIGHT * 0.66);
  ctx.rotate((-6 * Math.PI) / 180);
  ctx.fillStyle = "rgba(26, 26, 22, 0.04)";
  ctx.font = `500 640px ${SERIF}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(char, 0, 0);
  ctx.restore();
}

/**
 * 朱砂章的有机外形：与 og-card 的
 * border-radius(48% 52% 46% 54% / 54% 48% 52% 46%) 同源——
 * 同一边两角半径之和恰为 100%，四段椭圆弧在边中点相接。
 */
function sealBlobPath(ctx, width, height) {
  const rx = [0.48 * width, 0.52 * width, 0.46 * width, 0.54 * width];
  const ry = [0.54 * height, 0.48 * height, 0.52 * height, 0.46 * height];
  const hw = width / 2;
  const hh = height / 2;
  ctx.beginPath();
  ctx.moveTo(-hw + rx[0], -hh);
  ctx.ellipse(hw - rx[1], -hh + ry[1], rx[1], ry[1], 0, -Math.PI / 2, 0);
  ctx.ellipse(hw - rx[2], hh - ry[2], rx[2], ry[2], 0, 0, Math.PI / 2);
  ctx.ellipse(-hw + rx[3], hh - ry[3], rx[3], ry[3], 0, Math.PI / 2, Math.PI);
  ctx.ellipse(-hw + rx[0], -hh + ry[0], rx[0], ry[0], 0, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

/** 朱砂私章：有机外形、中心略亮的盖印渐变、随形内框、白字居中。 */
function drawSeal(ctx, cx, cy, width, height, char) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-4 * Math.PI) / 180);
  const gradient = ctx.createRadialGradient(
    -width * 0.15,
    -height * 0.2,
    10,
    0,
    0,
    height * 0.75,
  );
  gradient.addColorStop(0, COLORS.rustLight);
  gradient.addColorStop(1, COLORS.rustDeep);
  sealBlobPath(ctx, width, height);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.save();
  ctx.scale(0.86, 0.86);
  sealBlobPath(ctx, width, height);
  ctx.strokeStyle = "rgba(255, 253, 247, 0.28)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = COLORS.white;
  ctx.font = `500 ${Math.round(height * 0.42)}px ${SERIF}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(char, 0, Math.round(height * 0.02));
  ctx.restore();
}

/** 卷眉：品牌与档案编号分列左右，中间一条细线贯穿。 */
function drawMasthead(ctx, model) {
  const brand = "人物志 · 历史人格镜";
  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 20px ${SANS}`;
  ctx.textBaseline = "middle";
  setTracking(ctx, "6px");
  ctx.textAlign = "left";
  ctx.fillText(brand, 64, 86);
  const brandWidth = ctx.measureText(brand).width;
  ctx.textAlign = "right";
  ctx.fillText(model.reportId, CARD_WIDTH - 64, 86);
  const idWidth = ctx.measureText(model.reportId).width;
  setTracking(ctx, "0px");
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64 + brandWidth + 28, 86);
  ctx.lineTo(CARD_WIDTH - 64 - idWidth - 28, 86);
  ctx.stroke();
}

/** 金线分隔：两端渐隐。 */
function drawGoldRule(ctx, cx, y) {
  const gradient = ctx.createLinearGradient(cx - 70, 0, cx + 70, 0);
  gradient.addColorStop(0, "rgba(182, 138, 77, 0)");
  gradient.addColorStop(0.5, "rgba(182, 138, 77, 0.9)");
  gradient.addColorStop(1, "rgba(182, 138, 77, 0)");
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 70, y);
  ctx.lineTo(cx + 70, y);
  ctx.stroke();
}

/** 判词按顿号拆行：一逗一行，短句独行。 */
export function verdictLines(verdict) {
  return verdict.split("，").filter((line) => line.length > 0);
}

/** 判词：海报的视觉主角，逐行居中，行数决定纵向起点。 */
function drawVerdict(ctx, cx, model) {
  const lines = verdictLines(model.verdict);
  const longest = lines.reduce((a, b) => (b.length > a.length ? b : a), "");
  ctx.fillStyle = COLORS.ink;
  fitFont(ctx, longest, { maxWidth: 720, size: 72, min: 44 });
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const startY = 948 - (lines.length - 1) * 50;
  lines.forEach((line, index) => {
    ctx.fillText(line, cx, startY + index * 100);
  });
}

/** 底部：左侧清晰度与免责两行小字，右下角「未见之我」落款。 */
function drawFooter(ctx, model) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 20px ${SANS}`;
  ctx.fillText(`匹配清晰度 · ${model.clarityBand}`, 64, 1182);
  ctx.font = `400 18px ${SANS}`;
  ctx.fillText("历史人格原型是大众文化中的性格隐喻 · 分数来自 25–28 道情境题", 64, 1218);
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.inkSoft;
  ctx.font = `500 24px ${SERIF}`;
  ctx.fillText("未见之我", CARD_WIDTH - 64, 1200);
}

/**
 * 在 900×1350 的逻辑画布上绘制海报（调用方负责缩放与字体就绪）。
 * 自上而下：卷眉 → 私章 → 人名 → 原型副题 → 主导倾向 → 金线 →
 * 判词（视觉主角）→ 底部说明与落款。
 */
export function drawShareCard(ctx, model, { noiseImage = null } = {}) {
  const cx = CARD_WIDTH / 2;

  /* 底：纸色 + 墨彩光晕 + 噪点 + 巨型水印 */
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  drawGlow(ctx, CARD_WIDTH * 0.12, CARD_HEIGHT * 0.1, 420, "rgba(182, 138, 77, 0.10)");
  drawGlow(ctx, CARD_WIDTH * 0.88, CARD_HEIGHT * 0.82, 480, "rgba(157, 67, 43, 0.08)");
  drawGlow(ctx, cx, CARD_HEIGHT * 0.5, 620, "rgba(102, 115, 97, 0.04)");
  drawNoise(ctx, noiseImage);
  drawWatermark(ctx, model.stampChar);

  /* 卷宗内框 */
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(34, 34, CARD_WIDTH - 68, CARD_HEIGHT - 68);

  drawMasthead(ctx, model);
  drawSeal(ctx, cx, 320, 170, 210, model.stampChar);

  /* 人名与原型副题：署名层级 */
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.ink;
  fitFont(ctx, model.displayName, { maxWidth: 700, size: 72, min: 50 });
  ctx.fillText(model.displayName, cx, 592);
  ctx.fillStyle = COLORS.muted;
  fitFont(ctx, model.displayTitle, { maxWidth: 720, size: 30, min: 22 });
  setTracking(ctx, "4px");
  ctx.fillText(model.displayTitle, cx, 658);
  setTracking(ctx, "0px");
  ctx.font = `400 20px ${SANS}`;
  ctx.fillText(`主导倾向 · ${model.verdictDimension}`, cx, 728);

  drawGoldRule(ctx, cx, 792);
  drawVerdict(ctx, cx, model);
  drawFooter(ctx, model);
}

/**
 * 离屏渲染为 PNG Blob（2x 分辨率）。等待文档字体与噪点纹理就绪后
 * 再绘制，确保衬线子集与纸纹在画布生效；噪点加载失败则静默略过。
 */
export async function renderShareCardPng(model, scale = 2) {
  const [, noiseImage] = await Promise.all([
    document.fonts.ready,
    loadNoiseImage().catch(() => null),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH * scale;
  canvas.height = CARD_HEIGHT * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  drawShareCard(ctx, model, { noiseImage });
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob 返回空"))),
      "image/png",
    );
  });
}

/**
 * 分享或保存海报：移动端支持 Web Share（文件）时唤起系统分享面板
 * （面板内可存相册）；桌面端一律直接下载 PNG 到本地。用户取消分享
 * （AbortError）静默处理。返回 "shared" | "aborted" | "downloaded"。
 */
export async function shareCardImage(blob, { showToast, fileName = "人物志-历史人格镜.png" } = {}) {
  const file = new File([blob], fileName, { type: "image/png" });
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent ?? "");
  if (isMobile && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "我的历史人格原型" });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "aborted";
      /* 分享通道异常时退回下载 */
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  /* Firefox 要求元素挂载后 click 才会触发下载 */
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("分享图已下载");
  return "downloaded";
}
