import { escapeHtml } from "../../utils.mjs";

/** 05 · WHERE YOU DIFFER — contrast dimensions. */
export function contrastSection(vm) {
  const { primary, contrasts } = vm;

  return `
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
  `;
}
