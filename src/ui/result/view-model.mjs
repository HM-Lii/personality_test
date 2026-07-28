/**
 * Pure data derivation for the result page.
 *
 * Takes the raw quiz result and produces a plain object with everything the
 * section templates need. No DOM dependency — this can be unit-tested
 * directly and is the single place where result → display-data mapping
 * happens.
 */
import {
  buildReportId,
  compareTopCandidates,
  contrastDimensions,
  evidenceItems,
} from "../../core/result.mjs";
import { DIMENSIONS } from "../../data/catalog.mjs";

export function buildViewModel(state, result, deps) {
  const { dimensionMap, hashString } = deps;
  const primary = result.ranking[0];
  const secondary = result.ranking[1];
  const resultFigures = result.dual ? [primary, secondary] : [primary];
  const displayName = resultFigures.map((figure) => figure.name).join(" × ");
  const displayTitle = result.dual
    ? `${primary.archetype}，也带着一点${secondary.archetype}的影子`
    : primary.archetype;
  const tags = [...new Set(resultFigures.flatMap((figure) => figure.tags))].slice(
    0,
    4,
  );
  const comparison = compareTopCandidates(result);
  const evidence = evidenceItems(
    result,
    deps.questionMap,
    deps.dimensionMap,
    comparison,
  );
  const contrasts = contrastDimensions(result, primary);
  const decidingNames =
    comparison.decidingDimensions
      .map((dimension) => dimension.name)
      .join("、") || "各维度的合计差异";
  const secondaryAdvantageNames = comparison.secondaryAdvantages
    .map((dimension) => dimension.name)
    .join("、");
  const isContributionTie = Math.abs(comparison.netAdvantage) < 1e-9;
  const heroComparison = result.dual
    ? isContributionTie
      ? `${primary.name}与${secondary.name}的逐维排名贡献完全相抵，系统只按稳定顺序暂列先后，所以结果保留双原型。`
      : `在第一、第二候选的数值比较中，${decidingNames}让${primary.name}略微靠前，但差距不足以排除${secondary.name}，所以结果保留双原型。`
    : `在最接近的两位候选中，真正让${primary.name}胜出的维度是${decidingNames}；${secondary.name}${secondaryAdvantageNames ? `虽在${secondaryAdvantageNames}更接近你，但不足以抵消这些差距` : "没有在其他维度形成足以反超的优势"}。`;
  const confidenceLabels = {
    high: "较高",
    medium: "中等",
    low: "有限",
  };
  const historicalEvidence = resultFigures.flatMap((figure) =>
    figure.evidenceChains.map((chain) => ({ ...chain, figure })),
  );
  const sortedDimensions = DIMENSIONS.map((dimension) => ({
    ...dimension,
    score: result.scores[dimension.id],
    consistency: result.consistency[dimension.id],
  })).sort((left, right) => right.score - left.score);
  const highest = sortedDimensions[0];
  const lowest = sortedDimensions.at(-1);
  const flexible = [...sortedDimensions].sort(
    (left, right) => left.consistency - right.consistency,
  )[0];
  const reportId = buildReportId(state.completedAt, state.answers, hashString);

  return {
    primary,
    secondary,
    resultFigures,
    displayName,
    displayTitle,
    tags,
    comparison,
    evidence,
    contrasts,
    decidingNames,
    secondaryAdvantageNames,
    isContributionTie,
    heroComparison,
    confidenceLabels,
    historicalEvidence,
    sortedDimensions,
    highest,
    lowest,
    flexible,
    reportId,
    result,
    dimensionMap,
  };
}
