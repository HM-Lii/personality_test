import { DIMENSIONS } from "../../../data/catalog.mjs";
import { escapeHtml } from "../../utils.mjs";

/** 01 · YOUR PROFILE — dimension score bars. */
export function profileSection(vm) {
  const { result } = vm;

  return `
        <article class="report-card report-card-large reveal" style="--reveal-index:0">
          <span class="eyebrow">01 · YOUR PROFILE</span>
          <h2>分数不是能力排名</h2>
          <p>它只描述你在这两种风格之间更偏向哪一端。分高分低没有优劣，也不代表某种风格比另一种更好。</p>
          <div class="dimension-list">
            ${DIMENSIONS.map((dimension) => {
              const score = result.scores[dimension.id];
              return `
                <div class="dimension-row">
                  <span>${escapeHtml(dimension.name)}</span>
                  <div class="dimension-bar"><i style="width:${score}%"></i></div>
                  <strong>${score}</strong>
                </div>
              `;
            }).join("")}
          </div>
        </article>
  `;
}
