import {
  DIMENSIONS,
  calculateClarity,
  calculateConsistency,
  calculateScores,
  isDualArchetype,
  rankFigures,
  scoreDimension,
} from "./scoring.mjs";

export function toAnswerRecords(answers, questionMap) {
  return answers.map((answer) => ({
    ...answer,
    dimension: questionMap.get(answer.questionId)?.dimension,
  }));
}

export function buildTestResult(answers, { questionMap, figures, mirrorPairs }) {
  const records = toAnswerRecords(answers, questionMap);
  const scores = calculateScores(records);
  const consistency = calculateConsistency(records, mirrorPairs);
  const ranking = rankFigures(scores, figures, consistency);
  const calibrationCount = records.filter((record) =>
    record.questionId.includes("X"),
  ).length;

  return {
    records,
    scores,
    consistency,
    ranking,
    calibrationCount,
    clarity: calculateClarity(ranking, consistency),
    dual: isDualArchetype(ranking, calibrationCount),
  };
}

export function scoreBand(score) {
  if (score >= 65) return "high";
  if (score <= 35) return "low";
  return "middle";
}

const CONTRIBUTION_EPSILON = 1e-9;

/**
 * Explain the ranking with the same weighted squared differences used by
 * normalizedDistance. A positive advantage means that the dimension makes the
 * first candidate closer than the second candidate.
 */
export function compareTopCandidates(result) {
  const [primary, secondary] = result.ranking;
  if (!primary || !secondary) return null;

  const dimensions = DIMENSIONS.map((dimension, index) => {
    const score = result.scores[dimension.id] ?? 50;
    const weight = 0.8 + 0.2 * (result.consistency[dimension.id] ?? 0.75);
    const primaryGap = Math.abs(score - primary.vector[dimension.id]);
    const secondaryGap = Math.abs(score - secondary.vector[dimension.id]);
    const primaryContribution = weight * primaryGap ** 2;
    const secondaryContribution = weight * secondaryGap ** 2;

    return {
      ...dimension,
      index,
      score,
      weight,
      primaryTarget: primary.vector[dimension.id],
      secondaryTarget: secondary.vector[dimension.id],
      primaryGap,
      secondaryGap,
      advantage: secondaryContribution - primaryContribution,
    };
  });
  const primaryAdvantages = dimensions
    .filter((item) => item.advantage > CONTRIBUTION_EPSILON)
    .sort(
      (left, right) =>
        right.advantage - left.advantage || left.index - right.index,
    );
  const secondaryAdvantages = dimensions
    .filter((item) => item.advantage < -CONTRIBUTION_EPSILON)
    .sort(
      (left, right) =>
        left.advantage - right.advantage || left.index - right.index,
    );
  const positiveAdvantage = primaryAdvantages.reduce(
    (sum, item) => sum + item.advantage,
    0,
  );
  const opposingAdvantage = secondaryAdvantages.reduce(
    (sum, item) => sum - item.advantage,
    0,
  );
  let accumulatedAdvantage = 0;
  const decidingDimensions = [];

  for (const item of primaryAdvantages) {
    decidingDimensions.push(item);
    accumulatedAdvantage += item.advantage;
    if (accumulatedAdvantage > opposingAdvantage + CONTRIBUTION_EPSILON) break;
  }

  return {
    primary,
    secondary,
    dimensions,
    primaryAdvantages,
    secondaryAdvantages,
    decidingDimensions,
    positiveAdvantage,
    opposingAdvantage,
    netAdvantage: dimensions.reduce((sum, item) => sum + item.advantage, 0),
  };
}

export function evidenceItems(
  result,
  questionMap,
  dimensionMap,
  comparison = compareTopCandidates(result),
) {
  if (!comparison) return [];

  const dimensionRank = new Map(
    comparison.primaryAdvantages.map((item, index) => [item.id, index]),
  );
  const candidates = result.records
    .map((record, recordIndex) => {
      const question = questionMap.get(record.questionId);
      const option = question?.options.find(
        (item) => item.id === record.optionId,
      );
      const comparisonDimension = comparison.dimensions.find(
        (item) => item.id === record.dimension,
      );
      const dimension = dimensionMap.get(record.dimension);
      if (!question || !option || !comparisonDimension || !dimension) {
        return null;
      }

      const scoreWithoutAnswer = scoreDimension(
        result.records
          .filter(
            (otherRecord, otherIndex) =>
              otherIndex !== recordIndex &&
              otherRecord.dimension === record.dimension,
          )
          .map((otherRecord) => otherRecord.value),
      );
      const primaryGapWithoutAnswer = Math.abs(
        scoreWithoutAnswer - comparisonDimension.primaryTarget,
      );
      const secondaryGapWithoutAnswer = Math.abs(
        scoreWithoutAnswer - comparisonDimension.secondaryTarget,
      );
      const advantageWithoutAnswer =
        comparisonDimension.weight *
        (secondaryGapWithoutAnswer ** 2 - primaryGapWithoutAnswer ** 2);
      const answerAdvantage =
        comparisonDimension.advantage - advantageWithoutAnswer;
      const direction = record.value > 0 ? dimension.high : dimension.low;
      const intensity = Math.abs(record.value) === 3 ? "明显" : "略微";

      return {
        ...record,
        question,
        option,
        dimension,
        comparisonDimension,
        answerAdvantage,
        scoreWithoutAnswer,
        tendency: `${intensity}偏向“${direction}”`,
        supportReason: `计入这道回答后，${dimension.name}从其余回答单独计算的 ${scoreWithoutAnswer} 分变为 ${comparisonDimension.score} 分，并扩大了${comparison.primary.name}相对${comparison.secondary.name}的排名优势；当前得分距两人原型分别为 ${Math.round(comparisonDimension.primaryGap)} 分和 ${Math.round(comparisonDimension.secondaryGap)} 分。`,
      };
    })
    .filter(
      (record) =>
        record &&
        dimensionRank.has(record.dimension.id) &&
        record.answerAdvantage > CONTRIBUTION_EPSILON,
    )
    .sort(
      (first, second) =>
        dimensionRank.get(first.dimension.id) -
          dimensionRank.get(second.dimension.id) ||
        Number(second.questionId.includes("X")) -
          Number(first.questionId.includes("X")) ||
        second.answerAdvantage - first.answerAdvantage,
    );

  const picked = [];
  const usedDimensions = new Set();
  for (const candidate of candidates) {
    if (usedDimensions.has(candidate.dimension.id)) continue;
    picked.push(candidate);
    usedDimensions.add(candidate.dimension.id);
    if (picked.length === 3) break;
  }

  if (picked.length < 3) {
    for (const candidate of candidates) {
      if (picked.includes(candidate)) continue;
      picked.push(candidate);
      if (picked.length === 3) break;
    }
  }

  return picked;
}

export function contrastDimensions(result, figure = result.ranking[0], limit = 2) {
  if (!figure) return [];

  return DIMENSIONS.map((dimension, index) => {
    const score = result.scores[dimension.id] ?? 50;
    const target = figure.vector[dimension.id];
    return {
      ...dimension,
      index,
      score,
      target,
      gap: Math.abs(score - target),
      userLeansToward: score > target ? dimension.high : dimension.low,
      figureLeansToward: score > target ? dimension.low : dimension.high,
    };
  })
    .filter((item) => item.gap > CONTRIBUTION_EPSILON)
    .sort((left, right) => right.gap - left.gap || left.index - right.index)
    .slice(0, Math.max(0, limit));
}

export function buildReportId(completedAt, answers, hashString) {
  return `FA-${completedAt?.slice(0, 10).replaceAll("-", "") ?? "LOCAL"}-${hashString(
    answers.map((answer) => answer.optionId).join(""),
  )
    .toString(16)
    .slice(0, 4)
    .toUpperCase()}`;
}
