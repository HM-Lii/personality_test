/**
 * Scroll-triggered reveal animation for report cards.
 *
 * Uses an rAF-throttled scroll listener (not IntersectionObserver) so that
 * instantaneous jumps — anchor links, programmatic scrolling, browser
 * scroll-restoration — also trigger the check. Also listens to `resize`
 * and `orientationchange` so the trigger line stays valid after layout
 * shifts.
 *
 * Returns `{ check, destroy }`: `check` runs the visibility test immediately
 * (call it after rendering new content), `destroy` removes all listeners.
 */
export function createRevealTracker(app) {
  let scheduled = false;

  function check() {
    const triggerLine = window.innerHeight * 0.92;
    app
      .querySelectorAll(".reveal:not(.is-visible)")
      .forEach((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.top < triggerLine && rect.bottom > 0) {
          node.classList.add("is-visible");
        }
      });
  }

  function onScroll() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      check();
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  window.addEventListener("orientationchange", onScroll);

  return {
    check,
    destroy() {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("orientationchange", onScroll);
    },
  };
}
