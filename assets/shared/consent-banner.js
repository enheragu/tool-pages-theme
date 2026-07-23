/* =====================================================================
   SharedConsentBanner — cookie-consent banner for Google Analytics 4.
   Self-contained (injects its own styles); pairs with a gtag snippet that
   sets Consent Mode default to denied BEFORE gtag('config', ...):

     gtag('consent', 'default', { 'analytics_storage': 'denied', ... });

   Usage (after the gtag snippet):
     window.SharedConsentBanner.init();          // lang from <html lang>
     window.SharedConsentBanner.init({lang:'es'});
     window.SharedConsentBanner.reset();         // forget stored choice

   Choice persists in localStorage ('ga-consent': 'granted' | 'denied').
   While no choice is made (or on rejection) GA stays cookieless.
   ===================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'ga-consent';

  var TEXTS = {
    en: {
      msg: 'This site uses optional analytics cookies (Google Analytics) to understand how it is used.',
      accept: 'Accept',
      reject: 'Reject'
    },
    es: {
      msg: 'Este sitio usa cookies opcionales de analítica (Google Analytics) para entender cómo se usa.',
      accept: 'Aceptar',
      reject: 'Rechazar'
    }
  };

  function gtagSafe() {
    if (typeof window.gtag === 'function') {
      window.gtag.apply(null, arguments);
    }
  }

  function storedChoice() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function storeChoice(value) {
    try { localStorage.setItem(STORAGE_KEY, value); } catch (e) { /* private mode */ }
  }

  function applyChoice(value) {
    if (value === 'granted') {
      gtagSafe('consent', 'update', { analytics_storage: 'granted' });
    }
    // 'denied' needs no update: the page default is already denied.
  }

  function injectStyles() {
    if (document.getElementById('shared-consent-banner-css')) return;
    var css = [
      /* Floating card (bottom-right), matching the panel/card language of the
         sites; near-full-width bottom sheet on small screens. */
      '.shared-consent-banner {',
      '  position: fixed; bottom: 1rem; right: 1rem; z-index: 300;',
      '  max-width: 22rem;',
      '  display: flex; flex-direction: column; gap: 0.7rem;',
      '  padding: 0.9rem 1.1rem;',
      '  background: var(--clr-surface, #161b22);',
      '  color: var(--clr-text, #e6edf3);',
      '  border: 1px solid var(--clr-border, #30363d);',
      '  border-radius: 10px;',
      '  font-family: var(--font-sans, sans-serif); font-size: 0.85rem; line-height: 1.45;',
      '  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);',
      '}',
      '@media (max-width: 600px) {',
      '  .shared-consent-banner { left: 0.75rem; right: 0.75rem; bottom: 0.75rem; max-width: none; }',
      '}',
      '.shared-consent-banner p { margin: 0; }',
      '.shared-consent-banner-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }',
      '.shared-consent-banner button {',
      '  padding: 0.35rem 1rem; border-radius: 6px; cursor: pointer;',
      '  font: inherit; font-weight: 600;',
      '  border: 1px solid var(--clr-border, #30363d);',
      '  background: transparent; color: var(--clr-text, #e6edf3);',
      '}',
      '.shared-consent-banner button.accept {',
      '  background: var(--clr-primary, #58a6ff);',
      '  border-color: var(--clr-primary, #58a6ff);',
      '  color: var(--clr-bg, #0d1117);',
      '}',
      '.shared-consent-banner button:hover { filter: brightness(1.1); }'
    ].join('\n');
    var style = document.createElement('style');
    style.id = 'shared-consent-banner-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function showBanner(lang) {
    injectStyles();
    var t = TEXTS[lang] || TEXTS.en;

    var bar = document.createElement('div');
    bar.className = 'shared-consent-banner';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Cookie consent');

    var msg = document.createElement('p');
    msg.textContent = t.msg;

    var actions = document.createElement('div');
    actions.className = 'shared-consent-banner-actions';

    function choose(value) {
      storeChoice(value);
      applyChoice(value);
      bar.remove();
    }

    var accept = document.createElement('button');
    accept.className = 'accept';
    accept.textContent = t.accept;
    accept.addEventListener('click', function () { choose('granted'); });

    var reject = document.createElement('button');
    reject.textContent = t.reject;
    reject.addEventListener('click', function () { choose('denied'); });

    actions.appendChild(reject);
    actions.appendChild(accept);
    bar.appendChild(msg);
    bar.appendChild(actions);
    document.body.appendChild(bar);
  }

  function init(opts) {
    var choice = storedChoice();
    if (choice) {
      applyChoice(choice);
      return;
    }
    var lang = (opts && opts.lang) || (document.documentElement.lang || 'en').slice(0, 2);
    if (!TEXTS[lang]) lang = 'en';
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { showBanner(lang); }, { once: true });
    } else {
      showBanner(lang);
    }
  }

  window.SharedConsentBanner = {
    init: init,
    reset: function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
    }
  };
})();
