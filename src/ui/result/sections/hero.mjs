import { escapeHtml } from "../../utils.mjs";
import { radarSvg } from "../../radar.mjs";

/** Masthead + result hero article. */
export function heroSection(vm) {
  const { primary, secondary, result, displayName, displayTitle, tags, heroComparison, reportId, dimensionMap } = vm;
  const resultFigures = vm.resultFigures;

  return `
      <div class="result-masthead">
        <span class="eyebrow">你的历史人格原型</span>
        <span class="result-id">${escapeHtml(reportId)}</span>
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
            ${escapeHtml(heroComparison)}古人只是一个比喻。真正可凭的，是这张依你的选择算出的五维画像。
          </p>
          <span class="clarity">
            匹配清晰度 <strong>${escapeHtml(result.clarity.band)}</strong>
            · 已完成 ${result.calibrationCount} 道辨析题
          </span>
        </div>
        <div class="radar-wrap">${radarSvg(result.scores, dimensionMap)}</div>
      </article>
  `;
}
