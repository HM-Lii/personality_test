import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  CALIBRATION_QUESTIONS,
  CORE_QUESTIONS,
} from "../src/data/questions.mjs";

const DIMENSIONS = ["O", "C", "E", "A", "R"];
const DOMAINS = [
  "工作与学习",
  "合作与关系",
  "冲突与压力",
  "新环境与不确定性",
  "个人恢复与长期选择",
];
const REQUIRED_HEADERS = [
  "id",
  "dimension",
  "domain",
  "primary_facet",
  "secondary_facet",
  "high_pole_behavior",
  "low_pole_behavior",
  "forbidden_load",
  "value_monotonic",
  "cross_load_risk",
  "status",
];
const VALID_RISK = ["green", "yellow", "red"];
const VALID_STATUS = ["pass", "revise", "replace"];
const VALID_MONOTONIC = ["Y", "需改"];
const R_FACET_REQUIREMENTS = [
  "Anxiety",
  "Self-Consciousness",
  "Vulnerability",
];
const MIN_FACETS_PER_DIMENSION = 3;
const MAX_QUESTIONS_PER_FACET = 3;
const FACET_OVERLOAD_TOLERANCE = 1;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const csvPath = join(scriptDir, "..", "docs", "construct-matrix.csv");

function parseCsvRow(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function readMatrix() {
  const raw = readFileSync(csvPath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    throw new Error(`构念矩阵为空：${csvPath}`);
  }
  const headers = parseCsvRow(lines[0]);
  for (const required of REQUIRED_HEADERS) {
    if (!headers.includes(required)) {
      throw new Error(`构念矩阵缺少字段：${required}`);
    }
  }
  const rows = lines.slice(1).map((line, rowIndex) => {
    const fields = parseCsvRow(line);
    const row = {};
    headers.forEach((header, headerIndex) => {
      row[header] = (fields[headerIndex] ?? "").trim();
    });
    row._row = rowIndex + 2;
    return row;
  });
  return rows;
}

const issues = [];
const warnings = [];

const coreMap = new Map(CORE_QUESTIONS.map((question) => [question.id, question]));
const calibrationMap = new Map(
  CALIBRATION_QUESTIONS.map((question) => [question.id, question]),
);
const allMap = new Map([...coreMap, ...calibrationMap]);

let rows = [];
try {
  rows = readMatrix();
} catch (error) {
  console.error(error.message);
  console.error(
    "\n请先按 docs/PHASE_A.md 任务 1 填写 docs/construct-matrix.csv。",
  );
  process.exitCode = 1;
  process.exit(process.exitCode);
}

if (rows.length !== REQUIRED_HEADERS.length && rows.length !== 40) {
  // 不强制 40，只提示
}

if (rows.length < 40) {
  warnings.push(
    `矩阵行数 ${rows.length}，未达 40 题（25 核心 + 15 辨析）；阶段 A 完成前需补齐。`,
  );
}

const seenIds = new Set();
for (const row of rows) {
  const question = allMap.get(row.id);
  if (!row.id) {
    issues.push(`第 ${row._row} 行缺少 id`);
    continue;
  }
  if (seenIds.has(row.id)) {
    issues.push(`矩阵 id 重复：${row.id}`);
  }
  seenIds.add(row.id);

  if (!question) {
    issues.push(`矩阵 id 在题库中不存在：${row.id}`);
    continue;
  }

  if (!DIMENSIONS.includes(row.dimension)) {
    issues.push(`${row.id} dimension 非法：${row.dimension || "(空)"}`);
  } else if (row.dimension !== question.dimension) {
    issues.push(
      `${row.id} dimension 与题库不符：矩阵=${row.dimension}，题库=${question.dimension}`,
    );
  }

  if (!DOMAINS.includes(row.domain)) {
    issues.push(`${row.id} domain 非法：${row.domain || "(空)"}`);
  } else if (row.domain !== question.domain) {
    issues.push(
      `${row.id} domain 与题库不符：矩阵=${row.domain}，题库=${question.domain}`,
    );
  }

  if (!row.primary_facet) {
    issues.push(`${row.id} primary_facet 为空`);
  }
  if (!row.forbidden_load) {
    issues.push(`${row.id} forbidden_load 为空`);
  }
  if (row.value_monotonic && !VALID_MONOTONIC.includes(row.value_monotonic)) {
    issues.push(
      `${row.id} value_monotonic 非法：${row.value_monotonic}（应为 Y / 需改）`,
    );
  }
  if (row.cross_load_risk && !VALID_RISK.includes(row.cross_load_risk)) {
    issues.push(
      `${row.id} cross_load_risk 非法：${row.cross_load_risk}（应为 green / yellow / red）`,
    );
  }
  if (row.status && !VALID_STATUS.includes(row.status)) {
    issues.push(
      `${row.id} status 非法：${row.status}（应为 pass / revise / replace）`,
    );
  }
}

const redCount = rows.filter((row) => row.cross_load_risk === "red").length;
if (redCount > 0) {
  issues.push(`串维 red 标记 ${redCount} 处，要求 = 0`);
}

// facet 覆盖审计只针对 25 道核心题
const coreRows = rows.filter((row) => coreMap.has(row.id));
const missingCoreIds = CORE_QUESTIONS.filter(
  (question) => !seenIds.has(question.id),
).map((question) => question.id);
if (missingCoreIds.length > 0) {
  issues.push(`核心题未进矩阵：${missingCoreIds.join(", ")}`);
}

const facetCoverage = {};
const facetOverload = [];
for (const dimension of DIMENSIONS) {
  const dimRows = coreRows.filter((row) => row.dimension === dimension);
  const facets = dimRows
    .filter((row) => row.primary_facet)
    .map((row) => row.primary_facet);
  const facetSet = new Set(facets);
  facetCoverage[dimension] = {
    facetCount: facetSet.size,
    facets: [...facetSet],
  };
  if (facetSet.size < MIN_FACETS_PER_DIMENSION) {
    warnings.push(
      `${dimension} 维 facet 覆盖 ${facetSet.size}，要求 ≥ ${MIN_FACETS_PER_DIMENSION}（现有：${facets.join(" / ") || "无"}）；按优先级表可记入缺口清单而非硬凑`,
    );
  }
  const facetCounts = {};
  for (const facet of facets) {
    facetCounts[facet] = (facetCounts[facet] ?? 0) + 1;
  }
  for (const [facet, count] of Object.entries(facetCounts)) {
    if (count > MAX_QUESTIONS_PER_FACET) {
      facetOverload.push(`${dimension}.${facet}=${count}`);
    }
  }
}
if (facetOverload.length > FACET_OVERLOAD_TOLERANCE) {
  issues.push(
    `同一 facet 超过 ${MAX_QUESTIONS_PER_FACET} 题且超出豁免额 ${FACET_OVERLOAD_TOLERANCE}：${facetOverload.join(", ")}`,
  );
} else if (facetOverload.length > 0) {
  warnings.push(`facet 集中超豁免额内：${facetOverload.join(", ")}（需书面备注）`);
}

const rFacetRows = coreRows.filter(
  (row) =>
    row.dimension === "R" &&
    R_FACET_REQUIREMENTS.some((facet) =>
      row.primary_facet?.toLowerCase().includes(facet.toLowerCase()),
    ),
);
if (rFacetRows.length < 2) {
  issues.push(
    `R 维 primary_facet 落在 Anxiety / Self-Consciousness / Vulnerability 的题数 = ${rFacetRows.length}，要求 ≥ 2`,
  );
}

const calibrationRows = rows.filter((row) => calibrationMap.has(row.id));
const missingCalibrationIds = CALIBRATION_QUESTIONS.filter(
  (question) => !seenIds.has(question.id),
).map((question) => question.id);
if (missingCalibrationIds.length > 0) {
  warnings.push(
    `辨析题未进矩阵（仍可补）：${missingCalibrationIds.join(", ")}`,
  );
}

console.log(`构念矩阵：${rows.length} 行（核心 ${coreRows.length} / 辨析 ${calibrationRows.length}）`);
console.log("\nfacet 覆盖（仅核心题）：");
console.table(facetCoverage);

if (warnings.length > 0) {
  console.log("\n警告：");
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (issues.length > 0) {
  console.log("\n✗ 构念矩阵校验失败：");
  for (const issue of issues) console.log(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log("\n✓ 构念矩阵校验通过。");
}
