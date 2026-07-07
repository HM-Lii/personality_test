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
            你和${escapeHtml(displayName)}最像的地方，主要在${escapeHtml(
              matchReasons(result, resultFigures),
            )}。古人只是个比喻，真正的结果是右边这张根据你的选择算出来的五维画像。
          </p>
          <span class="clarity">
            匹配清晰度 <strong>${escapeHtml(result.clarity.band)}</strong>
            · 做了${result.calibrationCount}道辨析题
          </span>
        </div>
        <div class="radar-wrap">${radarSvg(result.scores, dimensionMap)}</div>
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
                      <p>${DIMENSION_COPY[dimension.id][band]}</p>
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
              <p>${DIMENSION_COPY[highest.id].stretchHigh}</p>
            </div>
            <div class="advice">
              <b>给${lowest.name}一点空间</b>
              <p>${DIMENSION_COPY[lowest.id].stretchLow}</p>
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
