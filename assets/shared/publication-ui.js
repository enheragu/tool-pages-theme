(function () {
  if (window.SharedPublicationUI) return;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeLang(lang) {
    if (lang === 'es' || lang === 'en') return lang;
    var htmlLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    return htmlLang.startsWith('es') ? 'es' : 'en';
  }

  function normalizeEntry(entry) {
    var safe = entry && typeof entry === 'object' ? entry : {};
    return {
      key: safe.key || '',
      title: safe.title || '',
      year: safe.year || '',
      authors: Array.isArray(safe.authors) ? safe.authors : [],
      venue: safe.venue || '',
      publisher: safe.publisher || '',
      version: safe.version || '',
      doi: safe.doi || '',
      url: safe.url || '',
    };
  }

  function buildBibtexCitation(entry) {
    var key = entry.key || 'citation';
    var bibFields = [
      ['author', Array.isArray(entry.authors) ? entry.authors.join(' and ') : ''],
      ['title', entry.title || ''],
      ['year', entry.year || ''],
      ['howpublished', entry.venue || ''],
      ['publisher', entry.publisher || ''],
      ['version', entry.version || ''],
      ['doi', entry.doi || ''],
      ['url', entry.url || ''],
    ].filter(function (pair) {
      return String(pair[1] || '').trim().length > 0;
    });

    var lines = ['@misc{' + key + ','];
    bibFields.forEach(function (pair, index) {
      var suffix = index === bibFields.length - 1 ? '' : ',';
      lines.push('  ' + pair[0] + ' = {' + pair[1] + '}' + suffix);
    });
    lines.push('}');
    return lines.join('\n');
  }

  function buildPlainCitation(entry) {
    var parts = [];
    if (Array.isArray(entry.authors) && entry.authors.length) parts.push(entry.authors.join(', '));
    if (entry.year) parts.push('(' + entry.year + ')');
    if (entry.title) parts.push(entry.title + '.');
    if (entry.venue) parts.push(entry.venue + '.');
    if (entry.publisher) parts.push(entry.publisher + '.');
    if (entry.version) parts.push('Version ' + entry.version + '.');
    if (entry.doi) parts.push('DOI: ' + entry.doi + '.');
    if (entry.url) parts.push(entry.url);
    return parts.join(' ');
  }

  function buildApaCitation(entry) {
    var parts = [];
    if (Array.isArray(entry.authors) && entry.authors.length) parts.push(entry.authors.join(', ') + '.');
    if (entry.year) parts.push('(' + entry.year + ').');
    if (entry.title) parts.push(entry.title + '.');
    if (entry.venue) parts.push(entry.venue + '.');
    if (entry.publisher) parts.push(entry.publisher + '.');
    if (entry.version) parts.push('(Version ' + entry.version + ').');
    if (entry.doi) {
      var doiHref = /^https?:\/\//i.test(String(entry.doi)) ? String(entry.doi) : ('https://doi.org/' + String(entry.doi));
      parts.push(doiHref);
    } else if (entry.url) {
      parts.push(entry.url);
    }
    return parts.join(' ');
  }

  function classMap(variant) {
    if (variant === 'related') {
      return {
        link: 'related-work-inline-link link-badge',
        cite: 'related-work-cite',
        summary: 'related-work-cite-summary related-work-inline-link link-badge',
        backdrop: 'related-work-cite-backdrop shared-modal-backdrop',
        popover: 'related-work-cite-popover',
        header: 'related-work-cite-header',
        title: 'related-work-cite-title related-work-subtitle',
        close: 'related-work-cite-close related-work-inline-link link-badge shared-icon-btn',
        section: 'related-work-cite-format',
        sectionTitle: 'related-work-cite-format-title',
        contentWrap: 'related-work-cite-content-wrap',
        copy: 'related-work-cite-copy related-work-inline-link link-badge shared-icon-btn',
        content: 'related-work-cite-pre',
      };
    }

    return {
      link: 'pub-cite-badge pub-action-link',
      cite: 'pub-cite',
      summary: 'pub-cite-summary pub-cite-badge',
      backdrop: 'pub-cite-backdrop shared-modal-backdrop',
      popover: 'pub-cite-popover',
      header: 'pub-cite-header',
      title: 'pub-cite-title',
      close: 'pub-cite-close pub-cite-badge shared-icon-btn',
      section: 'pub-cite-format',
      sectionTitle: 'pub-cite-format-title',
      contentWrap: 'pub-cite-content-wrap',
      copy: 'pub-cite-copy pub-cite-badge shared-icon-btn',
      content: 'pub-cite-content',
    };
  }

  function renderActions(rawEntry, options) {
    var opts = options || {};
    var entry = normalizeEntry(rawEntry);
    var lang = normalizeLang(opts.lang);
    var variant = opts.variant === 'related' ? 'related' : 'cv';
    var classes = classMap(variant);

    var links = [];
    if (entry.doi) {
      var doiHref = /^https?:\/\//i.test(String(entry.doi)) ? String(entry.doi) : ('https://doi.org/' + String(entry.doi));
      links.push('<a class="' + classes.link + '" href="' + escapeHtml(doiHref) + '" target="_blank" rel="noopener noreferrer">[doi]</a>');
    }
    if (entry.url) {
      links.push('<a class="' + classes.link + '" href="' + escapeHtml(entry.url) + '" target="_blank" rel="noopener noreferrer">[link]</a>');
    }

    var bib = escapeHtml(buildBibtexCitation(entry));
    var plain = escapeHtml(buildPlainCitation(entry));
    var apa = escapeHtml(buildApaCitation(entry));
    var citeLabel = lang === 'es' ? '[citar]' : '[cite]';
    var titleLabel = lang === 'es' ? 'Formatos de cita' : 'Citation formats';
    var closeLabel = lang === 'es' ? 'Cerrar' : 'Close';
    var copyLabel = '⧉';
    var plainLabel = lang === 'es' ? 'Texto plano' : 'Plain text';
    var apaLabel = lang === 'es' ? 'Estilo APA' : 'APA-like';

    var citeWidget = '' +
      '<details class="' + classes.cite + '" data-pubui-cite-widget data-pubui-variant="' + variant + '">' +
      '<summary class="' + classes.summary + '" data-label-en="[cite]" data-label-es="[citar]">' + citeLabel + '</summary>' +
      '<button type="button" class="' + classes.backdrop + '" data-pubui-cite-backdrop tabindex="-1" aria-hidden="true"></button>' +
      '<div class="' + classes.popover + '">' +
      '<div class="' + classes.header + '">' +
      '<h5 class="' + classes.title + '" data-label-en="Citation formats" data-label-es="Formatos de cita">' + titleLabel + '</h5>' +
      '<button type="button" class="' + classes.close + '" data-pubui-cite-close data-label-en="Close" data-label-es="Cerrar" data-label-mode="aria" aria-label="' + closeLabel + '" title="' + closeLabel + '">×</button>' +
      '</div>' +
      '<section class="' + classes.section + '">' +
      '<h6 class="' + classes.sectionTitle + '">BibTeX</h6>' +
      '<div class="' + classes.contentWrap + '">' +
      '<button type="button" class="' + classes.copy + '" data-pubui-cite-copy data-pubui-copy-target="bibtex" data-label-en="Copy" data-label-es="Copiar" aria-label="' + (lang === 'es' ? 'Copiar' : 'Copy') + '" title="' + (lang === 'es' ? 'Copiar' : 'Copy') + '">' + copyLabel + '</button>' +
      '<pre class="' + classes.content + '" data-pubui-cite-content="bibtex">' + bib + '</pre>' +
      '</div>' +
      '</section>' +
      '<section class="' + classes.section + '">' +
      '<h6 class="' + classes.sectionTitle + '" data-label-en="Plain text" data-label-es="Texto plano">' + plainLabel + '</h6>' +
      '<div class="' + classes.contentWrap + '">' +
      '<button type="button" class="' + classes.copy + '" data-pubui-cite-copy data-pubui-copy-target="plain" data-label-en="Copy" data-label-es="Copiar" aria-label="' + (lang === 'es' ? 'Copiar' : 'Copy') + '" title="' + (lang === 'es' ? 'Copiar' : 'Copy') + '">' + copyLabel + '</button>' +
      '<pre class="' + classes.content + '" data-pubui-cite-content="plain">' + plain + '</pre>' +
      '</div>' +
      '</section>' +
      '<section class="' + classes.section + '">' +
      '<h6 class="' + classes.sectionTitle + '" data-label-en="APA-like" data-label-es="Estilo APA">' + apaLabel + '</h6>' +
      '<div class="' + classes.contentWrap + '">' +
      '<button type="button" class="' + classes.copy + '" data-pubui-cite-copy data-pubui-copy-target="apa" data-label-en="Copy" data-label-es="Copiar" aria-label="' + (lang === 'es' ? 'Copiar' : 'Copy') + '" title="' + (lang === 'es' ? 'Copiar' : 'Copy') + '">' + copyLabel + '</button>' +
      '<pre class="' + classes.content + '" data-pubui-cite-content="apa">' + apa + '</pre>' +
      '</div>' +
      '</section>' +
      '</div>' +
      '</details>';

    return (links.length ? (' ' + links.join(' ')) : '') + ' ' + citeWidget;
  }

  function setLocalizedLabels(widget, lang) {
    widget.querySelectorAll('[data-label-en]').forEach(function (node) {
      var nextText = node.getAttribute(lang === 'es' ? 'data-label-es' : 'data-label-en') || node.textContent;
      var mode = node.getAttribute('data-label-mode') || 'text';
      if (mode === 'aria') {
        node.setAttribute('aria-label', nextText);
        node.setAttribute('title', nextText);
      } else {
        node.textContent = nextText;
      }
    });
  }

  function bind(root) {
    var host = root || document;

    function clearSelectionLock() {
      document.body.classList.remove('pubui-selection-lock');
    }

    if (!document.__pubuiGlobalBound) {
      document.__pubuiGlobalBound = true;

      document.addEventListener('toggle', function (event) {
        var widget = event.target;
        if (!widget || !widget.matches || !widget.matches('[data-pubui-cite-widget]')) return;

        if (!widget.open) {
          clearSelectionLock();
          var panel = widget.closest('.gitgraph-detail');
          if (panel && !panel.querySelector('[data-pubui-cite-widget][open]')) {
            panel.classList.remove('cite-widget-host-active');
          }
          return;
        }

        document.querySelectorAll('[data-pubui-cite-widget]').forEach(function (other) {
          if (other !== widget) other.open = false;
        });

        var hostPanel = widget.closest('.gitgraph-detail');
        if (hostPanel) {
          document.querySelectorAll('.gitgraph-detail.cite-widget-host-active').forEach(function (panel) {
            panel.classList.remove('cite-widget-host-active');
          });
          hostPanel.classList.add('cite-widget-host-active');
        }
      }, true);

      document.addEventListener('click', function (event) {
        var closeButton = event.target.closest('[data-pubui-cite-close]');
        if (closeButton) {
          var closeWidget = closeButton.closest('[data-pubui-cite-widget]');
          if (closeWidget) closeWidget.open = false;
          clearSelectionLock();
          return;
        }

        var copyButton = event.target.closest('[data-pubui-cite-copy]');
        if (copyButton) {
          var widget = copyButton.closest('[data-pubui-cite-widget]');
          if (!widget) return;
          var target = copyButton.getAttribute('data-pubui-copy-target');
          var block = target ? widget.querySelector('[data-pubui-cite-content="' + target + '"]') : null;
          if (!block) return;

          var doneLabel = copyButton.getAttribute('data-done-label') || '✓';
          var originalLabel = copyButton.getAttribute('data-original-label') || copyButton.textContent;

          navigator.clipboard.writeText(block.textContent || '').then(function () {
            copyButton.classList.add('copied');
            copyButton.textContent = doneLabel;
            window.setTimeout(function () {
              copyButton.classList.remove('copied');
              copyButton.textContent = originalLabel;
            }, 900);
          }).catch(function () {
            copyButton.classList.remove('copied');
            copyButton.textContent = originalLabel;
          });
          return;
        }

        if (event.target.closest('[data-pubui-cite-backdrop]')) {
          var backdropWidget = event.target.closest('[data-pubui-cite-widget]');
          if (backdropWidget) backdropWidget.open = false;
          clearSelectionLock();
          document.querySelectorAll('.gitgraph-detail.cite-widget-host-active').forEach(function (panel) {
            panel.classList.remove('cite-widget-host-active');
          });
          return;
        }

        if (event.target.closest('[data-pubui-cite-widget]')) return;
        document.querySelectorAll('[data-pubui-cite-widget][open]').forEach(function (widget) {
          widget.open = false;
        });
        clearSelectionLock();
        document.querySelectorAll('.gitgraph-detail.cite-widget-host-active').forEach(function (panel) {
          panel.classList.remove('cite-widget-host-active');
        });
      });

      document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        document.querySelectorAll('[data-pubui-cite-widget][open]').forEach(function (widget) {
          widget.open = false;
        });
        clearSelectionLock();
        document.querySelectorAll('.gitgraph-detail.cite-widget-host-active').forEach(function (panel) {
          panel.classList.remove('cite-widget-host-active');
        });
      });

      document.addEventListener('pointerdown', function (event) {
        if (!event.target.closest('[data-pubui-cite-content]')) {
          clearSelectionLock();
          return;
        }
        document.body.classList.add('pubui-selection-lock');
      }, true);

      document.addEventListener('pointerup', clearSelectionLock, true);
      document.addEventListener('pointercancel', clearSelectionLock, true);
    }

    host.querySelectorAll('[data-pubui-cite-widget]').forEach(function (widget) {
      var lang = normalizeLang(widget.getAttribute('data-pubui-lang'));
      setLocalizedLabels(widget, lang);
      widget.querySelectorAll('[data-pubui-cite-copy]').forEach(function (button) {
        var ariaLabel = button.getAttribute(lang === 'es' ? 'data-label-es' : 'data-label-en') || (lang === 'es' ? 'Copiar' : 'Copy');
        button.setAttribute('aria-label', ariaLabel);
        button.setAttribute('title', ariaLabel);
        button.textContent = '⧉';
        button.setAttribute('data-original-label', '⧉');
        button.setAttribute('data-done-label', '✓');
      });
    });
  }

  function hydratePlaceholders(root, options) {
    var host = root || document;
    var opts = options || {};
    var lang = normalizeLang(opts.lang);

    host.querySelectorAll('[data-pub-actions]').forEach(function (placeholder) {
      var authorsRaw = placeholder.getAttribute('data-pub-authors') || '';
      var authors = authorsRaw ? authorsRaw.split('||').map(function (a) { return a.trim(); }).filter(Boolean) : [];
      var entry = {
        key: placeholder.getAttribute('data-pub-key') || '',
        title: placeholder.getAttribute('data-pub-title') || '',
        year: placeholder.getAttribute('data-pub-year') || '',
        authors: authors,
        venue: placeholder.getAttribute('data-pub-venue') || '',
        publisher: placeholder.getAttribute('data-pub-publisher') || '',
        version: placeholder.getAttribute('data-pub-version') || '',
        doi: placeholder.getAttribute('data-pub-doi') || '',
        url: placeholder.getAttribute('data-pub-url') || '',
      };

      placeholder.innerHTML = renderActions(entry, {
        lang: lang,
        variant: 'cv',
      });
    });

    bind(host);
  }

  window.SharedPublicationUI = {
    renderActions: renderActions,
    bind: bind,
    hydratePlaceholders: hydratePlaceholders,
  };
})();
