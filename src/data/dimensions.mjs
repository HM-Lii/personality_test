/**
 * Single source of truth for dimension IDs and scenario domains.
 *
 * `DIMENSION_IDS` is derived from the `DIMENSIONS` array in `scoring.mjs` so the
 * two can never drift apart. `DOMAINS` is the fixed set of five scenario domains
 * referenced by every question in the bank; validation scripts import it
 * instead of maintaining their own copy.
 */
import { DIMENSIONS } from "../core/scoring.mjs";

export const DIMENSION_IDS = DIMENSIONS.map((dimension) => dimension.id);

export const DOMAINS = [
  "工作与学习",
  "合作与关系",
  "冲突与压力",
  "新环境与不确定性",
  "个人恢复与长期选择",
];
