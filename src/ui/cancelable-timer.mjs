export function createCancelableTimer(timerApi = window) {
  let timerId = null;

  function cancel() {
    if (timerId === null) return false;
    timerApi.clearTimeout(timerId);
    timerId = null;
    return true;
  }

  return {
    get pending() {
      return timerId !== null;
    },

    schedule(callback, delay) {
      cancel();
      timerId = timerApi.setTimeout(() => {
        timerId = null;
        callback();
      }, delay);
    },

    cancel,
  };
}
