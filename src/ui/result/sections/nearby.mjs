import { escapeHtml } from "../../utils.mjs";

/** 06 · NEARBY FIGURES — close-by archetypes. */
export function nearbySection(vm) {
  const { result } = vm;

  return `
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
  `;
}
