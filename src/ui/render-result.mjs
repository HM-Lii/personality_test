import { DIMENSION_COPY } from "../data/dimension-copy.mjs";
import {
  buildReportId,
  compareTopCandidates,
  contrastDimensions,
  evidenceItems,
  scoreBand,
} from "../core/result.mjs";
import { DIMENSIONS } from "../data/catalog.mjs";
import { radarSvg } from "./radar.mjs";
import { escapeHtml } from "./utils.mjs";

export function renderResult(app, state, result, deps) {
  const { dimensionMap, hashString } = deps;
  const primary = result.ranking[0];
  const secondary = result.ranking[1];
  const resultFigures = result.dual ? [primary, secondary] : [primary];
  const displayName = resultFigures.map((figure) => figure.name).join(" × ");
  const displayTitle = result.dual
    ? `${primary.archetype}，也带着一点${secondary.archetype}的影子`
    : primary.archetype;
  const tags = [...new Set(resultFigures.flatMap((figure) => figure.tags))].slice(
    0,
    4,
  );
  const comparison = compareTopCandidates(result);
  const evidence = evidenceItems(
    result,
    deps.questionMap,
    deps.dimensionMap,
    comparison,
  );
  const contrasts = contrastDimensions(result, primary);
  const decidingNames =
    comparison.decidingDimensions
      .map((dimension) => dimension.name)
      .join("、") || "各维度的合计差异";
  const secondaryAdvantageNames = comparison.secondaryAdvantages
    .map((dimension) => dimension.name)
    .join("、");
  const isContributionTie = Math.abs(comparison.netAdvantage) < 1e-9;
  const heroComparison = result.dual
    ? isContributionTie
      ? `${primary.name}与${secondary.name}的逐维排名贡献完全相抵，系统只按稳定顺序暂列先后，所以结果保留双原型。`
      : `在第一、第二候选的数值比较中，${decidingNames}让${primary.name}略微靠前，但差距不足以排除${secondary.name}，所以结果保留双原型。`
    : `在最接近的两位候选中，真正让${primary.name}胜出的维度是${decidingNames}；${secondary.name}${secondaryAdvantageNames ? `虽在${secondaryAdvantageNames}更接近你，但不足以抵消这些差距` : "没有在其他维度形成足以反超的优势"}。`;
  const confidenceLabels = {
    high: "较高",
    medium: "中等",
    low: "有限",
  };
  const historicalEvidence = resultFigures.flatMap((figure) =>
    figure.evidenceChains.map((chain) => ({ ...chain, figure })),
  );
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
  const reportId = buildReportId(state.completedAt, state.answers, hashString);

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
            ${escapeHtml(heroComparison)}古人只是一个比喻，真正可凭的，是右侧这张依你的选择算出的五维画像。
          </p>
          <span class="clarity">
            匹配清晰度 <strong>${escapeHtml(result.clarity.band)}</strong>
            · 已完成 ${result.calibrationCount} 道辨析题
          </span>
        </div>
        <div class="radar-wrap">${radarSvg(result.scores, dimensionMap)}</div>
      </article>

      <div class="report-grid">
        <article class="report-card report-card-large reveal" style="--reveal-index:0">
          <span class="eyebrow">01 · YOUR PROFILE</span>
          <h2>分数不是能力排名</h2>
          <p>它只是说你在这两种风格之间更偏向哪一端。分高分低没有好坏之分，也不意味着你超越了谁。</p>
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

        <article class="report-card report-card-side reveal" style="--reveal-index:1">
          <span class="eyebrow">02 · INTERPRETATION</span>
          <h2>你的选择说了什么</h2>
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
                      <p>${DIMENSION_COPY[dimension.id][band]}</p>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </article>

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
                : `<div class="evidence-empty"><strong>没有单道题能独立解释这次排序</strong><p>第一名来自多道回答共同作用；移除任意一道都不会削弱它相对第二名的优势，因此这里不拿无关回答硬凑证据。</p></div>`
            }
          </div>
        </article>

        <article class="report-card report-card-side contrast-card reveal" style="--reveal-index:4">
          <span class="eyebrow">05 · WHERE YOU DIFFER</span>
          <h2>你们不像的地方</h2>
          <p>
            相似的是人格轮廓的一部分，不代表你拥有${escapeHtml(primary.name)}的能力、经历或道德立场，也不表示你会作出相同选择。
          </p>
          <div class="contrast-list">
            ${
              contrasts.length
                ? contrasts
                    .map(
                      (dimension) => `
                        <div class="contrast-item">
                          <div>
                            <strong>${escapeHtml(dimension.name)}</strong>
                            <span>相差 ${Math.round(dimension.gap)} 分</span>
                          </div>
                          <p>
                            你是 ${dimension.score}，${escapeHtml(primary.name)}原型是 ${dimension.target}。
                            相比该原型，你更偏向“${escapeHtml(dimension.userLeansToward)}”。
                          </p>
                        </div>
                      `,
                    )
                    .join("")
                : `<p class="contrast-empty">当前五维分数与${escapeHtml(primary.name)}原型没有明显数值差距，但经历、能力与价值立场仍不能由这份测试推断。</p>`
            }
          </div>
        </article>

        <article class="report-card report-card-full reveal" style="--reveal-index:5">
          <span class="eyebrow">06 · NEARBY FIGURES</span>
          <h2>气质相近的还有谁</h2>
          <p>这里的接近度只在几位候选人之间相比，不代表测试本身的准确程度。</p>
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

        <article class="report-card report-card-full reveal" style="--reveal-index:7">
          <span class="eyebrow">08 · SMALL EXPERIMENTS</span>
          <h2>三件可以试的小事</h2>
          <p>分别来自你得分最高、最低，以及最随情境变化的三项——不是让你变成别人，只是多一个观察自己的角度。</p>
          <div class="advice-grid">
            <div class="advice">
              <b>为${highest.name}留一点余地</b>
              <p>${DIMENSION_COPY[highest.id].stretchHigh}</p>
            </div>
            <div class="advice">
              <b>给${lowest.name}一些空间</b>
              <p>${DIMENSION_COPY[lowest.id].stretchLow}</p>
            </div>
            <div class="advice">
              <b>留意${flexible.name}的切换</b>
              <p>这一周可以留意：哪些场景让你更像“${flexible.high}”，哪些又让你退回“${flexible.low}”。这种来回本身，就在诉说一些关于你的事。</p>
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
