import { DIMENSION_COPY } from "../data/dimension-copy.mjs";
import {
  buildReportId,
  evidenceItems,
  matchReasons,
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
  const evidence = evidenceItems(
    result,
    deps.questionMap,
    deps.dimensionMap,
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
            你与${escapeHtml(displayName)}最为相近之处，主要在于${escapeHtml(
              matchReasons(result, resultFigures),
            )}。古人只是一个比喻，真正可凭的，是右侧这张依你的选择算出的五维画像。
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

        <article class="report-card report-card-large reveal" style="--reveal-index:2">
          <span class="eyebrow">03 · ANSWER EVIDENCE</span>
          <h2>为什么是这一位</h2>
          <p>下面三条都出自你刚才的真实选择，不是从哪位古人那里套来的现成话。</p>
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

        <article class="report-card report-card-side reveal" style="--reveal-index:3">
          <span class="eyebrow">04 · NEARBY FIGURES</span>
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

        <article class="report-card report-card-full reveal" style="--reveal-index:4">
          <span class="eyebrow">05 · SMALL EXPERIMENTS</span>
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
