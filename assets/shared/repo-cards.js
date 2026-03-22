(function () {
  if (window.SharedRepoCards) return;

  window.__repoCardCache = window.__repoCardCache || {};
  window.__repoCardInflight = window.__repoCardInflight || {};
  var REPO_META_CACHE_KEY = 'shared-repo-meta-cache-v1';
  var REPO_META_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  function readMetaStore() {
    try {
      var raw = window.localStorage ? window.localStorage.getItem(REPO_META_CACHE_KEY) : '';
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_e) {
      return {};
    }
  }

  function writeMetaStore(store) {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(REPO_META_CACHE_KEY, JSON.stringify(store || {}));
    } catch (_e) {
      // Ignore localStorage failures.
    }
  }

  function toRepoInfo(repo, data) {
    if (!data || typeof data !== 'object') return null;
    return {
      slug: repo,
      name: String(data.name || (String(repo).split('/')[1] || repo)),
      description: String(data.description || '').trim(),
      language: data.language ? String(data.language) : '',
      stargazers_count: Number.isFinite(Number(data.stargazers_count)) ? Number(data.stargazers_count) : 0,
      url: String(data.html_url || ('https://github.com/' + repo)),
      raw: data,
    };
  }

  function getCachedRepoInfo(repo) {
    var cache = window.__repoCardCache;
    var mem = cache[repo];
    if (mem && Number.isFinite(mem.ts) && (Date.now() - mem.ts) < REPO_META_CACHE_TTL_MS) {
      return mem.data;
    }

    var store = readMetaStore();
    var persisted = store[repo];
    if (persisted && Number.isFinite(persisted.ts) && (Date.now() - persisted.ts) < REPO_META_CACHE_TTL_MS) {
      cache[repo] = persisted;
      return persisted.data;
    }

    return null;
  }

  function setCachedRepoInfo(repo, info) {
    if (!repo || !info) return;
    var cacheItem = { ts: Date.now(), data: info };
    window.__repoCardCache[repo] = cacheItem;
    var store = readMetaStore();
    store[repo] = cacheItem;
    writeMetaStore(store);
  }

  function getRepoInfo(repo) {
    if (!repo) return Promise.resolve(null);

    var cached = getCachedRepoInfo(repo);
    if (cached) return Promise.resolve(cached);

    var inflight = window.__repoCardInflight;
    if (inflight[repo]) return inflight[repo];

    inflight[repo] = fetch('https://api.github.com/repos/' + repo)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var info = toRepoInfo(repo, data);
        if (info) setCachedRepoInfo(repo, info);
        return info;
      })
      .catch(function () {
        return null;
      })
      .finally(function () {
        delete inflight[repo];
      });

    return inflight[repo];
  }

  function triggerRelayout() {
    if (!(window._gitgraphInstance && window.GitGraphCommon)) return;
    requestAnimationFrame(function () {
      GitGraphCommon.recalculateYPositions(window._gitgraphInstance);
      GitGraphCommon.relayoutPanels(window._gitgraphInstance);
      setTimeout(function () {
        GitGraphCommon.recalculateYPositions(window._gitgraphInstance);
        GitGraphCommon.relayoutPanels(window._gitgraphInstance);
      }, 120);
    });
  }

  function fillCard(card, data) {
    var desc = card.querySelector('.repo-desc');
    if (desc) {
      desc.textContent = data.description || 'No description';
      desc.removeAttribute('data-loading');
    }

    var lang = card.querySelector('.repo-lang');
    if (lang) {
      if (data.language) {
        lang.innerHTML = '<span class="lang-dot"></span> ' + data.language;
      }
      lang.removeAttribute('data-loading');
    }

    var stars = card.querySelector('.repo-stars');
    if (stars) {
      if (data.stargazers_count > 0) {
        stars.innerHTML = '&#9733; ' + data.stargazers_count;
      }
      stars.removeAttribute('data-loading');
    }
  }

  function fillCardError(card) {
    var desc = card.querySelector('.repo-desc');
    if (desc) {
      desc.textContent = 'Could not load repo info';
      desc.removeAttribute('data-loading');
    }
    var lang = card.querySelector('.repo-lang');
    if (lang) lang.removeAttribute('data-loading');
    var stars = card.querySelector('.repo-stars');
    if (stars) stars.removeAttribute('data-loading');
  }

  function loadCard(card) {
    var repo = card.getAttribute('data-repo');
    if (!repo) return Promise.resolve();
    return getRepoInfo(repo)
      .then(function (info) {
        if (!info) {
          document
            .querySelectorAll('.repo-card[data-repo="' + repo + '"]')
            .forEach(fillCardError);
          return null;
        }
        document
          .querySelectorAll('.repo-card[data-repo="' + repo + '"]')
          .forEach(function (c) { fillCard(c, info); });
        return info;
      })
      .finally(function () {
        triggerRelayout();
      });
  }

  function processCards(root) {
    var scope = root || document;
    var cards = scope.querySelectorAll('.repo-card[data-repo]:not([data-repo-init])');
    cards.forEach(function (card) {
      card.setAttribute('data-repo-init', '1');
      loadCard(card).finally(triggerRelayout);
    });
  }

  function ensureObserver() {
    if (window.__repoCardObserver) return;
    window.__repoCardObserver = new MutationObserver(function () {
      processCards(document);
    });
    window.__repoCardObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  window.SharedRepoCards = {
    getRepoInfo: getRepoInfo,
    init: function (root) {
      processCards(root || document);
      ensureObserver();
    },
    refresh: function (root) {
      processCards(root || document);
    },
  };
})();
