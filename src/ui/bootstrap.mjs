/**
 * One-shot DOM setup that runs before the app starts reacting to user input.
 */
import { FIGURE_COUNT } from "../data/catalog.mjs";

/** Inject the figure count into all `[data-figure-count]` nodes. */
export function injectFigureCounts() {
  document.querySelectorAll("[data-figure-count]").forEach((node) => {
    node.textContent = `${FIGURE_COUNT}位古人`;
  });
  document.querySelectorAll("[data-figure-count-template]").forEach((node) => {
    node.content = node.dataset.figureCountTemplate.replace(
      "{count}",
      FIGURE_COUNT,
    );
  });
}

/** Generate the floating ink-particle background (once, idempotent). */
export function createInkParticles(container) {
  if (!container || container.childElementCount > 0) return;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 14; i += 1) {
    const span = document.createElement("span");
    const size = 3 + Math.random() * 7;
    span.style.left = `${Math.random() * 100}%`;
    span.style.width = `${size}px`;
    span.style.height = `${size}px`;
    span.style.animationDuration = `${18 + Math.random() * 22}s`;
    span.style.animationDelay = `${-Math.random() * 30}s`;
    fragment.appendChild(span);
  }
  container.appendChild(fragment);
}
