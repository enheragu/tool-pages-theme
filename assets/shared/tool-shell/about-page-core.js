(function () {
  function boot() {
    var config = window.AboutPageConfig || {};
    if (!window.SharedToolPageShell || typeof window.SharedToolPageShell.initToolPage !== 'function') {
      document.documentElement.classList.remove('i18n-pending');
      return;
    }

    window.SharedToolPageShell.initToolPage({
      toolTitle: config.toolTitle,
      i18nApi: config.i18nGlobal ? window[config.i18nGlobal] : null,
      onApplyLanguage: function (copy, lang, setText, setHtml) {
        if (!copy) return;
        setText('about-section-title', copy.aboutSectionTitle);
        setHtml('about-body-text', copy.bodyHtml);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
