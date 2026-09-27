// Loaded in the head so a retry never flashes the introduction while assets load.
(() => {
  const retrying = history.state?.retryRound === location.pathname;
  if (retrying) {
    const state = { ...history.state };
    delete state.retryRound;
    history.replaceState(state, '');
    document.documentElement.classList.add('retrying-round');
  }

  window.roundRetry = {
    restart() {
      // A one-use flag on this history entry preserves the URL and level settings.
      history.replaceState({ ...history.state, retryRound: location.pathname }, '');
      location.reload();
    },
    startWhenReady(start) {
      if (!retrying) return;
      start();
      document.documentElement.classList.remove('retrying-round');
    },
  };
})();
