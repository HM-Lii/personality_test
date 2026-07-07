import { DIMENSIONS } from "../data/catalog.mjs";

function polygonPoints(radius, center = 200) {
  return DIMENSIONS.map((_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / DIMENSIONS.length;
    return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
  }).join(" ");
}

export function radarSvg(scores, dimensionMap) {
  const center = 200;
  const radius = 126;
  const points = DIMENSIONS.map(({ id }, index) => {
    const normalized = (scores[id] - 10) / 80;
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / DIMENSIONS.length;
    return {
      id,
      x: center + Math.cos(angle) * radius * normalized,
      y: center + Math.sin(angle) * radius * normalized,
      labelX: center + Math.cos(angle) * 166,
      labelY: center + Math.sin(angle) * 166,
      axisX: center + Math.cos(angle) * radius,
      axisY: center + Math.sin(angle) * radius,
    };
  });

  return `
    <svg class="radar" viewBox="0 0 400 400" role="img" aria-label="五维人格雷达图">
      ${[0.25, 0.5, 0.75, 1]
        .map(
          (level) =>
            `<polygon class="radar-grid" points="${polygonPoints(radius * level)}"></polygon>`,
        )
        .join("")}
      ${points
        .map(
          (point) =>
            `<line class="radar-axis" x1="${center}" y1="${center}" x2="${point.axisX}" y2="${point.axisY}"></line>`,
        )
        .join("")}
      <polygon class="radar-area" points="${points
        .map((point) => `${point.x},${point.y}`)
        .join(" ")}"></polygon>
      ${points
        .map(
          (point, index) =>
            `<circle class="radar-dot" cx="${point.x}" cy="${point.y}" r="4" style="animation-delay:${450 + index * 120}ms"></circle>`,
        )
        .join("")}
      ${points
        .map((point, index) => {
          const dimension = dimensionMap.get(point.id);
          const anchor =
            point.labelX < 180 ? "end" : point.labelX > 220 ? "start" : "middle";
          const yOffset = point.labelY < 80 ? -8 : point.labelY > 320 ? 15 : 0;
          const labelDelay = 700 + index * 120;
          return `
            <text class="radar-label" x="${point.labelX}" y="${point.labelY + yOffset}" text-anchor="${anchor}" style="animation-delay:${labelDelay}ms">
              ${dimension.name}
            </text>
            <text class="radar-score" x="${point.labelX}" y="${point.labelY + yOffset + 18}" text-anchor="${anchor}" style="animation-delay:${labelDelay + 120}ms">
              ${scores[point.id]}
            </text>
          `;
        })
        .join("")}
    </svg>
  `;
}
