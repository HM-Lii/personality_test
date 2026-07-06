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
    high: "你愿意让陌生信息进入判断，也容易从假设、变化和跨领域连接中获得灵感。",
    middle: "你会在新鲜感与可用性之间切换：值得探索时打开边界，需要交付时回到现实。",
    low: "你偏爱经过验证、可以落地的方法，擅长把注意力留给真正需要解决的问题。",
    stretchHigh: "给新想法设置一个可回退的小实验，避免探索同时占满所有资源。",
    stretchLow: "每周给一个陌生观点十分钟，不要求采纳，只练习理解它为何成立。",
  },
  C: {
    high: "你倾向把承诺变成结构，通过计划、复查和持续投入降低事情失控的概率。",
    middle: "你既会建立必要框架，也愿意根据现场变化调整节奏，不执着于一种推进方式。",
    low: "你对现场变化反应快，习惯保留选择空间，让路径随着真实信息逐步出现。",
    stretchHigh: "区分“必须做到”和“做到更好”，给非关键部分留下足够的完成线。",
    stretchLow: "只为当前最重要的目标设置一个固定节点，不必把全部生活都计划化。",
  },
  E: {
    high: "你常通过表达和互动启动思考，也愿意在群体里主动创造节奏与连接。",
    middle: "你可以进入人群，也需要独处整理；能量来源会随对象和场景改变。",
    low: "你更习惯先观察和独立加工信息，在准备充分或关系深入时集中表达。",
    stretchHigh: "重要讨论前先留一点无输入时间，让尚未说出口的判断有机会成形。",
    stretchLow: "在下一次小组讨论中提前准备一句开场，让自己的信息更早进入现场。",
  },
  A: {
    high: "你会自然看见他人的处境与共同利益，擅长通过理解和协调维持长期合作。",
    middle: "你能照顾关系，也会在需要时明确立场，通常根据合作期限和问题性质取舍。",
    low: "你更愿意把原则、标准和真实分歧摆到台面上，不轻易用表面和谐替代判断。",
    stretchHigh: "答应之前先说出自己的真实成本，清晰边界往往比事后消耗更保护关系。",
    stretchLow: "提出不同意见前先复述对方真正关心的点，准确理解不会削弱你的立场。",
  },
  R: {
    high: "你在不确定和压力中通常能维持行动节奏，并较快把注意力转回可处理的部分。",
    middle: "你能感知风险和情绪变化，也有能力在获得足够信息后恢复推进。",
    low: "你对风险、评价和变化信号比较敏感，往往比别人更早看见潜在问题与关系波动。",
    stretchHigh: "重大决定前主动邀请一个谨慎的人检查盲点，稳定不等于风险不存在。",
    stretchLow: "压力出现时先区分“已经发生”和“可能发生”，只处理第一栏里最小的一步。",
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
        <h1 id="hero-title">你在历史的<br><em>哪一种坐标</em>？</h1>
        <p class="hero-lead">
          25个真实情境，观察你如何探索、执行、连接与复原。
          我们不靠神秘标签猜人，而是公开每一步计分，再从57位中国历史人物原型中寻找与你相近的轮廓。
        </p>
        <div class="hero-actions">
          <button class="primary-button" type="button" data-action="start">
            ${canResume ? "重新测试" : "开始测试"}<span class="arrow">→</span>
          </button>
          ${
            canResume
              ? `<button class="plain-link" type="button" data-action="resume">${
                  state.completedAt
                    ? "查看上次结果"
                    : `继续上次进度 · ${answeredCore}/25`
                }</button>`
              : `<button class="plain-link" type="button" data-action="method">先看计分逻辑</button>`
          }
        </div>
        <div class="hero-meta" aria-label="测试信息">
          <span><strong>25–28</strong>道情境题</span>
          <span><strong>5</strong>个连续维度</span>
          <span><strong>57</strong>位人物原型</span>
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
          ${isCalibration ? "CALIBRATION · 轮廓辨析" : escapeHtml(question.domain)}
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
        <p class="question-hint">没有正确答案，选择你通常会做的，而不是你希望自己做到的。</p>
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
        `${item.name} ${item.score}（与原型相差 ${Math.round(item.difference)}）`,
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
    ? `${primary.archetype}，也带有${secondary.archetype}的路径`
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
            result.dual ? "双原型 · 情境型轮廓" : escapeHtml(primary.era)
          }</span>
          <h1 class="result-name ${result.dual ? "result-name-dual" : ""}" id="result-name">
            ${escapeHtml(displayName)}
          </h1>
          <p class="result-title">${escapeHtml(displayTitle)}</p>
          <div class="tags">
            ${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
          <p class="result-quote">
            你与${escapeHtml(displayName)}接近的部分，主要落在${escapeHtml(
              matchReasons(result, resultFigures),
            )}。人物只是隐喻，真正的结果是右侧这组由你的选择计算出的五维轮廓。
          </p>
          <span class="clarity">
            匹配清晰度 <strong>${escapeHtml(result.clarity.band)}</strong>
            · ${result.calibrationCount}道辨析题
          </span>
        </div>
        <div class="radar-wrap">${radarSvg(result.scores)}</div>
      </article>

      <div class="report-grid">
        <article class="report-card report-card-large">
          <span class="eyebrow">01 · YOUR PROFILE</span>
          <h2>这不是五项能力排名</h2>
          <p>分数表示你在两种有效策略之间更常站在哪一侧。高低都不是优劣，也不是人群百分位。</p>
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
          <h2>你的选择方式</h2>
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
          <h2>为什么会得到这个结果</h2>
          <p>下面三条来自你的真实选择，而不是人物模板的固定文案。</p>
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
                      <p>“${escapeHtml(item.option.text)}”——这个选择更接近：${escapeHtml(
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
          <h2>你的邻近原型</h2>
          <p>接近度只用于比较这些候选之间的距离，不代表测试准确率。</p>
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
          <h2>三个可验证的小实验</h2>
          <p>建议来自你的最高、最低与最具情境变化的维度；它们不是要求你变成另一种人。</p>
          <div class="advice-grid">
            <div class="advice">
              <b>放松优势 · ${highest.name}</b>
              <p>${dimensionCopy[highest.id].stretchHigh}</p>
            </div>
            <div class="advice">
              <b>扩展选项 · ${lowest.name}</b>
              <p>${dimensionCopy[lowest.id].stretchLow}</p>
            </div>
            <div class="advice">
              <b>观察情境 · ${flexible.name}</b>
              <p>留意一周：哪些场景让你明显走向“${flexible.high}”，哪些场景又让你选择“${flexible.low}”。变化本身也是信息。</p>
            </div>
          </div>
        </article>
      </div>

      <div class="result-actions">
        <button class="secondary-button" type="button" data-action="share">复制结果摘要</button>
        <button class="ghost-button" type="button" data-action="restart">重新测试</button>
        <button class="ghost-button" type="button" data-action="method">查看计分逻辑</button>
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
    "人物志 · 分数来自25–28道情境选择，历史人物仅作性格隐喻。",
  ].join("\n");

  if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => showToast("结果摘要已复制"))
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
  showToast("结果摘要已复制");
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
