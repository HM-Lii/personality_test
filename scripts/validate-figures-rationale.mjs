import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { FIGURES } from "../src/data/figures.mjs";

const DIMENSIONS = ["O", "C", "E", "A", "R"];
const scriptDir = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(scriptDir, "..", "docs", "figures-rationale.json");

/** @type {Array<{ id: string; tags: string[]; vector: Record<string, number>; rationale: string }>} */
const rationaleRows = JSON.parse(readFileSync(jsonPath, "utf8"));
const figureById = new Map(FIGURES.map((figure) => [figure.id, figure]));
const issues = [];

if (rationaleRows.length !== FIGURES.length) {
  issues.push(
    `条数不一致：JSON ${rationaleRows.length} 条，figures.mjs ${FIGURES.length} 条`,
  );
}

const seenIds = new Set();
for (const row of rationaleRows) {
  if (seenIds.has(row.id)) issues.push(`重复 id：${row.id}`);
  seenIds.add(row.id);

  const figure = figureById.get(row.id);
  if (!figure) {
    issues.push(`JSON 中存在 figures.mjs 没有的 id：${row.id}`);
    continue;
  }

  if (!Array.isArray(row.tags) || row.tags.length < 2 || row.tags.length > 3) {
    issues.push(`${row.id}：tags 须为 2–3 个，实际 ${row.tags?.length ?? 0}`);
  }

  if (typeof row.rationale !== "string" || row.rationale.trim().length < 8) {
    issues.push(`${row.id}：rationale 过短或缺失`);
  }

  if (!row.vector || typeof row.vector !== "object") {
    issues.push(`${row.id}：缺少 vector`);
    continue;
  }

  for (const dimension of DIMENSIONS) {
    if (row.vector[dimension] !== figure.vector[dimension]) {
      issues.push(
        `${row.id}：${dimension} 不一致 JSON=${row.vector[dimension]} figures=${figure.vector[dimension]}`,
      );
    }
  }
}

for (const figure of FIGURES) {
  if (!seenIds.has(figure.id)) {
    issues.push(`figures.mjs 缺少 JSON 条目：${figure.id}`);
  }
  if (typeof figure.rationale !== "string" || figure.rationale.trim().length < 8) {
    issues.push(`${figure.id}：figures.mjs 中 rationale 未从 JSON 注入或为空`);
  }
}

console.log(`人物 rationale：${rationaleRows.length} 条（figures.mjs ${FIGURES.length} 人）`);

if (issues.length > 0) {
  console.log("\n✗ rationale 校验失败：");
  for (const issue of issues) console.log(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log("\n✓ 人物 rationale 校验通过。");
}
