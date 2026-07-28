/**
 * Result page renderer — orchestration only.
 *
 * Builds the view model, joins the section templates in order, and writes
 * the assembled HTML to `app.innerHTML`. All data derivation lives in
 * `view-model.mjs`; all markup lives in `sections/*.mjs`.
 */
import { buildViewModel } from "./result/view-model.mjs";
import { heroSection } from "./result/sections/hero.mjs";
import { profileSection } from "./result/sections/profile.mjs";
import { interpretationSection } from "./result/sections/interpretation.mjs";
import { whyFigureSection } from "./result/sections/why-figure.mjs";
import { answerEvidenceSection } from "./result/sections/answer-evidence.mjs";
import { contrastSection } from "./result/sections/contrast.mjs";
import { nearbySection } from "./result/sections/nearby.mjs";
import { historicalEvidenceSection } from "./result/sections/historical-evidence.mjs";
import { experimentsSection } from "./result/sections/experiments.mjs";

const sectionRenderers = [
  profileSection,
  interpretationSection,
  whyFigureSection,
  answerEvidenceSection,
  contrastSection,
  nearbySection,
  historicalEvidenceSection,
  experimentsSection,
];

export function renderResult(app, state, result, deps) {
  const vm = buildViewModel(state, result, deps);

  const sections = sectionRenderers.map((render) => render(vm)).join("\n");

  app.innerHTML = `
    <section class="result-page" aria-labelledby="result-name">
      ${heroSection(vm)}

      <div class="report-grid">
${sections}
      </div>

      <div class="result-actions">
        <button class="secondary-button" type="button" data-action="share">复制结果</button>
        <button class="ghost-button" type="button" data-action="restart">再测一次</button>
        <button class="ghost-button" type="button" data-action="method">看看怎么算的</button>
      </div>
    </section>
  `;
}
