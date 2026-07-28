/**
 * 生成 src/data/generated/figure-evidence.json（全人物库关键维度证据链）
 * 运行：node scripts/build-figure-evidence.mjs
 *
 * 这里记录的是"史料 → 现代叙事维度"的可审查推断，不是对历史人物
 * 进行心理测量。confidence 评价材料对该条解释的支持力度，不评价人物本身。
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { FIGURES } from "../src/data/figures.mjs";
import {
  SOURCES,
  CONFIDENCE_REASONS,
  EVIDENCE_BY_ID,
} from "./data/evidence-source.mjs";

const missing = FIGURES.filter((figure) => !EVIDENCE_BY_ID[figure.id]);
const extra = Object.keys(EVIDENCE_BY_ID).filter(
  (id) => !FIGURES.some((figure) => figure.id === id),
);

if (missing.length > 0 || extra.length > 0) {
  if (missing.length > 0) {
    console.error("缺少 evidence 条目：", missing.map((figure) => figure.id).join(", "));
  }
  if (extra.length > 0) {
    console.error("存在未知 evidence 条目：", extra.join(", "));
  }
  process.exitCode = 1;
} else {
  const output = {
    schemaVersion: 1,
    methodology: {
      keyDimensionRule: "每人至少选择两个最能被具体史事支持的叙事维度，不等同于心理测量。",
      confidenceRule:
        "confidence 评价材料对该条维度解释的支持力度；即使为 high，维度映射仍是现代解释。",
      sourceRule:
        "优先本人著述、近时记录和正史；后出轶事只作弱证据，并在 controversy 中说明限制。",
    },
    figures: FIGURES.map((figure) => ({
      id: figure.id,
      evidenceChains: EVIDENCE_BY_ID[figure.id].map((item) => ({
        dimension: item.dimension,
        event: item.event,
        source: {
          ...SOURCES[item.sourceId],
          locator: item.locator,
        },
        interpretation: item.interpretation,
        confidence: {
          level: item.confidence,
          reason: CONFIDENCE_REASONS[item.confidence],
        },
        controversy: item.controversy,
      })),
    })),
  };

  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "src",
    "data",
    "generated",
    "figure-evidence.json",
  );
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(
    `✓ 已写入 ${output.figures.length} 人 / ${output.figures.reduce(
      (sum, row) => sum + row.evidenceChains.length,
      0,
    )} 条证据链 → ${outPath}`,
  );
}
