import { escapeHtml } from "../../utils.mjs";

/** 04 · ANSWER EVIDENCE — which answers drove the ranking. */
export function answerEvidenceSection(vm) {
  const { evidence } = vm;

  return `
        <article class="report-card report-card-large reveal" style="--reveal-index:3">
          <span class="eyebrow">04 · ANSWER EVIDENCE</span>
          <h2>哪些回答推动了排名</h2>
          <p>只引用实际支持第一名胜出维度的作答；回答强烈但不能区分前两位候选人的题目，不会进入这里。</p>
          <div class="evidence-list">
            ${
              evidence.length
                ? evidence
                    .map((item, index) => {
                      return `
                        <div class="evidence-item">
                          <span class="evidence-index">${String(index + 1).padStart(2, "0")}</span>
                          <div>
                            <strong>${escapeHtml(item.question.title)}</strong>
                            <p><b>你的选择</b>“${escapeHtml(item.option.text)}”</p>
                            <p><b>反映倾向</b>${escapeHtml(item.tendency)}</p>
                            <p><b>为何支持</b>${escapeHtml(item.supportReason)}</p>
                          </div>
                        </div>
                      `;
                    })
                    .join("")
                : `<div class="evidence-empty"><strong>没有单道题能独立解释这次排序</strong><p>第一名源自多道回答的合力，没有某道题能单独决定排名。</p></div>`
            }
          </div>
        </article>
  `;
}
