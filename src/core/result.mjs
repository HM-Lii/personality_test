import {
  DIMENSIONS,
  calculateClarity,
  calculateConsistency,
  calculateScores,
  isDualArchetype,
  rankFigures,
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

export function matchReasons(result, figures) {
  const shared = DIMENSIONS.map((dimension) => {
    const averageTarget =
      figures.reduce((sum, figure) => sum + figure.vector[dimension.id], 0) /
      figures.length;
    return {
      ...dimension,
      difference: Math.abs(result.scores[dimension.id] - averageTarget),
      score: result.scores[dimension.id],
    };
  })
    .sort((left, right) => left.difference - right.difference)
    .slice(0, 3);

  return shared
    .map(
      (item) =>
        `${item.name} ${item.score}（和原型差 ${Math.round(item.difference)}）`,
    )
    .join("、");
}

export function evidenceItems(result, questionMap, dimensionMap) {
  const candidates = result.records
    .map((record) => ({
      ...record,
      question: questionMap.get(record.questionId),
      option: questionMap
        .get(record.questionId)
        ?.options.find((item) => item.id === record.optionId),
    }))
    .filter((record) => record.question && record.option)
    .sort((first, second) => Math.abs(second.value) - Math.abs(first.value));

  const picked = [];
  const usedDimensions = new Set();
  for (const candidate of candidates) {
    if (usedDimensions.has(candidate.dimension)) continue;
    picked.push(candidate);
    usedDimensions.add(candidate.dimension);
    if (picked.length === 3) break;
  }

  return picked;
}

export function buildReportId(completedAt, answers, hashString) {
  return `FA-${completedAt?.slice(0, 10).replaceAll("-", "") ?? "LOCAL"}-${hashString(
    answers.map((answer) => answer.optionId).join(""),
  )
    .toString(16)
    .slice(0, 4)
    .toUpperCase()}`;
}
