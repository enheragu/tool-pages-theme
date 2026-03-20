(function () {
  if (window.SharedI18nCore) return;

  function normalizeLang(lang, fallback) {
    if (lang === 'es' || lang === 'en') return lang;
    return fallback === 'es' ? 'es' : 'en';
  }

  function createI18n(translations, options) {
    var opts = options || {};
    var fallbackLang = normalizeLang(opts.fallbackLang || 'en', 'en');
    var currentLang = normalizeLang(opts.initialLang || fallbackLang, fallbackLang);

    function getLang() {
      return currentLang;
    }

    function setLang(lang) {
      currentLang = normalizeLang(lang, fallbackLang);
      return currentLang;
    }

    function getCopy(lang) {
      var normalized = normalizeLang(lang || currentLang, fallbackLang);
      return translations[normalized] || translations[fallbackLang] || {};
    }

    function t(key, vars, lang) {
      var text = getCopy(lang)[key];
      if (typeof text !== 'string') return key;
      var values = vars || {};
      Object.keys(values).forEach(function (token) {
        text = text.replaceAll('{' + token + '}', values[token]);
      });
      return text;
    }

    return {
      getLang: getLang,
      setLang: setLang,
      getCopy: getCopy,
      t: t,
      translations: translations,
    };
  }

  window.SharedI18nCore = {
    normalizeLang: normalizeLang,
    createI18n: createI18n,
  };
})();
