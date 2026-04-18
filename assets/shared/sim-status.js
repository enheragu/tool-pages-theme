(function () {
  if (window.SharedSimStatus) return;

  function set(elementId, text, isBusy, type) {
    var el = (typeof elementId === 'string')
      ? document.getElementById(elementId)
      : elementId;
    if (!el) return;

    el.textContent = text || '';
    el.classList.toggle('is-busy', !!isBusy);

    if (type === 'error')   el.dataset.type = 'error';
    else if (type === 'ok') el.dataset.type = 'ok';
    else                    el.dataset.type = '';

    if (document.body) {
      document.body.classList.toggle('sim-is-busy', !!isBusy);
      document.body.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    }
  }

  window.SharedSimStatus = { set: set };
})();
