import { escapeHtml } from "../../utils.mjs";

/** 03 · WHY THIS FIGURE — first-vs-second ranking breakdown. */
export function whyFigureSection(vm) {
  const { primary, secondary, result, comparison, decidingNames, secondaryAdvantageNames, isContributionTie } = vm;

  return `
        <article class="report-card report-card-full reveal" style="--reveal-index:2">
          <span class="eyebrow">03 · WHY THIS FIGURE</span>
          <h2>为什么是这一位</h2>
          <p>
            这里不再挑“看起来最像”的三个维度，而是直接拆开第一名和第二名的加权距离：
            哪些维度把第一名推到前面，哪些维度其实更支持第二名。
          </p>
          <div class="candidate-comparison">
            <div class="candidate-rank candidate-rank-primary">
              <span>第一名</span>
              <strong>${escapeHtml(primary.name)}</strong>
              <small>综合距离 ${primary.distance.toFixed(3)}</small>
            </div>
            <span class="candidate-versus">对比</span>
            <div class="candidate-rank">
              <span>第二名</span>
              <strong>${escapeHtml(secondary.name)}</strong>
              <small>综合距离 ${secondary.distance.toFixed(3)}</small>
            </div>
          </div>
          <h3 class="comparison-subtitle">决定排名的维度</h3>
          <div class="decision-grid">
            ${
              comparison.decidingDimensions.length
                ? comparison.decidingDimensions
                    .map((dimension) => {
                      const share = comparison.positiveAdvantage
                        ? Math.round(
                            (100 * dimension.advantage) /
                              comparison.positiveAdvantage,
                          )
                        : 0;
                      return `
                        <div class="decision-item">
                          <div class="decision-head">
                            <strong>${escapeHtml(dimension.name)}</strong>
                            <span>胜出贡献 ${share}%</span>
                          </div>
                          <p>
                            你是 ${dimension.score} 分；距${escapeHtml(primary.name)}原型
                            ${Math.round(dimension.primaryGap)} 分，距${escapeHtml(secondary.name)}原型
                            ${Math.round(dimension.secondaryGap)} 分。
                          </p>
                          <small>
                            原型位置：${escapeHtml(primary.name)} ${dimension.primaryTarget}
                            · ${escapeHtml(secondary.name)} ${dimension.secondaryTarget}
                          </small>
                        </div>
                      `;
                    })
                    .join("")
                : `<p class="decision-empty">没有单个维度形成净胜出：第一、第二名在各维度上的优势刚好相抵。</p>`
            }
          </div>
          <p class="comparison-counter">
            <b>${result.dual ? "为什么第二名仍被保留" : `为什么不是${escapeHtml(secondary.name)}`}</b>
            ${
              isContributionTie
                ? `两位候选人的逐维优势完全相抵，${escapeHtml(secondary.name)}并未被证据排除，仅按稳定顺序暂列第二。`
                : comparison.secondaryAdvantages.length
                ? `${escapeHtml(secondary.name)}在${escapeHtml(secondaryAdvantageNames)}上更接近你，但这些维度的合计优势不足以抵消${escapeHtml(primary.name)}在${escapeHtml(decidingNames)}上的领先。`
                : `${escapeHtml(secondary.name)}没有任何一个维度比${escapeHtml(primary.name)}更贴近你的当前五维得分，因此排在第二。`
            }
            ${
              result.dual
                ? "不过两者的综合距离仍非常接近，所以它不是被排除的答案。"
                : ""
            }
          </p>
        </article>
  `;
}
