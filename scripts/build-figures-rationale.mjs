/**
 * 生成 src/data/generated/figures-rationale.json（全人物库向量理论依据）
 * 运行：node scripts/build-figures-rationale.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { FIGURES } from "../src/data/figures.mjs";
import { RATIONALE_BY_ID } from "./data/rationale-source.mjs";

const missing = FIGURES.filter((figure) => !RATIONALE_BY_ID[figure.id]);
if (missing.length > 0) {
  console.error("缺少 rationale 条目：", missing.map((f) => f.id).join(", "));
  process.exitCode = 1;
} else {
  const output = FIGURES.map((figure) => {
    const entry = RATIONALE_BY_ID[figure.id];
    return {
      id: figure.id,
      tags: entry.tags,
      vector: figure.vector,
      rationale: entry.rationale,
    };
  });

  const outPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "src",
    "data",
    "generated",
    "figures-rationale.json",
  );
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`✓ 已写入 ${output.length} 条 → ${outPath}`);
}
