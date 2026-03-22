(function () {
  if (window.SharedRelatedWork) return;

  var DEFAULT_SOURCE = '/assets/shared/related-work.json';
  var LOCAL_JEKYLL_SOURCE = 'http://127.0.0.1:4000/assets/shared/related-work.json';
  var FALLBACK_SOURCE = 'https://enheragu.github.io/tool-pages-theme/assets/shared/related-work.json';
  var DEFAULT_PUBLICATIONS_SOURCE = 'https://raw.githubusercontent.com/enheragu/enheragu.github.io/master/_data/publications.yml';
  var LOCAL_PUBLICATIONS_SOURCE = '/stat-tools/assets/publications-data.json';
  var EMPTY_DATASET = { tools: {}, publications: [] };

  function extractGitHubRepoSlug(url) {
    var href = String(url || '').trim();
    if (!href) return '';
    var m = href.match(/^https?:\/\/github\.com\/([^\/\s]+)\/([^\/\s?#]+)(?:[\/\s?#].*)?$/i);
    if (!m) return '';
    return m[1] + '/' + m[2];
  }

  function ensureSharedRepoCards() {
    if (window.SharedRepoCards && typeof window.SharedRepoCards.getRepoInfo === 'function') {
      return Promise.resolve(window.SharedRepoCards);
    }

    if (window.__sharedRepoCardsLoaderPromise) {
      return window.__sharedRepoCardsLoaderPromise;
    }

    window.__sharedRepoCardsLoaderPromise = new Promise(function (resolve) {
      if (window.SharedRepoCards && typeof window.SharedRepoCards.getRepoInfo === 'function') {
        resolve(window.SharedRepoCards);
        return;
      }

      var existing = document.querySelector('script[data-shared-repo-cards]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.SharedRepoCards || null); }, { once: true });
        existing.addEventListener('error', function () { resolve(null); }, { once: true });
        return;
      }

      var script = document.createElement('script');
      script.src = '/assets/shared/repo-cards.js';
      script.setAttribute('data-shared-repo-cards', '1');
      script.onload = function () { resolve(window.SharedRepoCards || null); };
      script.onerror = function () {
        script.onerror = function () {
          script.onerror = null;
          resolve(null);
        };
        script.onload = function () { resolve(window.SharedRepoCards || null); };
        script.src = 'https://enheragu.github.io/tool-pages-theme/assets/shared/repo-cards.js';
      };
      document.head.appendChild(script);
    });

    return window.__sharedRepoCardsLoaderPromise;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function resolveLang(options) {
    if (options && (options.lang === 'en' || options.lang === 'es')) return options.lang;
    var docLang = (document.documentElement.lang || '').toLowerCase();
    if (docLang.startsWith('es')) return 'es';
    return 'en';
  }

  function pickLangText(multilang, lang, fallback) {
    if (!multilang || typeof multilang !== 'object') return fallback || '';
    if (typeof multilang[lang] === 'string' && multilang[lang].trim()) return multilang[lang];
    if (typeof multilang.en === 'string' && multilang.en.trim()) return multilang.en;
    if (typeof multilang.es === 'string' && multilang.es.trim()) return multilang.es;
    return fallback || '';
  }

  function fetchJson(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function fetchText(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    });
  }

  function candidateSources(sourceUrl) {
    var sources = [];
    var primary = sourceUrl || DEFAULT_SOURCE;
    sources.push(primary);

    var isLocalHost = /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname || '');
    var notJekyllPort = String(window.location.port || '') !== '4000';
    if (isLocalHost && notJekyllPort && primary !== LOCAL_JEKYLL_SOURCE) {
      sources.push(LOCAL_JEKYLL_SOURCE);
    }

    if (!isLocalHost && primary !== FALLBACK_SOURCE) {
      sources.push(FALLBACK_SOURCE);
    }
    return sources;
  }

  function loadDataset(sourceUrl) {
    var sources = candidateSources(sourceUrl);
    var index = 0;

    function attempt() {
      if (index >= sources.length) {
        throw new Error('Could not load related-work dataset');
      }
      var current = sources[index++];
      return fetchJson(current).catch(attempt);
    }

    return attempt();
  }

  function candidatePublicationSources(sourceUrl) {
    var sources = [];
    var inputSource = sourceUrl;

    // Legacy: _data paths are not served by Jekyll over HTTP. Skip them silently.
    if (typeof inputSource === 'string' && /\/_data\/publications\.yml$/.test(inputSource)) {
      inputSource = null;
    }

    // On localhost, try the locally-served asset first (symlinked from the CV data).
    var isLocalHost = /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname || '');
    if (isLocalHost && inputSource !== LOCAL_PUBLICATIONS_SOURCE) {
      sources.push(LOCAL_PUBLICATIONS_SOURCE);
    }

    if (inputSource) sources.push(inputSource);
    sources.push(DEFAULT_PUBLICATIONS_SOURCE);

    return sources.filter(function (value, index, self) {
      return value && self.indexOf(value) === index;
    });
  }

  function parseScalar(value) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return '';
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      return text.slice(1, -1);
    }
    if (/^-?\d+$/.test(text)) return Number(text);
    return text;
  }

  function parsePublicationsYaml(yamlText) {
    var categories = [];
    var currentCategory = null;
    var currentEntry = null;
    var inAuthors = false;
    var lines = String(yamlText || '').split(/\r?\n/);

    lines.forEach(function (line) {
      if (!line || !line.trim()) return;
      var indent = (line.match(/^\s*/) || [''])[0].length;
      var trimmed = line.trim();

      if (indent === 0 && /^-\s+category:/.test(trimmed)) {
        currentCategory = {
          category: parseScalar(trimmed.replace(/^-\s+category:\s*/, '')),
          entries: [],
        };
        categories.push(currentCategory);
        currentEntry = null;
        inAuthors = false;
        return;
      }

      if (!currentCategory) return;

      if (indent === 4 && /^-\s+key:/.test(trimmed)) {
        currentEntry = {
          key: parseScalar(trimmed.replace(/^-\s+key:\s*/, '')),
        };
        currentCategory.entries.push(currentEntry);
        inAuthors = false;
        return;
      }

      if (!currentEntry) return;

      if (indent === 6 && /^authors:\s*$/.test(trimmed)) {
        currentEntry.authors = [];
        inAuthors = true;
        return;
      }

      if (inAuthors && indent === 8 && /^-\s+/.test(trimmed)) {
        currentEntry.authors.push(parseScalar(trimmed.replace(/^-\s+/, '')));
        return;
      }

      if (indent === 6 && /^([a-zA-Z0-9_]+):/.test(trimmed)) {
        var splitIndex = trimmed.indexOf(':');
        var field = trimmed.slice(0, splitIndex).trim();
        var value = parseScalar(trimmed.slice(splitIndex + 1));
        currentEntry[field] = value;
        inAuthors = false;
        return;
      }

      if (indent <= 6) inAuthors = false;
    });

    return categories;
  }

  function loadPublications(sourceUrl) {
    var sources = candidatePublicationSources(sourceUrl);
    var index = 0;

    function attempt() {
      if (index >= sources.length) {
        return Promise.resolve([]);
      }
      var current = sources[index++];
      if (/\.json$/i.test(current)) {
        return fetchJson(current)
          .then(function (data) {
            if (Array.isArray(data) && data.length) return data;
            return attempt();
          })
          .catch(attempt);
      }
      return fetchText(current)
        .then(parsePublicationsYaml)
        .catch(attempt);
    }

    return attempt();
  }

  function normalizeDataset(data) {
    if (data && data.tools && typeof data.tools === 'object') {
      if (!data.global || typeof data.global !== 'object') data.global = {};
      if (!data.categories || typeof data.categories !== 'object') data.categories = {};
      if (!Array.isArray(data.publications)) data.publications = [];
      return data;
    }
    if (data && typeof data === 'object') {
      return { global: {}, categories: {}, tools: data, publications: [] };
    }
    return { global: {}, categories: {}, tools: {}, publications: [] };
  }

  function shallowMerge(base, override) {
    var result = {};
    if (base && typeof base === 'object') {
      Object.keys(base).forEach(function (key) {
        result[key] = base[key];
      });
    }
    if (override && typeof override === 'object') {
      Object.keys(override).forEach(function (key) {
        result[key] = override[key];
      });
    }
    return result;
  }

  function mergeSupport(base, override) {
    var merged = shallowMerge(base || {}, override || {});
    merged.title = shallowMerge((base && base.title) || {}, (override && override.title) || {});
    merged.repo = shallowMerge((base && base.repo) || {}, (override && override.repo) || {});
    merged.citation = shallowMerge((base && base.citation) || {}, (override && override.citation) || {});
    return merged;
  }

  function resolveItem(data, toolId) {
    var tools = data && data.tools;
    var categories = data && data.categories;
    var global = (data && data.global) || {};
    var tool = tools && tools[toolId];
    if (!tool || typeof tool !== 'object') return null;

    var categoryId = tool.category_id || tool.category || '';
    var category = (categoryId && categories && categories[categoryId]) || {};

    var resolved = {
      title: shallowMerge(global.title || {}, category.title || {}),
      links: []
        .concat(Array.isArray(global.links) ? global.links : [])
        .concat(Array.isArray(category.links) ? category.links : [])
        .concat(Array.isArray(tool.links) ? tool.links : []),
      publication_keys: []
        .concat(Array.isArray(global.publication_keys) ? global.publication_keys : [])
        .concat(Array.isArray(category.publication_keys) ? category.publication_keys : [])
        .concat(Array.isArray(tool.publication_keys) ? tool.publication_keys : []),
      support: mergeSupport(mergeSupport(global.support || {}, category.support || {}), tool.support || {}),
    };

    if (tool.title && typeof tool.title === 'object') {
      resolved.title = shallowMerge(resolved.title, tool.title);
    }

    return resolved;
  }

  function buildPublicationIndex(categories) {
    var index = {};
    (Array.isArray(categories) ? categories : []).forEach(function (category) {
      (category && Array.isArray(category.entries) ? category.entries : []).forEach(function (entry) {
        if (entry && entry.key) {
          index[entry.key] = {
            key: entry.key,
            category: category.category || '',
            entry: entry,
          };
        }
      });
    });
    return index;
  }

  function renderPublicationActions(entry, lang) {
    if (window.SharedPublicationUI && typeof window.SharedPublicationUI.renderActions === 'function') {
      return window.SharedPublicationUI.renderActions(entry, {
        lang: lang,
        variant: 'related',
      });
    }

    var links = [];
    if (entry.url) {
      links.push('<a class="related-work-inline-link" href="' + escapeHtml(entry.url) + '" target="_blank" rel="noopener noreferrer">[link]</a>');
    }
    if (entry.doi) {
      var doiHref = /^https?:\/\//i.test(String(entry.doi)) ? String(entry.doi) : ('https://doi.org/' + String(entry.doi));
      links.push('<a class="related-work-inline-link" href="' + escapeHtml(doiHref) + '" target="_blank" rel="noopener noreferrer">[doi]</a>');
    }
    var linkHtml = links.length ? (' ' + links.join(' ')) : '';
    return linkHtml;
  }

  function renderPublicationItem(pub, lang) {
    var locale = (lang === 'es') ? 'es' : 'en';
    var category = escapeHtml(pub.category || (locale === 'es' ? 'Trabajo' : 'Work'));
    var entry = pub.entry || {};
    var authors = Array.isArray(entry.authors) ? entry.authors.join(', ') : '';
    var authorsHtml = authors
      ? '<cite><small>' + escapeHtml(authors) + '. </small></cite>'
      : '';
    var yearTitle = (entry.year ? '(' + escapeHtml(entry.year) + '). ' : '') + escapeHtml(entry.title || 'Untitled publication');
    var venueHtml = entry.venue ? ' <em>' + escapeHtml(entry.venue) + '</em>.' : '';
    var actionsHtml = renderPublicationActions(entry, locale);

    var keyAttr = pub.key ? (' data-pub-key="' + escapeHtml(pub.key) + '"') : '';

    return '' +
      '<li class="related-work-item related-work-item-pub"' + keyAttr + '>' +
      '<span class="related-work-type-badge">' + category + '</span>' +
      authorsHtml +
      '<strong>' + yearTitle + '</strong>.' +
      venueHtml +
      actionsHtml +
      '</li>';
  }

  function renderRepoRelatedItem(entry, lang) {
    var locale = (lang === 'es') ? 'es' : 'en';
    var href = String(entry && entry.url ? entry.url : '#');
    var slug = extractGitHubRepoSlug(href);
    var fallbackLabel = slug ? (slug.split('/')[1] || slug) : 'repository';
    var label = String(entry && entry.label ? entry.label : fallbackLabel);
    var descriptionOverride = pickLangText(entry && entry.description_override, locale, '');
    var descriptionFallback = pickLangText(entry && entry.description, locale, '');
    var badgeText = locale === 'es' ? 'Repositorio' : 'Repository';

    var descText = descriptionOverride || descriptionFallback;
    var descHtml = descText
      ? '<span class="related-work-link-desc"> — ' + escapeHtml(descText) + '</span>'
      : '<span class="related-work-link-desc" data-related-repo-desc> — ' + (locale === 'es' ? 'Cargando descripción…' : 'Loading description...') + '</span>';

    var key = entry && entry.key ? String(entry.key).trim() : '';
    var keyAttr = key ? (' data-pub-key="' + escapeHtml(key) + '"') : '';
    var slugAttr = slug ? (' data-related-repo="' + escapeHtml(slug) + '"') : '';
    var noFetchAttr = descriptionOverride ? ' data-related-repo-no-fetch="1"' : '';
    var fallbackAttr = descriptionFallback ? (' data-related-repo-fallback="' + escapeHtml(descriptionFallback) + '"') : '';
    var linkBadge = href && href !== '#'
      ? ' <a class="related-work-inline-link link-badge" href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">[link]</a>'
      : '';

    return '' +
      '<li class="related-work-item related-work-item-pub related-work-item-repo"' + keyAttr + slugAttr + noFetchAttr + fallbackAttr + '>' +
      '<span class="related-work-type-badge">' + escapeHtml(badgeText) + '</span>' +
      '<strong>' + escapeHtml(label) + '</strong>' +
      linkBadge +
      descHtml +
      '</li>';
  }

  function hydrateRepoRelatedItems(container, lang) {
    var locale = (lang === 'es') ? 'es' : 'en';
    var rows = Array.prototype.slice.call(container.querySelectorAll('[data-related-repo]'));
    rows.forEach(function (row) {
      if (!row || row.getAttribute('data-related-repo-no-fetch') === '1') return;
      var slug = String(row.getAttribute('data-related-repo') || '').trim();
      if (!slug) return;
      var descNode = row.querySelector('[data-related-repo-desc], .related-work-link-desc');
      if (!descNode) return;

      ensureSharedRepoCards().then(function (api) {
        if (!api || typeof api.getRepoInfo !== 'function') return null;
        return api.getRepoInfo(slug);
      }).then(function (info) {
        var fallback = String(row.getAttribute('data-related-repo-fallback') || '').trim();
        var desc = info && info.description ? String(info.description).trim() : '';
        var text = desc || fallback;
        if (!text) {
          descNode.textContent = locale === 'es' ? ' — Sin descripción.' : ' — No description.';
          return;
        }
        descNode.textContent = ' — ' + text;
      });
    });
  }

  function renderSupportPublicationItem(pub, lang) {
    var locale = (lang === 'es') ? 'es' : 'en';
    var entry = pub.entry || {};
    var category = escapeHtml(pub.category || (locale === 'es' ? 'Trabajo' : 'Work'));
    var authors = Array.isArray(entry.authors) ? entry.authors.join(', ') : '';
    var authorsHtml = authors
      ? '<cite><small>' + escapeHtml(authors) + '. </small></cite>'
      : '';
    var title = escapeHtml(entry.title || 'Untitled work');
    var yearPrefix = entry.year ? ('(' + escapeHtml(entry.year) + ') ') : '';
    var versionHtml = entry.version
      ? (' <small class="related-work-meta">' + (locale === 'es' ? 'Versión ' : 'Version ') + escapeHtml(String(entry.version)) + '</small>')
      : '';
    var actionsHtml = renderPublicationActions(entry, locale);

    var keyAttr = pub.key ? (' data-pub-key="' + escapeHtml(pub.key) + '"') : '';

    return '' +
      '<li class="related-work-item related-work-item-pub related-work-item-cite"' + keyAttr + '>' +
      '<span class="related-work-type-badge">' + category + '</span>' +
      authorsHtml +
      '<strong>' + yearPrefix + title + '</strong>' +
      versionHtml +
      actionsHtml +
      '</li>';
  }

  function slugifyKey(key) {
    return String(key || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'ref';
  }

  function ensurePublicationEntryAnchors(container) {
    var entries = Array.prototype.slice.call(container.querySelectorAll('[data-pub-key]'));
    var keyToId = {};
    var orderedKeys = [];

    entries.forEach(function (entry) {
      var key = (entry.getAttribute('data-pub-key') || '').trim();
      if (!key) return;
      if (keyToId[key]) {
        entry.setAttribute('id', keyToId[key]);
        return;
      }
      var id = 'rw-ref-' + slugifyKey(key);
      var suffix = 2;
      while (document.getElementById(id)) {
        id = 'rw-ref-' + slugifyKey(key) + '-' + suffix;
        suffix += 1;
      }
      entry.setAttribute('id', id);
      keyToId[key] = id;
      orderedKeys.push(key);
    });

    return { keyToId: keyToId, orderedKeys: orderedKeys };
  }

  function parseCiteKeys(raw) {
    return String(raw || '')
      .split(/[;,]/)
      .map(function (part) { return part.trim(); })
      .filter(Boolean);
  }

  function collectInlineCiteKeys() {
    var keys = [];
    var seen = {};
    var targets = Array.prototype.slice.call(document.querySelectorAll('[data-inline-cite]'));
    targets.forEach(function (target) {
      var html = target.innerHTML || '';
      var regex = /\\cite\{([^}]+)\}/g;
      var match;
      while ((match = regex.exec(html)) !== null) {
        parseCiteKeys(match[1]).forEach(function (key) {
          if (!key || seen[key]) return;
          seen[key] = true;
          keys.push(key);
        });
      }
    });
    return keys;
  }

  function applyInlineCitations(toolId, lang, keyToId, orderedKeys) {
    var targets = Array.prototype.slice.call(document.querySelectorAll('[data-inline-cite]'));
    if (!targets.length) return;

    var numberByKey = {};
    orderedKeys.forEach(function (key, index) {
      numberByKey[key] = index + 1;
    });

    targets.forEach(function (target) {
      var html = target.innerHTML;
      if (!html || html.indexOf('\\cite{') === -1) return;

      var replaced = html.replace(/\\cite\{([^}]+)\}/g, function (_, keysText) {
        var keys = parseCiteKeys(keysText);
        if (!keys.length) return '';

        var rendered = keys.map(function (key) {
          var refId = keyToId[key];
          var n = numberByKey[key];
          if (!refId || !n) return '[?]';
          var label = lang === 'es' ? ('Ver referencia ' + n) : ('Open reference ' + n);
          return '<a class="inline-cite-link" href="#' + escapeHtml(refId) + '" data-inline-cite-key="' + escapeHtml(key) + '" data-inline-cite-tool="' + escapeHtml(toolId) + '" aria-label="' + escapeHtml(label) + '">[' + n + ']</a>';
        });

        return rendered.join('');
      });

      if (replaced !== html) target.innerHTML = replaced;
    });

    bindInlineCitationFlash();
  }

  function flashRelatedWorkTarget(hash) {
    if (!hash || hash.charAt(0) !== '#') return;
    var target = document.getElementById(hash.slice(1));
    if (!target) return;
    target.classList.remove('related-work-item--flash');
    void target.offsetWidth;
    target.classList.add('related-work-item--flash');
    window.setTimeout(function () {
      target.classList.remove('related-work-item--flash');
    }, 1700);
  }

  function ensureInlineCiteTooltip() {
    var tooltip = document.getElementById('inline-cite-tooltip');
    if (tooltip) return tooltip;
    tooltip = document.createElement('div');
    tooltip.id = 'inline-cite-tooltip';
    tooltip.className = 'inline-cite-tooltip hidden';
    tooltip.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function positionInlineCiteTooltip(tooltip, link) {
    if (!tooltip || !link) return;
    var rect = link.getBoundingClientRect();
    var pad = 10;
    var maxWidth = Math.min(window.innerWidth - 16, 620);
    tooltip.style.maxWidth = maxWidth + 'px';
    tooltip.style.left = '0px';
    tooltip.style.top = '0px';
    var tipRect = tooltip.getBoundingClientRect();
    var top = window.scrollY + rect.top - tipRect.height - 8;
    if (top < window.scrollY + 8) {
      top = window.scrollY + rect.bottom + 8;
    }
    var left = window.scrollX + rect.left + (rect.width / 2) - (tipRect.width / 2);
    left = Math.max(window.scrollX + pad, Math.min(left, window.scrollX + window.innerWidth - tipRect.width - pad));
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function showInlineCiteTooltip(link) {
    if (!link) return;
    var href = link.getAttribute('href') || '';
    if (!href || href.charAt(0) !== '#') return;
    var target = document.getElementById(href.slice(1));
    if (!target) return;
    var tooltip = ensureInlineCiteTooltip();
    var body = buildTooltipFromRelatedItem(target);
    if (!body) return;

    tooltip.innerHTML = '';
    tooltip.appendChild(body);
    tooltip.classList.remove('hidden');
    positionInlineCiteTooltip(tooltip, link);
  }

  function buildTooltipFromRelatedItem(itemNode) {
    if (!itemNode) return null;

    var clone = itemNode.cloneNode(true);
    clone.removeAttribute('id');
    clone.classList.remove('related-work-item--flash');

    var list = document.createElement('ul');
    list.className = 'related-work-list';
    list.appendChild(clone);

    var body = document.createElement('div');
    body.className = 'inline-cite-tooltip-body';
    body.appendChild(list);

    return body;
  }

  function hideInlineCiteTooltip() {
    var tooltip = document.getElementById('inline-cite-tooltip');
    if (!tooltip) return;
    tooltip.classList.add('hidden');
  }

  function bindInlineCitationFlash() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.inline-cite-link'));
    links.forEach(function (link) {
      if (link.dataset.inlineCiteFlashBound === '1') return;
      link.dataset.inlineCiteFlashBound = '1';
      link.addEventListener('mouseenter', function () {
        showInlineCiteTooltip(link);
      });
      link.addEventListener('mouseleave', hideInlineCiteTooltip);
      link.addEventListener('focus', function () {
        showInlineCiteTooltip(link);
      });
      link.addEventListener('blur', hideInlineCiteTooltip);
      link.addEventListener('click', function () {
        var href = link.getAttribute('href') || '';
        window.setTimeout(function () {
          flashRelatedWorkTarget(href);
        }, 0);
      });
    });

    window.addEventListener('scroll', hideInlineCiteTooltip, { passive: true });
    window.addEventListener('resize', hideInlineCiteTooltip);
  }

  function renderIntroWithRepoLink(template, repoUrl, repoText) {
    var safeTemplate = escapeHtml(template || '');
    var safeRepoText = escapeHtml(repoText || 'repository');
    var repoAnchor = repoUrl
      ? '<a class="related-work-link" href="' + escapeHtml(repoUrl) + '" target="_blank" rel="noopener noreferrer">' + safeRepoText + '</a>'
      : safeRepoText;

    if (safeTemplate.indexOf('{repo_link}') >= 0) {
      return safeTemplate.replace('{repo_link}', repoAnchor);
    }
    return safeTemplate;
  }

  function render(container, toolId, options) {
    var rawData = options && options.data;
    var data = normalizeDataset(rawData);
    var lang = resolveLang(options || {});
    var item = resolveItem(data, toolId);

    var shell = container.closest('.related-work-shell');
    var shellTitle = shell ? shell.querySelector('[data-related-work-shell-title], #related-work-shell-title') : null;

    if (!item) {
      container.innerHTML = '';
      if (shell) shell.classList.add('hidden');
      return;
    }

    var links = Array.isArray(item.links) ? item.links : [];
    var publicationKeys = Array.isArray(item.publication_keys) ? item.publication_keys : [];
    var dedupPublicationKeys = [];
    var publicationSeen = {};
    publicationKeys.forEach(function (key) {
      if (!key || publicationSeen[key]) return;
      publicationSeen[key] = true;
      dedupPublicationKeys.push(key);
    });
    var publicationIndex = buildPublicationIndex(data.publications);
    var publications = dedupPublicationKeys
      .map(function (key) { return publicationIndex[key]; })
      .filter(Boolean);

    var support = item.support && typeof item.support === 'object' ? item.support : null;
    var supportRepoUrl = support && support.repo ? support.repo.url : '';
    var supportRepoLabel = support && support.repo
      ? pickLangText(support.repo.link_text || support.repo.label, lang, (lang === 'es' ? 'repositorio' : 'repository'))
      : (lang === 'es' ? 'repositorio' : 'repository');
    var supportIntroText = support && support.intro ? pickLangText(support.intro, lang, '') : '';
    var supportDoiLinks = support && Array.isArray(support.doi_links) ? support.doi_links : [];
    var supportPublicationKeys = support && Array.isArray(support.publication_keys) ? support.publication_keys : [];
    var dedupSupportPublicationKeys = [];
    var supportPublicationSeen = {};
    supportPublicationKeys.forEach(function (key) {
      if (!key || supportPublicationSeen[key]) return;
      supportPublicationSeen[key] = true;
      dedupSupportPublicationKeys.push(key);
    });
    var inlineCiteKeys = collectInlineCiteKeys();
    inlineCiteKeys.forEach(function (key) {
      if (!key || supportPublicationSeen[key]) return;
      if (!publicationIndex[key]) return;
      supportPublicationSeen[key] = true;
      dedupSupportPublicationKeys.push(key);
    });
    var supportPublications = dedupSupportPublicationKeys
      .map(function (key) { return publicationIndex[key]; })
      .filter(Boolean);

    var supportDoiItems = supportDoiLinks.map(function (entry) {
      var label = pickLangText(entry && entry.label, lang, 'DOI');
      var href = entry && entry.url ? String(entry.url) : '';
      if (!href) return '';
      return '<li class="related-work-item related-work-item-link"><a class="related-work-link" href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(label) + '</a></li>';
    }).filter(Boolean).join('');

    if (!links.length && !publications.length && !supportRepoUrl && !supportIntroText && !supportDoiItems && !supportPublications.length) {
      container.innerHTML = '';
      if (shell) shell.classList.add('hidden');
      return;
    }

    var title = pickLangText(item.title, lang, (lang === 'es' ? 'Citas y trabajos relacionados' : 'Citing and related work'));
    if (shellTitle) shellTitle.textContent = title;
    if (shell) shell.classList.remove('hidden');

    var list = links.map(function (entry) {
      var href = String(entry && entry.url ? entry.url : '#');
      if (extractGitHubRepoSlug(href)) {
        return renderRepoRelatedItem(entry, lang);
      }

      var label = escapeHtml(entry && entry.label ? entry.label : 'Related link');
      var url = escapeHtml(href);
      var desc = pickLangText(entry && entry.description, lang, '');
      var descHtml = desc ? '<span class="related-work-link-desc"> — ' + escapeHtml(desc) + '</span>' : '';
      var key = entry && entry.key ? String(entry.key).trim() : '';
      var keyAttr = key ? (' data-pub-key="' + escapeHtml(key) + '"') : '';
      return '<li class="related-work-item related-work-item-link"' + keyAttr + '><a class="related-work-link" href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + '</a>' + descHtml + '</li>';
    }).join('');

    var supportDefaultIntro = lang === 'es'
      ? 'Si este trabajo te ha resultado útil, considera dar una estrella al {repo_link} o citar estos trabajos:'
      : 'If this work was useful to you, consider giving a star to the {repo_link} and citing these works:';
    var relatedTitle = lang === 'es' ? 'Trabajos relacionados' : 'Related work';

    var supportCitationItems = supportDoiItems;
    if (supportPublications.length) {
      supportCitationItems += supportPublications.map(function (pub) {
        return renderSupportPublicationItem(pub, lang);
      }).join('');
    }

    var introHtml = renderIntroWithRepoLink(supportIntroText || supportDefaultIntro, supportRepoUrl, supportRepoLabel);

    var supportBlock = (supportRepoUrl || supportIntroText || supportCitationItems)
      ?
        '<div class="related-work-support">' +
        '<p class="related-work-intro">' + introHtml + '</p>' +
        (supportCitationItems ? '<ul class="related-work-list">' + supportCitationItems + '</ul>' : '') +
        '</div>'
      : '';

    var relatedItemsHtml = '';
    if (publications.length) {
      relatedItemsHtml += publications.map(function (pub) {
        return renderPublicationItem(pub, lang);
      }).join('');
    }
    if (links.length) {
      relatedItemsHtml += list;
    }

    var relatedSection = relatedItemsHtml
      ? '<h4 class="related-work-subtitle">' + relatedTitle + '</h4><ul class="related-work-list related-work-list-pubs">' + relatedItemsHtml + '</ul>'
      : '';

    container.innerHTML = supportBlock + relatedSection;
    hydrateRepoRelatedItems(container, lang);
    var anchors = ensurePublicationEntryAnchors(container);
    applyInlineCitations(toolId, lang, anchors.keyToId, anchors.orderedKeys);
    if (window.SharedPublicationUI && typeof window.SharedPublicationUI.bind === 'function') {
      window.SharedPublicationUI.bind(container);
    }
  }

  function init(params) {
    var options = params || {};
    var container = options.container;
    var toolId = options.toolId;
    var fallbackData = normalizeDataset(options.fallbackData || EMPTY_DATASET);

    if (!container || !toolId) {
      throw new Error('SharedRelatedWork.init requires { container, toolId }');
    }

    return loadDataset(options.sourceUrl)
      .then(function (data) {
        var dataset = normalizeDataset(data);
        if (Array.isArray(dataset.publications) && dataset.publications.length) {
          return dataset;
        }
        return loadPublications(options.publicationsSourceUrl).then(function (publications) {
          dataset.publications = Array.isArray(publications) ? publications : [];
          return dataset;
        });
      })
      .then(function (data) {
        render(container, toolId, {
          data: data,
          lang: options.lang,
        });
        return data;
      })
      .catch(function () {
        render(container, toolId, {
          data: fallbackData,
          lang: options.lang,
        });
      });
  }

  window.SharedRelatedWork = {
    init: init,
    render: render,
    loadDataset: loadDataset,
  };
})();
