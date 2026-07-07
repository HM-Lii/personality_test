import {
  DIMENSIONS,
  calculateClarity,
  calculateConsistency,
  calculateScores,
  isDualArchetype,
  needsCalibration,
  rankFigures,
  selectCalibrationDimension,
} from "./src/core/scoring.mjs";
import { prepareAnswerUpdate } from "./src/core/session.mjs";
import { FIGURES } from "./src/data/figures.mjs";
import {
  CALIBRATION_QUESTIONS,
  CORE_QUESTIONS,
  MIRROR_PAIRS,
} from "./src/data/questions.mjs";

const STORAGE_KEY = "figure-atlas-state-v2";
const app = document.querySelector("#app");
const methodDialog = document.querySelector("#methodDialog");
const toast = document.querySelector("#toast");
const allQuestions = [...CORE_QUESTIONS, ...CALIBRATION_QUESTIONS];
const questionMap = new Map(allQuestions.map((question) => [question.id, question]));
const dimensionMap = new Map(DIMENSIONS.map((dimension) => [dimension.id, dimension]));

const dimensionCopy = {
  O: {
    high: "你愿让陌生的信息流入判断，常从假设、变化与跨界之处拾得灵光。新思路于你不是负担，而是一种兴致。你习惯把边界推出去，再看看外面还能看见什么。",
    middle: "你在新鲜与可用之间游走：值得探索时推开边界，需要交付时回到眼前。你不会为“新”而新，也不会为“稳”而守——两端的轻重，随眼前的事而定。",
    low: "你偏爱经过验证、能落地的方法，惯于把心神留给真正待解的问题。熟悉的方式让你省力，也让你能把力气花在刀刃上。不追新，不等于不思考。",
    stretchHigh: "给新念头留一个可回退的小试验，别让探索一口气占尽所有余裕。试错可以，但要小到错了也无妨。",
    stretchLow: "每周给一个陌生的观点十分钟，不必采纳，只练着去懂它为何成立。不是为了改变，是为了不让自己的世界悄悄收窄。",
  },
  C: {
    high: "你惯于把承诺化作结构，借计划、复查与持续投入，让事情少一分失控。你相信节奏比冲劲更靠得住，也愿意为“按部就班”支付当下的克制。",
    middle: "你既搭得起必要的框架，也肯依现场调整节奏，不拘于一种走法。计划是给你指路的手电，不是捆住脚的绳。",
    low: "你对现场变化反应捷，惯于留出选择的余地，让路径随真实信息一点点显出来。你信的是“边走边看”，而非“想好再动”。",
    stretchHigh: "分清“必须做到”与“可以更好”，给非关键处留一条够用的完成线。不是所有事都值得你用全力。",
    stretchLow: "只为眼下最要紧的事立一个固定的节点，不必把整段生活都纳入计划。秩序是一点一点长出来的，不必一次成形。",
  },
  E: {
    high: "你常以表达与互动启动思路，也愿在人群里主动造起节奏与联结。你的能量是在往来中越用越多，独处太久反而钝。",
    middle: "你入得人群，也需独处梳理；能量的来处，随对象与场景而变。你不必选一边，懂在两间换挡就好。",
    low: "你更惯于先观察、独自消化，待准备充足或关系深入时，再一并说出。沉默不是不在场，是在心里先想清楚。",
    stretchHigh: "重要讨论前留一段无输入的空当，让尚未出口的判断有机会成形。你的好想法，常常需要一个安静的前奏。",
    stretchLow: "下一次小组讨论，预先备好一句开场，让自己的信息早一步进入现场。开口不必多，先到即可。",
  },
  A: {
    high: "你自然而然看见他人的处境与共同的利益，善于以理解与协调，维系长久的合作。你信“都过得去”比“我赢了”更值得。",
    middle: "你顾得关系，也立得住立场，多依合作的远近与问题的性质来取舍。柔与刚之间，你按情况拨到合适的档。",
    low: "你更愿把原则、标准与真实的分歧摆上台面，不轻易以表面的和气替掉判断。你信“先把话说清”，比“留个面子”更护关系。",
    stretchHigh: "应承之前，先说出自己的真实代价；清楚的边界，往往比事后的消耗更护着关系。答应得慢一点，关系才长一点。",
    stretchLow: "提出异议前，先复述对方真正在意的点；准确的理解，并不会削去你的立场。被听懂的人，才更愿听你。",
  },
  R: {
    high: "在不确定与压力里，你大抵能稳住行动的节奏，较快把心神转回可处理之处。风浪于你不是停顿的理由，而是收回注意力的信号。",
    middle: "你感知得到风险与情绪的波动，也拿得回在信息充足时继续推进的能力。你会乱一阵，但乱完还能站回来。",
    low: "你对风险、评价与变化的信号更敏，常比旁人更早看见潜藏的问题与关系的起伏。这份敏不是脆弱，是一种先于他人的预警。",
    stretchHigh: "重大决定前，主动请一个谨慎的人替你看看盲点；稳定，并不等于风险不在。稳的人，也需要一面能照出暗处的镜子。",
    stretchLow: "压力来时，先分清“已发生”与“可能发生”，只动第一栏里最小的那一步。把大雾拆成一缕一缕，才看得见路。",
  },
};

const initialQueue = () => CORE_QUESTIONS.map((question) => question.id);

function freshState() {
  return {
    view: "home",
    queue: initialQueue(),
    index: 0,
    answers: [],
    completedAt: null,
  };
}

function restoreState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (
      stored &&
      ["home", "quiz", "result"].includes(stored.view) &&
      Array.isArray(stored.answers) &&
      Array.isArray(stored.queue)
    ) {
      return { ...freshState(), ...stored };
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return freshState();
}

let state = restoreState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function displayedOptions(question) {
  const items = [...question.options];
  let seed = hashString(`figure-atlas:${question.id}`);
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    [items[index], items[swapWith]] = [items[swapWith], items[index]];
  }
  return items;
}

function currentQuestion() {
  return questionMap.get(state.queue[state.index]);
}

function getAnswer(questionId) {
  return state.answers.find((answer) => answer.questionId === questionId);
}

function answerRecords() {
  return state.answers.map((answer) => ({
    ...answer,
    dimension: questionMap.get(answer.questionId)?.dimension,
  }));
}

function calculateResult() {
  const records = answerRecords();
  const scores = calculateScores(records);
  const consistency = calculateConsistency(records, MIRROR_PAIRS);
  const ranking = rankFigures(scores, FIGURES, consistency);
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

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function goHome() {
  state.view = "home";
  saveState();
  render();
}

function startNew() {
  state = { ...freshState(), view: "quiz" };
  saveState();
  render();
}

function resumeQuiz() {
  state.view = state.completedAt ? "result" : "quiz";
  saveState();
  render();
}

function finishResult() {
  state.view = "result";
  state.completedAt = new Date().toISOString();
  saveState();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function appendCalibrationOrFinish() {
  const result = calculateResult();
  if (!needsCalibration(result.ranking, result.calibrationCount)) {
    finishResult();
    return;
  }

  const usedDimensions = state.queue
    .slice(CORE_QUESTIONS.length)
    .map((id) => questionMap.get(id)?.dimension)
    .filter(Boolean);
  const dimension = selectCalibrationDimension(result.ranking, usedDimensions);
  const nextQuestion = CALIBRATION_QUESTIONS.find(
    (question) =>
      question.dimension === dimension && !state.queue.includes(question.id),
  );

  if (!nextQuestion) {
    finishResult();
    return;
  }

  state.queue.push(nextQuestion.id);
  state.index += 1;
  saveState();
  render();
}

function selectAnswer(questionId, optionId) {
  const question = questionMap.get(questionId);
  const selected = question?.options.find((item) => item.id === optionId);
  if (!question || !selected) return;

  const prepared = prepareAnswerUpdate({
    queue: state.queue,
    answers: state.answers,
    index: state.index,
    questionId,
    coreQuestionIds: CORE_QUESTIONS.map((item) => item.id),
  });
  state.queue = prepared.queue;
  state.answers = prepared.answers;
  state.answers.push({
    questionId,
    optionId,
    value: selected.value,
  });
  saveState();

  const selectedButton = app.querySelector(`[data-option-id="${optionId}"]`);
  selectedButton?.classList.add("selected");

  window.setTimeout(() => {
    if (state.index < CORE_QUESTIONS.length - 1) {
      state.index += 1;
      saveState();
      render();
      return;
    }
    appendCalibrationOrFinish();
  }, 180);
}

function previousQuestion() {
  if (state.index === 0) {
    goHome();
    return;
  }
  state.index -= 1;
  saveState();
  render();
}

function renderHome() {
  const answeredCore = state.answers.filter((answer) =>
    CORE_QUESTIONS.some((question) => question.id === answer.questionId),
  ).length;
  const canResume = answeredCore > 0 || state.completedAt;

  app.innerHTML = `
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <span class="eyebrow">HISTORICAL PERSONA · OPEN METHOD</span>
        <h1 id="hero-title">在历史里，<br><em>你最像谁</em>？</h1>
        <p class="hero-lead">
          25个生活里的情境，看看你面对选择时是什么风格。
          我们不贴标签、不搞玄学，每一步计分都摆出来给你看，最后从57位古人里找到和你最像的那一个。
        </p>
        <div class="hero-actions">
          <button class="primary-button" type="button" data-action="start">
            ${canResume ? "重新测试" : "开始测试"}<span class="arrow">→</span>
          </button>
          ${
            canResume
              ? `<button class="plain-link" type="button" data-action="resume">${
                  state.completedAt
                    ? "看看上次的结果"
                    : `接着上次做 · ${answeredCore}/25`
                }</button>`
              : `<button class="plain-link" type="button" data-action="method">先看看怎么算</button>`
          }
        </div>
        <div class="hero-meta" aria-label="测试信息">
          <span><strong>25–28</strong>道题</span>
          <span><strong>5</strong>个维度</span>
          <span><strong>57</strong>位古人</span>
          <span><strong>0</strong>条答案上传</span>
        </div>
      </div>
      <div class="atlas" aria-hidden="true">
        <div class="orbit"></div>
        <div class="seal seal-main"><span>未见之我</span></div>
        <div class="seal seal-one"><span>苏轼</span></div>
        <div class="seal seal-two"><span>张良</span></div>
        <div class="seal seal-three"><span>李清照</span></div>
        <div class="seal seal-four"><span>王阳明</span></div>
      </div>
      <span class="hero-side-text" aria-hidden="true">以史为镜　可见己形</span>
    </section>
  `;
}

function renderQuiz() {
  const question = currentQuestion();
  if (!question) {
    state = freshState();
    saveState();
    renderHome();
    return;
  }

  const isCalibration = state.index >= CORE_QUESTIONS.length;
  const calibrationNumber = state.index - CORE_QUESTIONS.length + 1;
  const progress = isCalibration
    ? 100
    : Math.round(((state.index + 1) / CORE_QUESTIONS.length) * 100);
  const selectedAnswer = getAnswer(question.id);
  const options = displayedOptions(question);

  app.innerHTML = `
    <section class="quiz-shell" aria-labelledby="question-title">
      <div class="quiz-topline">
        <button class="back-button" type="button" data-action="previous" aria-label="上一题">←</button>
        <div class="progress-track" aria-label="测试进度">
          <div class="progress-bar" style="width:${progress}%"></div>
        </div>
        <span class="progress-count">${
          isCalibration
            ? `辨析 ${calibrationNumber}/3`
            : `${String(state.index + 1).padStart(2, "0")} / 25`
        }</span>
      </div>

      <article class="question-card" data-question-id="${question.id}">
        <div class="question-number">
          ${isCalibration ? "辨析题" : escapeHtml(question.domain)}
        </div>
        <h1 id="question-title">${escapeHtml(question.title)}</h1>
        <p class="question-context">${escapeHtml(question.context)}</p>

        <div class="options" role="group" aria-label="选择最接近你真实反应的一项">
          ${options
            .map(
              (item, index) => `
                <button
                  class="option ${selectedAnswer?.optionId === item.id ? "selected" : ""}"
                  type="button"
                  data-action="answer"
                  data-option-id="${item.id}"
                  aria-pressed="${selectedAnswer?.optionId === item.id}"
                >
                  <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                  <span class="option-text">${escapeHtml(item.text)}</span>
                  <span class="option-arrow">→</span>
                </button>
              `,
            )
            .join("")}
        </div>
        <p class="question-hint">没有标准答案。选你平时真的会做的，而不是你希望自己能做到的。</p>
      </article>
    </section>
  `;
  requestAnimationFrame(() => app.focus({ preventScroll: true }));
}

function scoreBand(score) {
  if (score >= 65) return "high";
  if (score <= 35) return "low";
  return "middle";
}

function polygonPoints(radius, center = 200) {
  return DIMENSIONS.map((_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / DIMENSIONS.length;
    return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
  }).join(" ");
}

function radarSvg(scores) {
  const center = 200;
  const radius = 126;
  const points = DIMENSIONS.map(({ id }, index) => {
    const normalized = (scores[id] - 10) / 80;
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / DIMENSIONS.length;
    return {
      id,
      x: center + Math.cos(angle) * radius * normalized,
      y: center + Math.sin(angle) * radius * normalized,
      labelX: center + Math.cos(angle) * 166,
      labelY: center + Math.sin(angle) * 166,
      axisX: center + Math.cos(angle) * radius,
      axisY: center + Math.sin(angle) * radius,
    };
  });

  return `
    <svg class="radar" viewBox="0 0 400 400" role="img" aria-label="五维人格雷达图">
      ${[0.25, 0.5, 0.75, 1]
        .map(
          (level) =>
            `<polygon class="radar-grid" points="${polygonPoints(radius * level)}"></polygon>`,
        )
        .join("")}
      ${points
        .map(
          (point) =>
            `<line class="radar-axis" x1="${center}" y1="${center}" x2="${point.axisX}" y2="${point.axisY}"></line>`,
        )
        .join("")}
      <polygon class="radar-area" points="${points
        .map((point) => `${point.x},${point.y}`)
        .join(" ")}"></polygon>
      ${points
        .map(
          (point) =>
            `<circle class="radar-dot" cx="${point.x}" cy="${point.y}" r="4"></circle>`,
        )
        .join("")}
      ${points
        .map((point) => {
          const dimension = dimensionMap.get(point.id);
          const anchor = point.labelX < 180 ? "end" : point.labelX > 220 ? "start" : "middle";
          const yOffset = point.labelY < 80 ? -8 : point.labelY > 320 ? 15 : 0;
          return `
            <text class="radar-label" x="${point.labelX}" y="${point.labelY + yOffset}" text-anchor="${anchor}">
              ${dimension.name}
            </text>
            <text class="radar-score" x="${point.labelX}" y="${point.labelY + yOffset + 18}" text-anchor="${anchor}">
              ${scores[point.id]}
            </text>
          `;
        })
        .join("")}
    </svg>
  `;
}

function matchReasons(result, figures) {
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

function evidenceItems(result) {
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

function renderResult() {
  const result = calculateResult();
  const primary = result.ranking[0];
  const secondary = result.ranking[1];
  const resultFigures = result.dual ? [primary, secondary] : [primary];
  const displayName = resultFigures.map((figure) => figure.name).join(" × ");
  const displayTitle = result.dual
    ? `${primary.archetype}，也带着一点${secondary.archetype}的影子`
    : primary.archetype;
  const tags = [...new Set(resultFigures.flatMap((figure) => figure.tags))].slice(0, 4);
  const evidence = evidenceItems(result);
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
  const reportId = `FA-${state.completedAt?.slice(0, 10).replaceAll("-", "") ?? "LOCAL"}-${hashString(
    state.answers.map((answer) => answer.optionId).join(""),
  )
    .toString(16)
    .slice(0, 4)
    .toUpperCase()}`;

  app.innerHTML = `
    <section class="result-page" aria-labelledby="result-name">
      <div class="result-masthead">
        <span class="eyebrow">YOUR FIGURE ATLAS</span>
        <span class="result-id">${reportId}</span>
      </div>

      <article class="result-hero" data-character="${escapeHtml(primary.name.at(0))}">
        <span class="result-stamp" aria-hidden="true">${escapeHtml(primary.name.at(0))}</span>
        <div class="result-copy">
          <span class="eyebrow result-kicker">${
            result.dual ? "双原型 · 看情境而定" : escapeHtml(primary.era)
          }</span>
          <h1 class="result-name ${result.dual ? "result-name-dual" : ""}" id="result-name">
            ${escapeHtml(displayName)}
          </h1>
          <p class="result-title">${escapeHtml(displayTitle)}</p>
          <div class="tags">
            ${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
          <div class="figure-bio">
            ${
              result.dual
                ? resultFigures
                    .map(
                      (figure) =>
                        `<p class="bio-line"><span class="bio-name">${escapeHtml(figure.name)}</span>${escapeHtml(figure.bio)}</p>`,
                    )
                    .join("")
                : `<p class="bio-line">${escapeHtml(primary.bio)}</p>`
            }
          </div>
          <p class="result-quote">
            你和${escapeHtml(displayName)}最像的地方，主要在${escapeHtml(
              matchReasons(result, resultFigures),
            )}。古人只是个比喻，真正的结果是右边这张根据你的选择算出来的五维画像。
          </p>
          <span class="clarity">
            匹配清晰度 <strong>${escapeHtml(result.clarity.band)}</strong>
            · 做了${result.calibrationCount}道辨析题
          </span>
        </div>
        <div class="radar-wrap">${radarSvg(result.scores)}</div>
      </article>

      <div class="report-grid">
        <article class="report-card report-card-large">
          <span class="eyebrow">01 · YOUR PROFILE</span>
          <h2>这不是在排能力高低</h2>
          <p>分数只是说你在两种风格里更偏哪一边。分高分低不分好坏，也不代表你超过多少人。</p>
          <div class="dimension-list">
            ${DIMENSIONS.map((dimension) => {
              const score = result.scores[dimension.id];
              return `
                <div class="dimension-row">
                  <span>${dimension.name}</span>
                  <div class="dimension-bar"><i style="width:${score}%"></i></div>
                  <strong>${score}</strong>
                </div>
              `;
            }).join("")}
          </div>
        </article>

        <article class="report-card report-card-side">
          <span class="eyebrow">02 · INTERPRETATION</span>
          <h2>你是怎么选的</h2>
          <div class="evidence-list">
            ${sortedDimensions
              .slice(0, 3)
              .map((dimension, index) => {
                const band = scoreBand(dimension.score);
                return `
                  <div class="evidence-item">
                    <span class="evidence-index">0${index + 1}</span>
                    <div>
                      <strong>${dimension.name} · ${dimension.score}</strong>
                      <p>${dimensionCopy[dimension.id][band]}</p>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </article>

        <article class="report-card report-card-large">
          <span class="eyebrow">03 · ANSWER EVIDENCE</span>
          <h2>为什么是这个人</h2>
          <p>下面三条都来自你刚才的真实选择，不是套用哪个人物的现成话。</p>
          <div class="evidence-list">
            ${evidence
              .map((item, index) => {
                const dimension = dimensionMap.get(item.dimension);
                const direction = item.value > 0 ? dimension.high : dimension.low;
                return `
                  <div class="evidence-item">
                    <span class="evidence-index">${String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>${escapeHtml(item.question.title)}</strong>
                      <p>“${escapeHtml(item.option.text)}”——选这个，更接近：${escapeHtml(
                        direction,
                      )}。</p>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </article>

        <article class="report-card report-card-side">
          <span class="eyebrow">04 · NEARBY FIGURES</span>
          <h2>和你接近的还有谁</h2>
          <p>这里的接近度只是拿这几个候选互相比较，不代表测试有多准。</p>
          <div class="nearby-grid">
            ${result.ranking
              .slice(result.dual ? 2 : 1, result.dual ? 5 : 4)
              .map(
                (figure) => `
                  <div class="nearby">
                    <strong>${escapeHtml(figure.name)}</strong>
                    <span>${escapeHtml(figure.archetype)}</span>
                    <div class="nearby-bar"><i style="width:${figure.similarity}%"></i></div>
                  </div>
                `,
              )
              .join("")}
          </div>
        </article>

        <article class="report-card report-card-full">
          <span class="eyebrow">05 · SMALL EXPERIMENTS</span>
          <h2>可以试试的三件小事</h2>
          <p>这三条来自你最高、最低和最随情境变化的三项——不是要你变成另一个人。</p>
          <div class="advice-grid">
            <div class="advice">
              <b>给${highest.name}留点余地</b>
              <p>${dimensionCopy[highest.id].stretchHigh}</p>
            </div>
            <div class="advice">
              <b>给${lowest.name}一点空间</b>
              <p>${dimensionCopy[lowest.id].stretchLow}</p>
            </div>
            <div class="advice">
              <b>留意${flexible.name}的切换</b>
              <p>这一周留意一下：哪些场景让你更像“${flexible.high}”，哪些又让你退回“${flexible.low}”。这种来回本身就在告诉你一些事。</p>
            </div>
          </div>
        </article>
      </div>

      <div class="result-actions">
        <button class="secondary-button" type="button" data-action="share">复制结果</button>
        <button class="ghost-button" type="button" data-action="restart">再测一次</button>
        <button class="ghost-button" type="button" data-action="method">看看怎么算的</button>
      </div>
    </section>
  `;
}

function shareResult() {
  const result = calculateResult();
  const figures = result.dual ? result.ranking.slice(0, 2) : result.ranking.slice(0, 1);
  const text = [
    `我的历史人格原型：${figures.map((figure) => figure.name).join(" × ")}`,
    ...DIMENSIONS.map(
      (dimension) => `${dimension.name} ${result.scores[dimension.id]}`,
    ),
    `匹配清晰度：${result.clarity.band}`,
    "人物志 · 分数来自25–28道情境选择，古人只是个性格上的比喻。",
  ].join("\n");

  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => showToast("结果已复制"))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
  showToast("结果已复制");
}

function render() {
  document.body.dataset.view = state.view;
  if (state.view === "quiz") renderQuiz();
  else if (state.view === "result") renderResult();
  else renderHome();
}

app.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;

  if (action === "start" || action === "restart") startNew();
  if (action === "resume") resumeQuiz();
  if (action === "previous") previousQuestion();
  if (action === "answer") {
    selectAnswer(currentQuestion().id, target.dataset.optionId);
  }
  if (action === "method") methodDialog.showModal();
  if (action === "share") shareResult();
});

document.querySelector("#methodButton").addEventListener("click", () => {
  methodDialog.showModal();
});
document.querySelector("#closeMethodButton").addEventListener("click", () => {
  methodDialog.close();
});
methodDialog.addEventListener("click", (event) => {
  if (event.target === methodDialog) methodDialog.close();
});
document.querySelector("#brandButton").addEventListener("click", goHome);

render();
