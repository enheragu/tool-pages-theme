(function () {
  if (window.SharedFooter) return;

  var labels = {
    en: { reportProblem: 'Report problem' },
    es: { reportProblem: 'Reportar problema' }
  };

  function detectLang() {
    var params = new URLSearchParams(window.location.search || '');
    var fromQuery = (params.get('lang') || '').toLowerCase();
    if (fromQuery === 'en' || fromQuery === 'es') return fromQuery;
    var htmlLang = (document.documentElement.lang || '').toLowerCase();
    return htmlLang === 'es' ? 'es' : 'en';
  }

  function updateReportProblem(lang) {
    var link = document.getElementById('footer-report-problem');
    if (!link) return;
    link.textContent = (labels[lang] || labels.en).reportProblem;
  }

  function updateRelatedWorkVisibility() {
    var root = document.getElementById('related-work-root');
    if (!root) return;
    var hasContent = root.children.length > 0 || root.textContent.trim().length > 0;
    root.classList.toggle('hidden', !hasContent);
  }

  function watchRelatedWork() {
    var root = document.getElementById('related-work-root');
    if (!root || root.__sharedFooterObserverAttached) return;
    var observer = new MutationObserver(updateRelatedWorkVisibility);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    root.__sharedFooterObserverAttached = true;
  }

  function setLang(lang) {
    var normalized = lang === 'es' ? 'es' : 'en';
    updateReportProblem(normalized);
    updateRelatedWorkVisibility();
    watchRelatedWork();
  }

  function init() {
    setLang(detectLang());
  }

  window.SharedFooter = { init: init, setLang: setLang };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
