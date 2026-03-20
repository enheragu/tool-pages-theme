(function () {
  if (window.SharedRepoCards) return;

  window.__repoCardCache = window.__repoCardCache || {};
  window.__repoCardInflight = window.__repoCardInflight || {};

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

    var cache = window.__repoCardCache;
    var inflight = window.__repoCardInflight;

    if (cache[repo]) {
      fillCard(card, cache[repo]);
      return Promise.resolve(cache[repo]);
    }

    if (inflight[repo]) {
      return inflight[repo]
        .then(function (data) {
          document
            .querySelectorAll('.repo-card[data-repo="' + repo + '"]')
            .forEach(function (c) { fillCard(c, data); });
          return data;
        })
        .catch(function () {
          document
            .querySelectorAll('.repo-card[data-repo="' + repo + '"]')
            .forEach(fillCardError);
          throw new Error('repo fetch failed');
        });
    }

    inflight[repo] = fetch('https://api.github.com/repos/' + repo)
      .then(function (r) {
        return r.ok ? r.json() : Promise.reject(r.status);
      })
      .then(function (data) {
        cache[repo] = data;
        document
          .querySelectorAll('.repo-card[data-repo="' + repo + '"]')
          .forEach(function (c) { fillCard(c, data); });
        return data;
      })
      .catch(function () {
        document
          .querySelectorAll('.repo-card[data-repo="' + repo + '"]')
          .forEach(fillCardError);
        throw new Error('repo fetch failed');
      })
      .finally(function () {
        delete inflight[repo];
        triggerRelayout();
      });

    return inflight[repo];
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
    init: function (root) {
      processCards(root || document);
      ensureObserver();
    },
    refresh: function (root) {
      processCards(root || document);
    },
  };
})();
