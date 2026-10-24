(() => {
  'use strict';

  // Acquire a fresh device position as soon as the app starts, regardless of
  // the selected opening zone. The core app decides whether the map should
  // also recenter (Mia zona) or only display/update the blue position marker.
  function requestFreshPosition() {
    const app = window.CarburantiApp;
    if (!app || typeof app.locateUser !== 'function') return;

    const state = app.state;
    const shouldCenter = Boolean(state && state.zone === 'position');
    app.locateUser(shouldCenter, { quiet: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Run after the core DOMContentLoaded initializer has bound the map/UI.
      setTimeout(requestFreshPosition, 0);
    }, { once: true });
  } else {
    setTimeout(requestFreshPosition, 0);
  }
})();
