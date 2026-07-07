import { escapeHtml } from "./utils.mjs";

export function renderHome(app, state, { CORE_QUESTIONS }) {
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
