import { escapeHtml, displayedOptions } from "./utils.mjs";

export function renderQuiz(app, state, { CORE_QUESTIONS, questionMap }) {
  const question = questionMap.get(state.queue[state.index]);
  if (!question) {
    return { reset: true };
  }

  const isCalibration = state.index >= CORE_QUESTIONS.length;
  const calibrationNumber = state.index - CORE_QUESTIONS.length + 1;
  const progress = isCalibration
    ? 100
    : Math.round(((state.index + 1) / CORE_QUESTIONS.length) * 100);
  const selectedAnswer = state.answers.find(
    (answer) => answer.questionId === question.id,
  );
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
  return { reset: false, questionId: question.id };
}
