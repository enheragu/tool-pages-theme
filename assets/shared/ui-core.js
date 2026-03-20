(function () {
  if (window.SharedUiCore) return;

  function getPreferredTheme() {
    var saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function themeToggleMarkup(themeButtonId) {
    var id = themeButtonId || 'btn-theme';
    return '' +
      '<button id="' + id + '" class="theme-toggle" type="button" aria-label="Toggle theme" title="Toggle theme" aria-pressed="false">' +
      '<span class="theme-icon sun" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation" focusable="false"><path d="M12 4.75a.75.75 0 0 1 .75-.75h0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-.75.75h0a.75.75 0 0 1-.75-.75zm0 13a.75.75 0 0 1 .75-.75h0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-.75.75h0a.75.75 0 0 1-.75-.75zM5.97 6.78a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.06L5.97 7.84a.75.75 0 0 1 0-1.06zm9.9 9.9a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 1 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06zM4.75 12a.75.75 0 0 1 .75-.75H7a.75.75 0 0 1 0 1.5H5.5a.75.75 0 0 1-.75-.75zm13.5 0a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5H19a.75.75 0 0 1-.75-.75zM6.78 18.03a.75.75 0 0 1 0-1.06l1.06-1.06a.75.75 0 1 1 1.06 1.06l-1.06 1.06a.75.75 0 0 1-1.06 0zm9.9-9.9a.75.75 0 0 1 0-1.06l1.06-1.06a.75.75 0 0 1 1.06 1.06l-1.06 1.06a.75.75 0 0 1-1.06 0z"></path><circle cx="12" cy="12" r="3.75"></circle></svg></span>' +
      '<span class="theme-track" aria-hidden="true"><span class="theme-thumb"></span></span>' +
      '<span class="theme-icon moon" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation" focusable="false"><path d="M14.5 3.5a.75.75 0 0 1 .92-.73 8.75 8.75 0 1 1-10.65 10.65.75.75 0 0 1 .73-.92A7.25 7.25 0 0 0 14.5 3.5z"></path></svg></span>' +
      '</button>';
  }

  function ensureThemeToggleMarkup(config) {
    var opts = config || {};
    var themeButtonId = opts.themeButtonId || 'btn-theme';
    var existing = document.getElementById(themeButtonId);
    if (existing) return existing;

    var host = null;
    if (opts.hostElement && opts.hostElement.nodeType === 1) host = opts.hostElement;
    else host = document.querySelector(opts.hostSelector || '[data-theme-toggle-host]');
    if (!host) return null;

    host.innerHTML = themeToggleMarkup(themeButtonId);
    return document.getElementById(themeButtonId);
  }

  function langSwitcherMarkup(config) {
    var opts = config || {};
    var switcherId = opts.switcherId || 'lang-switcher';
    var includeId = opts.includeId !== false;
    var idAttr = includeId ? ' id="' + switcherId + '"' : '';

    return '' +
      '<div class="lang-switcher" role="group" aria-label="Language selector"' + idAttr + '>' +
      '<button id="btn-en" class="lang-btn active" type="button"><span class="flag-icon flag-gb" aria-hidden="true"></span><span>EN</span></button>' +
      '<button id="btn-es" class="lang-btn" type="button"><span class="flag-icon flag-es" aria-hidden="true"></span><span>ES</span></button>' +
      '</div>';
  }

  function ensureLangSwitcherMarkup(config) {
    var opts = config || {};
    var existing = document.querySelector(opts.switcherSelector || '.lang-switcher');
    if (existing) return existing;

    var host = null;
    if (opts.hostElement && opts.hostElement.nodeType === 1) host = opts.hostElement;
    else host = document.querySelector(opts.hostSelector || '[data-lang-switcher-host]');
    if (!host) return null;

    host.innerHTML = langSwitcherMarkup({ switcherId: opts.switcherId, includeId: opts.includeId !== false });
    return host.querySelector('.lang-switcher');
  }

  function setLangSwitcherState(lang, switcherSelector) {
    var normalized = lang === 'es' ? 'es' : 'en';
    var switcher = document.querySelector(switcherSelector || '.lang-switcher');
    if (!switcher) return normalized;

    var wasEs = switcher.classList.contains('lang-es');
    var nextEs = normalized === 'es';

    var btnEn = switcher.querySelector('#btn-en');
    var btnEs = switcher.querySelector('#btn-es');
    if (btnEn) btnEn.classList.toggle('active', normalized === 'en');
    if (btnEs) btnEs.classList.toggle('active', normalized === 'es');
    switcher.classList.toggle('lang-es', nextEs);

    // Force a visible thumb animation on real language changes.
    if (wasEs !== nextEs) {
      switcher.classList.remove('is-animating');
      void switcher.offsetWidth;
      switcher.classList.add('is-animating');
      window.setTimeout(function () {
        switcher.classList.remove('is-animating');
      }, 260);
    }

    return normalized;
  }

  function readLangFromUrl(fallback) {
    var params = new URLSearchParams(window.location.search || '');
    var lang = (params.get('lang') || '').toLowerCase();
    if (lang === 'en' || lang === 'es') return lang;
    return fallback === 'es' ? 'es' : 'en';
  }

  function syncLangInUrl(lang) {
    var normalized = lang === 'es' ? 'es' : 'en';
    var url = new URL(window.location.href);
    url.searchParams.set('lang', normalized);
    window.history.replaceState({}, '', url.toString());
  }

  function applyBodyTheme(theme) {
    var isDark = theme === 'dark';
    document.body.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }

  function setThemeForDocument(theme, options) {
    var opts = options || {};
    var resolved = theme === 'light' ? 'light' : 'dark';

    applyBodyTheme(resolved);

    if (opts.syncDataTheme !== false) {
      document.documentElement.setAttribute('data-theme', resolved);
    }

    var button = document.getElementById(opts.themeButtonId || 'btn-theme');
    if (button) {
      button.setAttribute('aria-pressed', String(resolved === 'dark'));
      button.setAttribute('title', resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      button.setAttribute('aria-label', resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }

    return resolved;
  }

  function toggleThemeValue(theme) {
    return theme === 'dark' ? 'light' : 'dark';
  }

  function animateThemeButton(button, duration) {
    if (!button) return;
    var ms = Number.isFinite(duration) ? duration : 420;
    button.classList.remove('is-animating');
    void button.offsetWidth;
    button.classList.add('is-animating');
    window.setTimeout(function () {
      button.classList.remove('is-animating');
    }, ms);
  }

  function initThemeToggle(config) {
    var opts = config || {};
    var buttonId = opts.themeButtonId || 'btn-theme';
    var themeButton = ensureThemeToggleMarkup({ themeButtonId: buttonId, hostSelector: opts.hostSelector, hostElement: opts.hostElement });
    if (!themeButton) return;

    var initial = getPreferredTheme();
    setThemeForDocument(initial, { themeButtonId: buttonId, syncDataTheme: opts.syncDataTheme !== false });

    if (themeButton.dataset.themeToggleBound === 'true') return;
    themeButton.dataset.themeToggleBound = 'true';

    themeButton.addEventListener('click', function (event) {
      if (opts.preventBubble !== false) event.stopPropagation();
      var current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      var next = toggleThemeValue(current);
      try {
        localStorage.setItem('theme', next);
      } catch (_e) {}
      animateThemeButton(themeButton, Number.isFinite(opts.animationMs) ? opts.animationMs : 420);
      var applied = setThemeForDocument(next, { themeButtonId: buttonId, syncDataTheme: opts.syncDataTheme !== false });
      if (typeof opts.onThemeChange === 'function') opts.onThemeChange(applied);
    });
  }

  function bindHeaderControls(config) {
    var opts = config || {};
    var themeButton = document.getElementById(opts.themeButtonId || 'btn-theme');
    var langSwitcher = document.querySelector(opts.langSwitcherSelector || '.lang-switcher');
    var langToggleMode = opts.langToggleMode || 'toggle';

    if (themeButton && typeof opts.onToggleTheme === 'function' && themeButton.dataset.sharedThemeToggleBound !== 'true') {
      themeButton.addEventListener('click', opts.onToggleTheme);
      themeButton.dataset.sharedThemeToggleBound = 'true';
    }

    if (langSwitcher && typeof opts.onToggleLang === 'function' && langSwitcher.dataset.sharedLangToggleBound !== 'true') {
      langSwitcher.addEventListener('click', function (event) {
        var target = event && event.target && typeof event.target.closest === 'function'
          ? event.target.closest('.lang-btn')
          : null;
        var requestedLang = null;
        if (target && target.id === 'btn-en') requestedLang = 'en';
        if (target && target.id === 'btn-es') requestedLang = 'es';
        if (langToggleMode === 'explicit') {
          opts.onToggleLang(requestedLang, event);
        } else {
          opts.onToggleLang(null, event);
        }
      });
      langSwitcher.dataset.sharedLangToggleBound = 'true';
    }
  }

  function createRafScheduler(callback) {
    if (typeof callback !== 'function') {
      return {
        schedule: function () {},
        cancel: function () {},
        isScheduled: function () { return false; }
      };
    }

    var rafId = 0;
    var pending = false;

    function run() {
      rafId = 0;
      if (!pending) return;
      pending = false;
      callback();
      if (pending) schedule();
    }

    function schedule() {
      pending = true;
      if (rafId) return;
      rafId = window.requestAnimationFrame(run);
    }

    function cancel() {
      pending = false;
      if (!rafId) return;
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }

    function isScheduled() {
      return pending || Boolean(rafId);
    }

    return {
      schedule: schedule,
      cancel: cancel,
      isScheduled: isScheduled
    };
  }

  function bindRangeControlGroup(config) {
    var opts = config || {};
    var items = Array.isArray(opts.items) ? opts.items : [];
    var onInput = typeof opts.onInput === 'function' ? opts.onInput : null;
    var onCommit = typeof opts.onCommit === 'function' ? opts.onCommit : null;
    var onReset = typeof opts.onReset === 'function' ? opts.onReset : null;
    var enableDoubleClickReset = opts.enableDoubleClickReset !== false;
    var cleanups = [];

    items.forEach(function (item) {
      if (!item || !item.input) return;
      var input = item.input;
      var key = item.key;
      var defaultValue = Number.isFinite(item.defaultValue) ? item.defaultValue : 0;

      var parse = function () {
        return Number(input.value) || 0;
      };

      var emitInput = function (event) {
        if (!onInput) return;
        onInput(key, parse(), input, event);
      };

      var emitCommit = function (event) {
        if (!onCommit) return;
        onCommit(key, parse(), input, event);
      };

      var handleDoubleClick = function (event) {
        if (!enableDoubleClickReset || input.disabled) return;
        event.preventDefault();
        var current = parse();
        if (current === defaultValue) return;
        input.value = String(defaultValue);
        if (onReset) onReset(key, defaultValue, input, event);
        if (onInput) onInput(key, defaultValue, input, event);
        if (onCommit) onCommit(key, defaultValue, input, event);
      };

      var handleKeyboardCommit = function (event) {
        if (event.key === 'Enter') emitCommit(event);
      };

      input.addEventListener('input', emitInput);
      input.addEventListener('change', emitCommit);
      input.addEventListener('pointerup', emitCommit);
      input.addEventListener('keyup', handleKeyboardCommit);
      if (enableDoubleClickReset) input.addEventListener('dblclick', handleDoubleClick);

      cleanups.push(function () {
        input.removeEventListener('input', emitInput);
        input.removeEventListener('change', emitCommit);
        input.removeEventListener('pointerup', emitCommit);
        input.removeEventListener('keyup', handleKeyboardCommit);
        if (enableDoubleClickReset) input.removeEventListener('dblclick', handleDoubleClick);
      });
    });

    return function cleanup() {
      cleanups.forEach(function (fn) { fn(); });
    };
  }

  window.SharedUiCore = {
    getPreferredTheme: getPreferredTheme,
    readLangFromUrl: readLangFromUrl,
    syncLangInUrl: syncLangInUrl,
    applyBodyTheme: applyBodyTheme,
    setThemeForDocument: setThemeForDocument,
    toggleThemeValue: toggleThemeValue,
    animateThemeButton: animateThemeButton,
    themeToggleMarkup: themeToggleMarkup,
    ensureThemeToggleMarkup: ensureThemeToggleMarkup,
    langSwitcherMarkup: langSwitcherMarkup,
    ensureLangSwitcherMarkup: ensureLangSwitcherMarkup,
    setLangSwitcherState: setLangSwitcherState,
    initThemeToggle: initThemeToggle,
    bindHeaderControls: bindHeaderControls,
    createRafScheduler: createRafScheduler,
    bindRangeControlGroup: bindRangeControlGroup,
  };
})();
