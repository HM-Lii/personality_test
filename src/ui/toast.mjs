/**
 * Toast notification helper.
 *
 * Returns a `showToast(message)` function that shows the toast element for
 * 2.2 seconds. Repeated calls reset the timer so the toast stays visible.
 */
const TOAST_DURATION = 2200;

export function createToast(element) {
  let timer;
  return function showToast(message) {
    element.textContent = message;
    element.classList.add("show");
    window.clearTimeout(timer);
    timer = window.setTimeout(
      () => element.classList.remove("show"),
      TOAST_DURATION,
    );
  };
}
