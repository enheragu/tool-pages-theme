(function () {
  if (window.SharedToolPageShell) return;

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el && typeof value === 'string') el.textContent = value;
  }

  function setHtml(id, value) {
    var el = document.getElementById(id);
    if (el && typeof value === 'string') el.innerHTML = value;
  }

  function getLang(fallback) {
    if (window.SharedUiCore && typeof window.SharedUiCore.readLangFromUrl === 'function') {
      return window.SharedUiCore.readLangFromUrl(fallback || 'en');
    }
    var params = new URLSearchParams(window.location.search || '');
    var lang = (params.get('lang') || '').toLowerCase();
    return (lang === 'es' || lang === 'en') ? lang : (fallback || 'en');
  }

  function applyFooterDefaults(options) {
    var footer = document.querySelector('footer');
    if (!footer) return;

    var author = footer.querySelector('[data-mlva-author], [data-tool-author]');
    if (author && !author.innerHTML.trim()) {
      author.innerHTML = 'Author: <a href="https://enheragu.github.io/" target="_blank" rel="noopener noreferrer">Enrique Heredia-Aguado</a>';
    }

    var report = footer.querySelector('#footer-report-problem');
    if (report && !report.getAttribute('data-tool-title')) {
      report.setAttribute('data-tool-title', options && options.toolTitle ? options.toolTitle : 'Stat Tool');
    }

    if (window.StatToolsPageUtils && typeof window.StatToolsPageUtils.init === 'function') {
      window.StatToolsPageUtils.init();
    }
  }

  function applyRelatedWork(options) {
    if (!window.SharedRelatedWork || typeof window.SharedRelatedWork.init !== 'function') return;
    var root = document.getElementById('related-work-root');
    if (!root || !options || !options.relatedWork) return;

    var rw = options.relatedWork;
    window.SharedRelatedWork.init({
      container: root,
      toolId: rw.toolId,
      lang: options.lang,
      sourceUrl: rw.sourceUrl || '/stat-tools/assets/related-work.json',
      publicationsSourceUrl: rw.publicationsSourceUrl || '/stat-tools/assets/publications-data.json',
    });
  }

  function init(options) {
    var lang = getLang((options && options.fallbackLang) || 'en');
    var copy = options && typeof options.getCopy === 'function' ? options.getCopy(lang) : null;

    if (copy) {
      if (copy.pageTitle) document.title = copy.pageTitle;
      if (copy.subtitle) setText('site-subtitle', copy.subtitle);
      if (copy.introTitle) setText('intro-title', copy.introTitle);
      if (copy.introText) setHtml('intro-text', copy.introText);
    }

    applyFooterDefaults(options || {});
    applyRelatedWork({
      lang: lang,
      relatedWork: options && options.relatedWork,
    });

    return {
      lang: lang,
      copy: copy,
      setText: setText,
      setHtml: setHtml,
    };
  }

  function initToolPage(options) {
    var opts = options || {};
    var lang = getLang(opts.fallbackLang || 'en');
    var theme = window.SharedUiCore
      ? window.SharedUiCore.getPreferredTheme()
      : (localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

    function getCopyFor(langCode) {
      if (typeof opts.getCopy === 'function') return opts.getCopy(langCode);
      if (opts.i18nApi && typeof opts.i18nApi.getCopy === 'function') return opts.i18nApi.getCopy(langCode);
      return null;
    }

    function setI18nLang(langCode) {
      if (typeof opts.setCopyLang === 'function') {
        opts.setCopyLang(langCode);
        return;
      }
      if (opts.i18nApi && typeof opts.i18nApi.setLang === 'function') {
        opts.i18nApi.setLang(langCode);
      }
    }

    function applyTheme() {
      if (typeof opts.onApplyTheme === 'function') {
        opts.onApplyTheme(theme);
      } else if (window.SharedUiCore && typeof window.SharedUiCore.applyBodyTheme === 'function') {
        window.SharedUiCore.applyBodyTheme(theme);
      } else {
        document.body.classList.toggle('dark', theme === 'dark');
      }
    }

    function toggleTheme() {
      theme = window.SharedUiCore
        ? window.SharedUiCore.toggleThemeValue(theme)
        : (theme === 'dark' ? 'light' : 'dark');
      localStorage.setItem('theme', theme);
      var button = document.getElementById(opts.themeButtonId || 'btn-theme');
      if (window.SharedUiCore && button && typeof window.SharedUiCore.animateThemeButton === 'function') {
        window.SharedUiCore.animateThemeButton(button, 420);
      }
      applyTheme();
    }

    function applyLanguage() {
      var copy = getCopyFor(lang);
      if (typeof opts.onApplyLanguage === 'function') {
        opts.onApplyLanguage(copy, lang, setText, setHtml);
      } else if (copy) {
        if (copy.pageTitle) document.title = copy.pageTitle;
        if (copy.subtitle) setText('site-subtitle', copy.subtitle);
        if (copy.introTitle) setText('intro-title', copy.introTitle);
        if (copy.introText) setHtml('intro-text', copy.introText);
      }

      if (window.SharedFooter && typeof window.SharedFooter.setLang === 'function') {
        window.SharedFooter.setLang(lang);
      }
      if (window.SharedUiCore && typeof window.SharedUiCore.syncLangInUrl === 'function') {
        window.SharedUiCore.syncLangInUrl(lang);
      }
      if (window.SharedUiCore && typeof window.SharedUiCore.setLangSwitcherState === 'function') {
        window.SharedUiCore.setLangSwitcherState(lang, opts.langSwitcherSelector || '#lang-switcher');
      }

      applyRelatedWork({ lang: lang, relatedWork: opts.relatedWork });

      // Reveal body after first translation pass (removes FOUC guard set in tool_head_bootstrap.html).
      // Subsequent calls on lang-switch are a no-op since the class is already gone.
      document.documentElement.classList.remove('i18n-pending');
    }

    function setLang(nextLang) {
      lang = nextLang === 'es' ? 'es' : 'en';
      setI18nLang(lang);
      applyLanguage();
    }

    function ensureHeaderToggleMarkup() {
      if (!window.SharedUiCore) return;

      if (typeof window.SharedUiCore.ensureThemeToggleMarkup === 'function') {
        window.SharedUiCore.ensureThemeToggleMarkup({
          themeButtonId: opts.themeButtonId || 'btn-theme',
          hostSelector: '[data-theme-toggle-host]'
        });
      }

      var selector = opts.langSwitcherSelector || '#lang-switcher';
      var switcherId = 'lang-switcher';
      if (selector.charAt(0) === '#' && selector.length > 1) {
        switcherId = selector.slice(1);
      }

      if (typeof window.SharedUiCore.ensureLangSwitcherMarkup === 'function') {
        window.SharedUiCore.ensureLangSwitcherMarkup({
          hostSelector: '[data-lang-switcher-host]',
          switcherSelector: selector,
          switcherId: switcherId
        });
      }
    }

    function bindHeaderControls() {
      if (window.SharedUiCore && typeof window.SharedUiCore.bindHeaderControls === 'function') {
        window.SharedUiCore.bindHeaderControls({
          themeButtonId: opts.themeButtonId || 'btn-theme',
          langSwitcherSelector: opts.langSwitcherSelector || '#lang-switcher',
          onToggleTheme: toggleTheme,
          onToggleLang: function () {
            setLang(lang === 'en' ? 'es' : 'en');
          }
        });
      } else {
        var themeBtn = document.getElementById(opts.themeButtonId || 'btn-theme');
        if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
        var langBtn = document.querySelector(opts.langSwitcherSelector || '#lang-switcher');
        if (langBtn) langBtn.addEventListener('click', function () {
          setLang(lang === 'en' ? 'es' : 'en');
        });
      }
    }

    applyFooterDefaults(opts);
    ensureHeaderToggleMarkup();
    bindHeaderControls();
    applyLanguage();

    return {
      lang: lang,
      theme: theme,
      setText: setText,
      setHtml: setHtml,
      setLang: setLang,
      getLang: function () { return lang; },
      applyLanguage: applyLanguage,
      applyTheme: applyTheme,
      toggleTheme: toggleTheme,
    };
  }

  window.SharedToolPageShell = {
    init: init,
    initToolPage: initToolPage,
    getLang: getLang,
    setText: setText,
    setHtml: setHtml,
  };
})();
