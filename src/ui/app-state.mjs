/**
 * Minimal state container for the quiz UI.
 *
 * No subscriptions, no reactivity — callers read state with `get()` and
 * trigger renders explicitly. `replace` swaps the whole object (used by
 * `startNew`); `patch` merges a partial (used by view transitions).
 */
export function createAppState(initial) {
  let state = initial;
  return {
    get: () => state,
    replace(next) {
      state = next;
    },
    patch(partial) {
      state = { ...state, ...partial };
    },
  };
}
