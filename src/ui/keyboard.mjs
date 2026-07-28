/**
 * Keyboard shortcuts for the quiz view.
 *
 * 1–4 / A–D select an option; ← or Backspace goes to the previous question.
 * Uses `questionTransition.pending` (not DOM probing) to guard against
 * responding during the card-leave animation, keeping the guard consistent
 * with the click path.
 */
import { questionMap } from "../data/catalog.mjs";
import { displayedOptions } from "./utils.mjs";

export function bindKeyboard(ctx, quiz) {
  const { store, questionTransition, methodDialog } = ctx;

  function onKeyDown(event) {
    const state = store.get();
    if (state.view !== "quiz" || methodDialog?.open) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (event.key === "ArrowLeft" || event.key === "Backspace") {
      event.preventDefault();
      quiz.previousQuestion();
      return;
    }

    const key = event.key.toLowerCase();
    let optionIndex = -1;
    if (/^[1-4]$/.test(key)) optionIndex = Number(key) - 1;
    else if (/^[a-d]$/.test(key)) optionIndex = key.charCodeAt(0) - 97;
    if (optionIndex < 0) return;

    /* Transition in progress — don't respond. */
    if (questionTransition.pending) return;

    const question = questionMap.get(state.queue[state.index]);
    const option = question && displayedOptions(question)[optionIndex];
    if (option) quiz.selectAnswer(question.id, option.id);
  }

  window.addEventListener("keydown", onKeyDown);

  return () => window.removeEventListener("keydown", onKeyDown);
}
