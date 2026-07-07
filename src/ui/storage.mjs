import { CORE_QUESTION_IDS } from "../data/catalog.mjs";

export const STORAGE_KEY = "figure-atlas-state-v2";

export function initialQueue() {
  return [...CORE_QUESTION_IDS];
}

export function freshState() {
  return {
    view: "home",
    queue: initialQueue(),
    index: 0,
    answers: [],
    completedAt: null,
  };
}

export function restoreState(storage = localStorage) {
  try {
    const stored = JSON.parse(storage.getItem(STORAGE_KEY));
    if (
      stored &&
      ["home", "quiz", "result"].includes(stored.view) &&
      Array.isArray(stored.answers) &&
      Array.isArray(stored.queue)
    ) {
      return { ...freshState(), ...stored };
    }
  } catch {
    storage.removeItem(STORAGE_KEY);
  }
  return freshState();
}

export function saveState(state, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
