import { DIMENSION_COPY } from "../../../data/dimension-copy.mjs";
import { scoreBand } from "../../../core/result.mjs";
import { escapeHtml } from "../../utils.mjs";

/** 02 · INTERPRETATION — top-3 dimension copy. */
export function interpretationSection(vm) {
  const { sortedDimensions } = vm;

  return `
        <article class="report-card report-card-side reveal" style="--reveal-index:1">
          <span class="eyebrow">02 · 维度解读</span>
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
                      <strong>${escapeHtml(dimension.name)} · ${dimension.score}</strong>
                      <p>${escapeHtml(DIMENSION_COPY[dimension.id][band])}</p>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </article>
  `;
}
