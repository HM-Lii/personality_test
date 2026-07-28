/**
 * Golden snapshot tests for the three render functions.
 *
 * Each case renders a fixed input and compares the captured innerHTML
 * against a snapshot file in test/golden/. To regenerate snapshots after an
 * intentional DOM change, run:
 *
 *   UPDATE_GOLDEN=1 npm test
 *
 * …then review the diff in git before committing.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { renderHome } from "../src/ui/render-home.mjs";
import { renderQuiz } from "../src/ui/render-quiz.mjs";
import { renderResult } from "../src/ui/render-result.mjs";
import {
  CORE_QUESTIONS,
  FIGURE_COUNT,
} from "../src/data/catalog.mjs";
import {
  buildResult,
  emptyContrastResult,
  emptyEvidenceResult,
  fakeApp,
  homeStateCompleted,
  homeStateFresh,
  homeStateInProgress,
  quizStateCalibration,
  quizStateCore,
  renderDeps,
  resultStateDual,
  resultStateSingle,
  stubRequestAnimationFrame,
} from "./helpers/golden.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(__dirname, "golden");
const UPDATE = process.env.UPDATE_GOLDEN === "1";

function loadSnapshot(name) {
  const path = join(GOLDEN_DIR, `${name}.html`);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function saveSnapshot(name, content) {
  const path = join(GOLDEN_DIR, `${name}.html`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

/**
 * Render a case, compare against the snapshot, and (when UPDATE_GOLDEN=1)
 * write the new snapshot instead of failing.
 */
function assertGolden(name, render) {
  const actual = render();

  if (UPDATE) {
    saveSnapshot(name, actual);
    return;
  }

  const expected = loadSnapshot(name);
  if (expected === null) {
    saveSnapshot(name, actual);
    assert.fail(
      `Snapshot "${name}" did not exist; wrote a new one. Re-run without UPDATE_GOLDEN to verify, or review the git diff.`,
    );
    return;
  }

  assert.equal(
    actual,
    expected,
    `Snapshot "${name}" diverged. Run UPDATE_GOLDEN=1 npm test to regenerate, then review the diff.`,
  );
}

const homeProps = { CORE_QUESTIONS, FIGURE_COUNT };
const quizProps = { CORE_QUESTIONS, questionMap: renderDeps.questionMap };

// ── Home ──────────────────────────────────────────────────────────────

test("golden: home fresh", () => {
  assertGolden("home-fresh", () => {
    const app = fakeApp();
    renderHome(app, homeStateFresh(), homeProps);
    return app.innerHTML;
  });
});

test("golden: home in-progress", () => {
  assertGolden("home-in-progress", () => {
    const app = fakeApp();
    renderHome(app, homeStateInProgress(), homeProps);
    return app.innerHTML;
  });
});

test("golden: home completed", () => {
  assertGolden("home-completed", () => {
    const app = fakeApp();
    renderHome(app, homeStateCompleted(), homeProps);
    return app.innerHTML;
  });
});

// ── Quiz ──────────────────────────────────────────────────────────────

test("golden: quiz core question", () => {
  assertGolden("quiz-core", () => {
    const app = fakeApp();
    const restore = stubRequestAnimationFrame(globalThis);
    try {
      renderQuiz(app, quizStateCore(), quizProps);
      return app.innerHTML;
    } finally {
      restore();
    }
  });
});

test("golden: quiz calibration question", () => {
  assertGolden("quiz-calibration", () => {
    const app = fakeApp();
    const restore = stubRequestAnimationFrame(globalThis);
    try {
      renderQuiz(app, quizStateCalibration(), quizProps);
      return app.innerHTML;
    } finally {
      restore();
    }
  });
});

// ── Result ─────────────────────────────────────────────────────────────

test("golden: result single archetype", () => {
  assertGolden("result-single", () => {
    const app = fakeApp();
    const state = resultStateSingle();
    renderResult(app, state, buildResult(state.answers), renderDeps);
    return app.innerHTML;
  });
});

test("golden: result dual archetype", () => {
  assertGolden("result-dual", () => {
    const app = fakeApp();
    const state = resultStateDual();
    renderResult(app, state, buildResult(state.answers), renderDeps);
    return app.innerHTML;
  });
});

test("golden: result evidence empty", () => {
  assertGolden("result-evidence-empty", () => {
    const app = fakeApp();
    const state = resultStateSingle();
    renderResult(app, state, emptyEvidenceResult(), renderDeps);
    return app.innerHTML;
  });
});

test("golden: result contrast empty", () => {
  assertGolden("result-contrast-empty", () => {
    const app = fakeApp();
    const state = resultStateSingle();
    renderResult(app, state, emptyContrastResult(), renderDeps);
    return app.innerHTML;
  });
});
