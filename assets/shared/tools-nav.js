(function () {
  if (window.SharedToolsNav) return;

  function getLangFromUrl() {
    var params = new URLSearchParams(window.location.search || '');
    var lang = (params.get('lang') || '').toLowerCase();
    return (lang === 'es' || lang === 'en') ? lang : 'en';
  }

  function localize(value, lang) {
    if (!value || typeof value !== 'object') return value;
    return value[lang] || value.en || Object.values(value)[0] || '';
  }

  function withLang(href, lang, preserveLangParam) {
    if (!preserveLangParam || !href || href.indexOf('#') === 0) return href;
    if (/^https?:\/\//i.test(href)) return href;
    if (href.indexOf('lang=') >= 0) return href;

    var separator = href.indexOf('?') >= 0 ? '&' : '?';
    return href + separator + 'lang=' + encodeURIComponent(lang);
  }

  function isCurrentPath(itemHref, currentPath) {
    if (!itemHref) return false;
    var pathOnly = itemHref.split('?')[0].replace(/\/+$/, '');
    var current = (currentPath || window.location.pathname).replace(/\/+$/, '');
    return pathOnly === current;
  }

  function normalizeSections(config) {
    var sections = Array.isArray(config.menuSections) ? config.menuSections : [];
    if (sections.length) {
      return sections.map(function (section) {
        return {
          title: section && section.title,
          items: Array.isArray(section && section.items) ? section.items : [],
        };
      }).filter(function (section) {
        return section.items.length > 0;
      });
    }

    return [{ title: null, items: Array.isArray(config.menuItems) ? config.menuItems : [] }];
  }

  function buildMenu(config, lang) {
    var menu = document.createElement('nav');
    menu.className = 'nav-menu';
    menu.setAttribute('id', 'navMenu');
    menu.setAttribute('aria-label', localize(config.menuAriaLabel || { en: 'Tools menu', es: 'Menú de herramientas' }, lang));

    normalizeSections(config).forEach(function (section) {
      var group = document.createElement('div');
      group.className = 'nav-menu-group';

      var title = localize(section.title, lang);
      if (title) {
        group.classList.add('nav-menu-group--titled');
        var heading = document.createElement('h4');
        heading.className = 'nav-menu-group-title';
        heading.textContent = title;
        group.appendChild(heading);
      } else {
        group.classList.add('nav-menu-group--untitled');
      }

      section.items.forEach(function (item) {
        var a = document.createElement('a');
        a.className = 'nav-menu-item';
        var href = withLang(item.href, lang, config.preserveLangParam !== false);
        a.href = href;
        a.textContent = localize(item.label, lang);
        if (isCurrentPath(item.href, config.currentPath)) {
          a.classList.add('active');
        }
        group.appendChild(a);
      });

      menu.appendChild(group);
    });

    return menu;
  }

  function injectBackButton(config, lang) {
    if (!config.showBackButton) return;
    if (document.querySelector('.tools-nav-back')) return;

    var titleContainer = document.querySelector('.header-inner > div:first-child');
    var title = titleContainer ? titleContainer.querySelector('h1') : null;
    if (!title || !titleContainer) return;

    var row = document.createElement('div');
    row.className = 'tools-nav-title-row';

    var back = document.createElement('a');
    back.className = 'tools-nav-back';
    back.href = withLang(config.homePath || '/stat-tools/', lang, config.preserveLangParam !== false);
    back.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 18l-6-6 6-6"></path></svg>';
    back.setAttribute('aria-label', localize(config.backLabel || { en: 'Back to landing', es: 'Volver al inicio' }, lang));
    back.title = localize(config.backLabel || { en: 'Back to landing', es: 'Volver al inicio' }, lang);

    title.parentNode.insertBefore(row, title);
    row.appendChild(back);
    row.appendChild(title);
  }

  function init(userConfig) {
    var config = Object.assign({
      showBackButton: false,
      preserveLangParam: true,
      homePath: '/',
      menuItems: []
    }, userConfig || {});

    var lang = getLangFromUrl();
    injectBackButton(config, lang);

    if (document.getElementById('hamburgerBtn')) return;

    var langSwitcher = document.querySelector('.lang-switcher');
    var themeToggle = document.getElementById('btn-theme');

    var floatingControls = document.getElementById('toolsNavFloatingControls');
    if (!floatingControls) {
      floatingControls = document.createElement('div');
      floatingControls.className = 'tools-nav-floating-controls';
      floatingControls.id = 'toolsNavFloatingControls';
    }

    var toggle = document.createElement('button');
    toggle.id = 'hamburgerBtn';
    toggle.className = 'hamburger-btn';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', localize(config.menuButtonLabel || { en: 'Open navigation menu', es: 'Abrir menú de navegación' }, lang));
    toggle.innerHTML = '<span></span><span></span><span></span>';

    var menu = buildMenu(config, lang);

    var overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    overlay.id = 'navOverlay';

    function closeMenu() {
      toggle.classList.remove('open');
      menu.classList.remove('open');
      overlay.classList.remove('open');
      floatingControls.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      if (themeToggle) {
        themeToggle.setAttribute('aria-hidden', 'true');
        themeToggle.setAttribute('tabindex', '-1');
      }
    }

    function openMenu() {
      toggle.classList.add('open');
      menu.classList.add('open');
      overlay.classList.add('open');
      floatingControls.classList.add('menu-open');
      toggle.setAttribute('aria-expanded', 'true');
      if (themeToggle) {
        themeToggle.removeAttribute('aria-hidden');
        themeToggle.removeAttribute('tabindex');
      }
    }

    toggle.addEventListener('click', function () {
      if (menu.classList.contains('open')) closeMenu();
      else openMenu();
    });
    toggle.setAttribute('aria-expanded', 'false');

    overlay.addEventListener('click', closeMenu);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMenu();
    });
    menu.addEventListener('click', function (event) {
      if (event.target && event.target.closest('a.nav-menu-item')) closeMenu();
    });

    if (langSwitcher) floatingControls.appendChild(langSwitcher);
    if (themeToggle) {
      themeToggle.classList.add('tools-nav-theme-float');
      themeToggle.setAttribute('aria-hidden', 'true');
      themeToggle.setAttribute('tabindex', '-1');
      floatingControls.appendChild(themeToggle);
    }
    floatingControls.appendChild(toggle);
    document.body.appendChild(floatingControls);
    document.body.appendChild(menu);
    document.body.appendChild(overlay);
  }

  window.SharedToolsNav = { init: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      window.SharedToolsNav.init(window.ToolsNavConfig || {});
    });
  } else {
    window.SharedToolsNav.init(window.ToolsNavConfig || {});
  }
})();