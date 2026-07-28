/**
 * Shared report-formatting helpers for validation and reporting scripts.
 *
 * Extracted from phase-a-report.mjs and validate-*.mjs to standardise
 * percentage formatting, pass/fail summaries, and baseline comparisons.
 */

/**
 * Formats a fraction as a percentage string with the given decimal precision.
 * `formatPercent(0.1783)` → `"17.83%"`.
 */
export function formatPercent(fraction, decimals = 2) {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/**
 * Formats a delta (current − baseline) as a signed percentage-point string.
 * `formatDelta(0.1783, 0.179)` → `"-0.07%"`.
 */
export function formatDelta(current, baseline, decimals = 2) {
  const delta = (current - baseline) * 100;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(decimals)}%`;
}

/**
 * Builds a comparison row for a baseline-vs-current table.
 */
export function comparisonRow(label, baselineValue, currentValue, format = formatPercent) {
  return {
    指标: label,
    基线: typeof baselineValue === "number" ? format(baselineValue) : String(baselineValue),
    当前: typeof currentValue === "number" ? format(currentValue) : String(currentValue),
    变化: typeof baselineValue === "number" && typeof currentValue === "number"
      ? formatDelta(currentValue, baselineValue)
      : "",
  };
}

/**
 * Runs a list of threshold checks and returns `{ checks, passed, failed }`.
 * Each check is `{ name, pass, detail, structural? }`.
 * Structural failures are soft (known limitations); hard failures set exitCode.
 */
export function runChecks(checks) {
  const failed = checks.filter((check) => !check.pass);
  const structuralFailures = failed.filter((check) => check.structural);
  const hardFailures = failed.filter((check) => !check.structural);
  return { checks, failed, structuralFailures, hardFailures };
}

/**
 * Prints a checks table and a summary verdict.
 * Returns `true` if all hard checks pass (structural failures are warnings only).
 */
export function printChecksReport(checks) {
  console.table(
    checks.map((check) => ({
      检查项: check.name,
      结果: check.pass ? "✓ 通过" : "✗ 不通过",
      实际: check.detail,
    })),
  );

  const { failed, structuralFailures, hardFailures } = runChecks(checks);

  if (hardFailures.length > 0) {
    console.log(
      `\n✗ ${hardFailures.length} 项硬门槛不达标。`,
    );
    return false;
  }
  if (structuralFailures.length > 0) {
    console.log(
      `\n⚠ 硬门槛 ${checks.length - structuralFailures.length}/${checks.length} 通过。` +
        ` ${structuralFailures.map((check) => check.name).join("、")} 为已知结构性限制。`,
    );
    return true;
  }
  console.log("\n✓ 验收门槛全部通过。");
  return true;
}
