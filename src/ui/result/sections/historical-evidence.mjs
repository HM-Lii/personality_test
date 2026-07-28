import { escapeHtml } from "../../utils.mjs";

/** 07 · HISTORICAL EVIDENCE — evidence chains and disputes. */
export function historicalEvidenceSection(vm) {
  const { historicalEvidence, dimensionMap, confidenceLabels } = vm;

  return `
        <article class="report-card report-card-full reveal" style="--reveal-index:6">
          <span class="eyebrow">07 · HISTORICAL EVIDENCE</span>
          <h2>历史依据与争议</h2>
          <p>这些材料解释的是历史人物为何形成这样的公共文化原型，不是对古人进行心理诊断。可信度评价的是“史料能否支持这条解释”，不是人物的好坏。</p>
          <div class="history-evidence-grid">
            ${historicalEvidence
              .map((item) => {
                const dimension = dimensionMap.get(item.dimension);
                return `
                  <div class="history-evidence-item">
                    <div class="history-evidence-head">
                      <strong>${escapeHtml(item.figure.name)} · ${escapeHtml(dimension.name)}</strong>
                      <span data-confidence="${escapeHtml(item.confidence.level)}">
                        证据可信度：${escapeHtml(confidenceLabels[item.confidence.level])}
                      </span>
                    </div>
                    <p><b>历史事件</b>${escapeHtml(item.event)}</p>
                    <p><b>维度解释</b>${escapeHtml(item.interpretation)}</p>
                    <p>
                      <b>史料来源</b>
                      <a href="${escapeHtml(item.source.url)}" target="_blank" rel="noopener noreferrer">
                        ${escapeHtml(item.source.title)} · ${escapeHtml(item.source.locator)}
                      </a>
                    </p>
                    <p class="history-evidence-confidence"><b>可信度说明</b>${escapeHtml(item.confidence.reason)}</p>
                    <p class="history-evidence-dispute"><b>可能争议</b>${escapeHtml(item.controversy)}</p>
                  </div>
                `;
              })
              .join("")}
          </div>
        </article>
  `;
}
