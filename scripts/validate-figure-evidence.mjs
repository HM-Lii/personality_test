import evidenceDocument from "../docs/figure-evidence.json" with { type: "json" };
import { FIGURES } from "../src/data/figures.mjs";

const DIMENSIONS = new Set(["O", "C", "E", "A", "R"]);
const CONFIDENCE_LEVELS = new Set(["high", "medium", "low"]);
const ALLOWED_SOURCE_HOSTS = new Set([
  "cbetaonline.dila.edu.tw",
  "ctext.org",
  "zh.wikisource.org",
  "zjdy.zjdafw.gov.cn",
]);
const issues = [];

const hasText = (value, minimum = 8) =>
  typeof value === "string" && value.trim().length >= minimum;

if (evidenceDocument.schemaVersion !== 1) {
  issues.push(`schemaVersion 应为 1，实际 ${evidenceDocument.schemaVersion}`);
}
if (!evidenceDocument.methodology || typeof evidenceDocument.methodology !== "object") {
  issues.push("缺少 methodology");
}
if (!Array.isArray(evidenceDocument.figures)) {
  issues.push("figures 必须是数组");
}

const evidenceRows = Array.isArray(evidenceDocument.figures)
  ? evidenceDocument.figures
  : [];
const figureById = new Map(FIGURES.map((figure) => [figure.id, figure]));
const seenIds = new Set();
const confidenceCounts = { high: 0, medium: 0, low: 0 };

if (evidenceRows.length !== FIGURES.length) {
  issues.push(
    `条数不一致：evidence ${evidenceRows.length} 条，figures.mjs ${FIGURES.length} 条`,
  );
}

for (const row of evidenceRows) {
  if (!hasText(row.id, 1)) {
    issues.push("存在缺少 id 的 evidence 条目");
    continue;
  }
  if (seenIds.has(row.id)) issues.push(`重复 id：${row.id}`);
  seenIds.add(row.id);

  const figure = figureById.get(row.id);
  if (!figure) {
    issues.push(`evidence 中存在 figures.mjs 没有的 id：${row.id}`);
    continue;
  }

  if (!Array.isArray(row.evidenceChains) || row.evidenceChains.length < 2) {
    issues.push(`${row.id}：至少需要 2 条 evidenceChains`);
    continue;
  }

  const coveredDimensions = new Set();
  for (const [index, chain] of row.evidenceChains.entries()) {
    const label = `${row.id}.evidenceChains[${index}]`;
    if (!DIMENSIONS.has(chain.dimension)) {
      issues.push(`${label}：非法维度 ${chain.dimension}`);
    } else {
      if (coveredDimensions.has(chain.dimension)) {
        issues.push(`${label}：关键维度 ${chain.dimension} 重复`);
      }
      coveredDimensions.add(chain.dimension);
      if (Math.abs(figure.vector[chain.dimension] - 50) < 12) {
        issues.push(
          `${label}：${chain.dimension}=${figure.vector[chain.dimension]} 过于接近中点，不宜列为关键维度`,
        );
      }
    }

    if (!hasText(chain.event, 10)) issues.push(`${label}：historical event 过短或缺失`);
    if (!hasText(chain.interpretation, 10)) {
      issues.push(`${label}：dimension interpretation 过短或缺失`);
    }
    if (!hasText(chain.controversy, 10)) {
      issues.push(`${label}：controversy 过短或缺失`);
    }

    if (!chain.source || typeof chain.source !== "object") {
      issues.push(`${label}：缺少 source`);
    } else {
      if (!hasText(chain.source.title, 2)) issues.push(`${label}：source.title 缺失`);
      if (!hasText(chain.source.kind, 3)) issues.push(`${label}：source.kind 缺失`);
      if (!hasText(chain.source.locator, 3)) issues.push(`${label}：source.locator 缺失`);
      try {
        const sourceUrl = new URL(chain.source.url);
        if (sourceUrl.protocol !== "https:") {
          issues.push(`${label}：source.url 必须使用 https`);
        }
        if (!ALLOWED_SOURCE_HOSTS.has(sourceUrl.hostname)) {
          issues.push(`${label}：source.url 域名未列入可信来源白名单`);
        }
      } catch {
        issues.push(`${label}：source.url 非法或缺失`);
      }
    }

    if (!chain.confidence || typeof chain.confidence !== "object") {
      issues.push(`${label}：缺少 confidence`);
    } else {
      if (!CONFIDENCE_LEVELS.has(chain.confidence.level)) {
        issues.push(`${label}：非法 confidence.level ${chain.confidence.level}`);
      } else {
        confidenceCounts[chain.confidence.level] += 1;
      }
      if (!hasText(chain.confidence.reason, 10)) {
        issues.push(`${label}：confidence.reason 过短或缺失`);
      }
    }
  }

  if (coveredDimensions.size < 2) {
    issues.push(`${row.id}：证据链须覆盖至少 2 个不同关键维度`);
  }

  if (
    JSON.stringify(figure.evidenceChains) !== JSON.stringify(row.evidenceChains)
  ) {
    issues.push(`${row.id}：figures.mjs 未正确注入 evidenceChains`);
  }
}

for (const figure of FIGURES) {
  if (!seenIds.has(figure.id)) {
    issues.push(`figures.mjs 中 ${figure.id} 缺少 evidence 条目`);
  }
}

const chainCount = evidenceRows.reduce(
  (sum, row) => sum + (row.evidenceChains?.length ?? 0),
  0,
);
console.log(
  `人物 evidence：${evidenceRows.length} 人 / ${chainCount} 条（high ${confidenceCounts.high}，medium ${confidenceCounts.medium}，low ${confidenceCounts.low}）`,
);

if (issues.length > 0) {
  console.log("\n✗ 人物证据链校验失败：");
  for (const issue of issues) console.log(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log("\n✓ 人物证据链校验通过。");
}
