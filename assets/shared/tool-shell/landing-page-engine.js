(function () {
  if (window.SharedToolLandingEngine) return;

  function readLangFromUrl() {
    if (window.SharedUiCore) return window.SharedUiCore.readLangFromUrl('en');
    var params = new URLSearchParams(window.location.search || '');
    var lang = (params.get('lang') || '').toLowerCase();
    return (lang === 'es' || lang === 'en') ? lang : 'en';
  }

  function readSectionFromUrl() {
    var url = new URL(window.location.href);
    var section = (url.searchParams.get('section') || '').trim();
    if (section) return section;
    var hash = (window.location.hash || '').replace(/^#/, '').trim();
    return hash || '';
  }

  function focusSectionFromUrl() {
    var sectionId = readSectionFromUrl();
    if (!sectionId) return;
    var target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(function () {
      window.scrollBy({ top: -18, left: 0, behavior: 'auto' });
    }, 260);
    target.classList.add('section-focused');
    window.setTimeout(function () {
      target.classList.remove('section-focused');
    }, 1600);
  }

  function setElText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function create(config) {
    function i18nApi() { return window[config.i18nGlobal]; }

    var state = {
      lang: 'en',
      theme: window.SharedUiCore ? window.SharedUiCore.getPreferredTheme() : (localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')),
      tools: []
    };

    function withLang(href) {
      var separator = href.indexOf('?') >= 0 ? '&' : '?';
      return href + separator + 'lang=' + encodeURIComponent(state.lang);
    }

    function renderCardsInGrid(gridId, toolList) {
      var grid = document.getElementById(gridId);
      if (!grid) return;

      var cards = toolList.map(function (tool) {
        var i18nCopy = i18nApi() ? i18nApi().getCopy(state.lang) : null;
        var content = i18nCopy ? i18nCopy.cards[tool.key] : { title: tool.key, desc: '' };
        var coverImage = state.theme === 'dark' ? tool.imageDark : (tool.imageLight || tool.imageDark);
        var statusBadge = '';
        if (tool.status === 'wip') {
          statusBadge = '<span class="tool-status-badge">WIP</span>';
        }

        return [
          '<a class="tool-card" href="' + withLang(tool.href) + '">',
          '<img class="tool-cover" src="' + coverImage + '" alt="' + content.title + ' preview" onerror="this.onerror=null;this.src=\'' + config.fallbackImage + '\';">',
          '<div class="tool-content">',
          '<h3 class="tool-title">' + content.title + statusBadge + '</h3>',
          '<p class="tool-desc">' + content.desc + '</p>',
          '</div>',
          '</a>'
        ].join('');
      }).join('');

      grid.innerHTML = cards;
    }

    function getTools() {
      return state.tools && state.tools.length ? state.tools : config.tools;
    }

    function renderCards() {
      var currentTools = getTools();
      config.landingSections.forEach(function (section) {
        renderCardsInGrid(section.gridId, currentTools.filter(function (tool) { return tool.section === section.sectionId; }));
      });
    }

    function applyTheme() {
      var langCopy = i18nApi() ? i18nApi().getCopy(state.lang) : null;
      if (window.SharedUiCore) {
        window.SharedUiCore.applyBodyTheme(state.theme);
      } else {
        document.body.classList.toggle('dark', state.theme === 'dark');
      }
      var button = document.getElementById('btn-theme');
      if (!button) return;
      button.setAttribute('aria-pressed', String(state.theme === 'dark'));
      var toggleThemeLabel = langCopy ? langCopy.toggleTheme : 'Toggle theme';
      button.setAttribute('title', toggleThemeLabel);
      button.setAttribute('aria-label', toggleThemeLabel);
      renderCards();
    }

    function toggleTheme() {
      state.theme = window.SharedUiCore ? window.SharedUiCore.toggleThemeValue(state.theme) : (state.theme === 'dark' ? 'light' : 'dark');
      localStorage.setItem('theme', state.theme);
      var button = document.getElementById('btn-theme');
      if (window.SharedUiCore && button) window.SharedUiCore.animateThemeButton(button, 420);
      applyTheme();
    }

    async function loadLandingCatalogs() {
      if (!window.SharedToolLandingCore || typeof window.SharedToolLandingCore.loadSectionCatalogs !== 'function') {
        return;
      }

      var loaded = await window.SharedToolLandingCore.loadSectionCatalogs(config.landingSections);
      if (loaded && loaded.length) {
        state.tools = loaded;
      }
    }

    function renderRelatedWork() {
      var root = document.getElementById('related-work-root');
      if (!root) return;
      if (!window.SharedRelatedWork?.init) {
        root.classList.add('hidden');
        return;
      }
      window.SharedRelatedWork.init({
        container: root,
        toolId: 'Landing',
        lang: state.lang,
        sourceUrl: config.relatedWorkSourceUrl,
        publicationsSourceUrl: window.PUBLICATIONS_SOURCE_URL || 'https://enheragu.github.io/publications-data.json',
      });
      var hasContent = root.children.length > 0 || root.textContent.trim().length > 0;
      root.classList.toggle('hidden', !hasContent);
    }

    function applyLanguage() {
      var langCopy = i18nApi() ? i18nApi().getCopy(state.lang) : null;
      if (!langCopy) return;
      document.documentElement.lang = state.lang;
      document.title = langCopy.pageTitle;
      setElText('site-title', langCopy.siteTitle);
      setElText('site-subtitle', langCopy.subtitle);
      setElText('intro-title', langCopy.introTitle);
      setElText('intro-text', langCopy.introText);
      setElText(config.toolsTitleElId, langCopy[config.toolsTitleI18nKey]);
      var footerReportProblem = document.getElementById('footer-report-problem');
      if (footerReportProblem) footerReportProblem.textContent = langCopy.reportProblem;
      if (window.SharedFooter?.setLang) window.SharedFooter.setLang(state.lang);

      if (window.SharedUiCore?.setLangSwitcherState) {
        window.SharedUiCore.setLangSwitcherState(state.lang, '#lang-switcher');
      } else {
        document.getElementById('btn-en').classList.toggle('active', state.lang === 'en');
        document.getElementById('btn-es').classList.toggle('active', state.lang === 'es');
        document.getElementById('lang-switcher').classList.toggle('lang-es', state.lang === 'es');
      }

      if (window.SharedUiCore) {
        window.SharedUiCore.syncLangInUrl(state.lang);
      } else {
        var url = new URL(window.location.href);
        url.searchParams.set('lang', state.lang);
        window.history.replaceState({}, '', url.toString());
      }

      document.documentElement.classList.remove('i18n-pending');
      renderCards();
      applyTheme();
      renderRelatedWork();
    }

    function setLang(lang) {
      state.lang = lang;
      if (i18nApi()?.setLang) i18nApi().setLang(lang);
      applyLanguage();
    }

    async function init() {
      state.lang = readLangFromUrl();

      if (window.SharedUiCore?.bindHeaderControls) {
        window.SharedUiCore.bindHeaderControls({
          themeButtonId: 'btn-theme',
          langSwitcherSelector: '#lang-switcher',
          onToggleTheme: toggleTheme,
          onToggleLang: function () {
            setLang(state.lang === 'en' ? 'es' : 'en');
          }
        });
      } else {
        document.getElementById('btn-theme').addEventListener('click', toggleTheme);
        document.querySelector('#lang-switcher').addEventListener('click', function () {
          setLang(state.lang === 'en' ? 'es' : 'en');
        });
      }

      applyLanguage();
      await loadLandingCatalogs();
      renderCards();
      focusSectionFromUrl();
    }

    return { init: init, setLang: setLang, toggleTheme: toggleTheme };
  }

  window.SharedToolLandingEngine = {
    create: create,
  };
})();
