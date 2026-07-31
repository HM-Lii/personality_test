import { DIMENSION_COPY } from "../../../data/dimension-copy.mjs";
import { escapeHtml } from "../../utils.mjs";

/** 08 · SMALL EXPERIMENTS — advice from highest/lowest/flexible dimensions. */
export function experimentsSection(vm) {
  const { highest, lowest, flexible } = vm;

  return `
        <article class="report-card report-card-full reveal" style="--reveal-index:7">
          <span class="eyebrow">08 · SMALL EXPERIMENTS</span>
          <h2>三件可以试的小事</h2>
          <p>分别来自你得分最高、最低，以及最随情境变化的三项——不是让你变成别人，只是多一个观察自己的角度。</p>
          <div class="advice-grid">
            <div class="advice">
              <b>为${escapeHtml(highest.name)}留一点余地</b>
              <p>${escapeHtml(DIMENSION_COPY[highest.id].stretchHigh)}</p>
            </div>
            <div class="advice">
              <b>试着多走一步：${escapeHtml(lowest.name)}</b>
              <p>${escapeHtml(DIMENSION_COPY[lowest.id].stretchLow)}</p>
            </div>
            <div class="advice">
              <b>留意${escapeHtml(flexible.name)}的切换</b>
              <p>这一周可以留意：哪些场景让你更像“${escapeHtml(flexible.high)}”，哪些又让你退回“${escapeHtml(flexible.low)}”。这种来回本身，就在告诉你一些关于自己的事。</p>
            </div>
          </div>
        </article>
  `;
}
