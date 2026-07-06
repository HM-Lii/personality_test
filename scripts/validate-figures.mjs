import { FIGURES } from "../src/data/figures.mjs";

const DIMENSION_IDS = ["O", "C", "E", "A", "R"];
const BASE_SCORE_LEVELS = Array.from({ length: 16 }, (_, index) =>
  Math.round(50 + (40 * (-15 + index * 2)) / 15),
);

function vectorOf(figure) {
  return DIMENSION_IDS.map((id) => figure.vector[id]);
}

function squaredDistance(left, right) {
  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    const difference = (left[index] - right[index]) / 80;
    total += difference * difference;
  }
  return total / left.length;
}

function nearestTwo(scoreVector, vectors) {
  let firstIndex = -1;
  let secondIndex = -1;
  let firstDistance = Number.POSITIVE_INFINITY;
  let secondDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < vectors.length; index += 1) {
    const distance = squaredDistance(scoreVector, vectors[index]);
    if (distance < firstDistance) {
      secondIndex = firstIndex;
      secondDistance = firstDistance;
      firstIndex = index;
      firstDistance = distance;
    } else if (distance < secondDistance) {
      secondIndex = index;
      secondDistance = distance;
    }
  }

  return { firstIndex, secondIndex, firstDistance, secondDistance };
}

function exactReachability(vectors) {
  const winnerCounts = Array(vectors.length).fill(0);
  const marginSums = Array(vectors.length).fill(0);
  let tested = 0;

  for (const O of BASE_SCORE_LEVELS) {
    for (const C of BASE_SCORE_LEVELS) {
      for (const E of BASE_SCORE_LEVELS) {
        for (const A of BASE_SCORE_LEVELS) {
          for (const R of BASE_SCORE_LEVELS) {
            const nearest = nearestTwo([O, C, E, A, R], vectors);
            winnerCounts[nearest.firstIndex] += 1;
            marginSums[nearest.firstIndex] +=
              Math.sqrt(nearest.secondDistance) - Math.sqrt(nearest.firstDistance);
            tested += 1;
          }
        }
      }
    }
  }

  return { winnerCounts, marginSums, tested };
}

function createRandom(seed = 20260706) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function normalSample(random) {
  const first = Math.max(random(), Number.EPSILON);
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function plausibleDistribution(vectors, sampleCount = 200_000) {
  const random = createRandom();
  const winnerCounts = Array(vectors.length).fill(0);

  for (let sample = 0; sample < sampleCount; sample += 1) {
    const scoreVector = DIMENSION_IDS.map(() =>
      Math.min(90, Math.max(10, 50 + normalSample(random) * 17)),
    );
    winnerCounts[nearestTwo(scoreVector, vectors).firstIndex] += 1;
  }

  return winnerCounts;
}

function closestPairs(vectors, limit = 12) {
  const pairs = [];
  for (let first = 0; first < vectors.length; first += 1) {
    for (let second = first + 1; second < vectors.length; second += 1) {
      pairs.push({
        first,
        second,
        distance: Math.sqrt(squaredDistance(vectors[first], vectors[second])),
      });
    }
  }
  return pairs.sort((left, right) => left.distance - right.distance).slice(0, limit);
}

function validateShape() {
  const ids = new Set();
  const names = new Set();
  const issues = [];

  for (const figure of FIGURES) {
    if (ids.has(figure.id)) issues.push(`duplicate id: ${figure.id}`);
    if (names.has(figure.name)) issues.push(`duplicate name: ${figure.name}`);
    ids.add(figure.id);
    names.add(figure.name);

    for (const id of DIMENSION_IDS) {
      const value = figure.vector[id];
      if (!Number.isFinite(value) || value < 10 || value > 98) {
        issues.push(`${figure.name}.${id} is outside [10, 98]: ${value}`);
      }
    }
  }

  if (issues.length) {
    throw new Error(`Figure data validation failed:\n${issues.join("\n")}`);
  }
}

validateShape();

const vectors = FIGURES.map(vectorOf);
const exact = exactReachability(vectors);
const plausibleCounts = plausibleDistribution(vectors);
const rows = FIGURES.map((figure, index) => ({
  name: figure.name,
  era: figure.era,
  gridWins: exact.winnerCounts[index],
  gridShare: `${((exact.winnerCounts[index] / exact.tested) * 100).toFixed(3)}%`,
  normalWins: plausibleCounts[index],
  normalShare: `${((plausibleCounts[index] / 200_000) * 100).toFixed(3)}%`,
  meanMargin:
    exact.winnerCounts[index] === 0
      ? "—"
      : (exact.marginSums[index] / exact.winnerCounts[index]).toFixed(4),
})).sort((left, right) => left.gridWins - right.gridWins);

console.log(`人物候选数: ${FIGURES.length}`);
console.log(`穷举核心题可达分数组合: ${exact.tested.toLocaleString("en-US")}`);
console.table(rows);

console.log("\n最接近的人物向量：");
console.table(
  closestPairs(vectors).map((pair) => ({
    first: FIGURES[pair.first].name,
    second: FIGURES[pair.second].name,
    normalizedDistance: pair.distance.toFixed(4),
  })),
);

const unreachable = rows.filter((row) => row.gridWins === 0);
const extremelyRare = rows.filter((row) => row.normalWins < 50);
const closePairs = closestPairs(vectors, 100).filter((pair) => pair.distance < 0.065);

console.log("\n质量门槛：");
console.log(`- 不可达人物: ${unreachable.length}`);
console.log(`- 正态模拟中少于50次: ${extremelyRare.length}`);
console.log(`- 标准化距离小于0.065的人物对: ${closePairs.length}`);

if (unreachable.length || closePairs.length) {
  process.exitCode = 1;
}
