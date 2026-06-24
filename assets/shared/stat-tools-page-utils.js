(function () {
  function resolveIssueRepo() {
    var cfg = window.StatToolsPageConfig || {};
    if (cfg.issueRepo) return cfg.issueRepo;
    // Fallback: derive "<org>/<repo>" from the first path segment.
    var seg = (window.location.pathname || '/').split('/').filter(Boolean)[0];
    return seg ? 'enheragu/' + seg : 'enheragu/tool-pages-theme';
  }

  function getIssueUrl(title) {
    var base = 'https://github.com/' + resolveIssueRepo() + '/issues/new?template=tool_bug_report.yml';
    if (!title) return base;
    return base + '&title=' + encodeURIComponent('[' + title + '] ');
  }

  function applyReportProblemLink() {
    var reportLink = document.getElementById('footer-report-problem');
    if (!reportLink) return;
    var toolTitle = reportLink.getAttribute('data-tool-title');
    reportLink.setAttribute('href', getIssueUrl(toolTitle));
  }

  function applyRelatedWorkVariant() {
    var relatedRoot = document.getElementById('related-work-root');
    if (!relatedRoot) return;

    relatedRoot.classList.add('related-work-root');
    var contextual = relatedRoot.getAttribute('data-related-contextual') === 'true';
    relatedRoot.classList.toggle('related-work-root-contextual', contextual);
  }

  function init() {
    applyReportProblemLink();
    applyRelatedWorkVariant();
  }

  window.StatToolsPageUtils = {
    init: init,
    applyReportProblemLink: applyReportProblemLink,
    applyRelatedWorkVariant: applyRelatedWorkVariant,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
