(function () {
  if (window.SharedChartLegend) return;

  function getTokenColor(name, fallback) {
    var bodyValue = document.body ? getComputedStyle(document.body).getPropertyValue(name).trim() : '';
    if (bodyValue) return bodyValue;
    var rootValue = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return rootValue || fallback;
  }

  function getChartTheme() {
    return {
      text: getTokenColor('--clr-text', 'currentColor'),
      grid: getTokenColor('--clr-chart-grid', getTokenColor('--clr-border', 'currentColor')),
      area: getTokenColor('--clr-chart-bg', getTokenColor('--clr-surface', 'transparent')),
    };
  }

  function getSemanticColor(dataName, fallbacks) {
    var chain = Array.isArray(fallbacks) ? fallbacks : [];
    var value = getTokenColor('--clr-data-' + dataName, '');
    if (value) return value;
    for (var i = 0; i < chain.length; i++) {
      value = getTokenColor(chain[i], '');
      if (value) return value;
    }
    return getTokenColor('--clr-primary', 'currentColor');
  }

  function getDataColors() {
    return {
      gray: getSemanticColor('gray', ['--pal-gray', '--clr-muted']),
      blue: getSemanticColor('blue', ['--pal-blue', '--clr-primary']),
      green: getSemanticColor('green', ['--pal-green']),
      purple: getSemanticColor('purple', ['--pal-purple', '--clr-primary-h']),
      yellow: getSemanticColor('amber', ['--pal-amber']),
      red: getSemanticColor('red', ['--pal-red', '--clr-danger']),
      cyan: getSemanticColor('cyan', ['--pal-cyan', '--pal-blue', '--clr-primary']),
    };
  }

  function blendHex(color, mixColor, ratio) {
    var c = String(color || '').trim();
    var m = String(mixColor || '').trim();
    if (!/^#[0-9a-f]{6}$/i.test(c) || !/^#[0-9a-f]{6}$/i.test(m)) return c || color;
    var t = Math.max(0, Math.min(1, Number(ratio)));
    var cr = parseInt(c.slice(1, 3), 16);
    var cg = parseInt(c.slice(3, 5), 16);
    var cb = parseInt(c.slice(5, 7), 16);
    var mr = parseInt(m.slice(1, 3), 16);
    var mg = parseInt(m.slice(3, 5), 16);
    var mb = parseInt(m.slice(5, 7), 16);
    var rr = Math.round(cr * (1 - t) + mr * t);
    var rg = Math.round(cg * (1 - t) + mg * t);
    var rb = Math.round(cb * (1 - t) + mb * t);
    return '#' + rr.toString(16).padStart(2, '0') + rg.toString(16).padStart(2, '0') + rb.toString(16).padStart(2, '0');
  }

  function normalizeHex(color) {
    var c = String(color || '').trim();
    if (/^#[0-9a-f]{3}$/i.test(c)) {
      return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    }
    return c;
  }

  function getDataPalette() {
    var colors = getDataColors();
    var base = [colors.blue, colors.green, colors.purple, colors.yellow, colors.red, colors.gray, colors.cyan]
      .map(normalizeHex)
      .filter(Boolean);

    var extras = [
      '#f28e2b',
      '#59a14f',
      '#e15759',
      '#b07aa1',
      '#76b7b2',
      '#edc948',
      '#9c755f',
      '#ff9da7',
      '#1f77b4',
      '#ff7f0e',
      '#2ca02c',
      '#d62728',
      '#9467bd',
      '#8c564b',
      '#e377c2',
      '#17becf',
      '#bcbd22',
      '#006d77',
      '#ef476f',
      '#118ab2',
      '#06d6a0',
      '#ffd166'
    ];

    var unique = [];
    function pushUnique(color) {
      var c = normalizeHex(color);
      if (!c) return;
      if (unique.indexOf(c) !== -1) return;
      unique.push(c);
    }

    base.forEach(pushUnique);
    extras.forEach(pushUnique);

    var variants = unique.slice();
    var lightMix = '#ffffff';
    var darkMix = '#10141d';
    var distinctPoolSize = variants.length;
    for (var i = 0; i < unique.length; i++) {
      variants.push(blendHex(unique[i], lightMix, 0.22));
      variants.push(blendHex(unique[i], darkMix, 0.2));
    }

    var filtered = variants.map(normalizeHex).filter(Boolean);
    return filtered.slice(0, distinctPoolSize).concat(filtered.slice(distinctPoolSize));
  }

  function withAlpha(color, alpha) {
    if (typeof color !== 'string') return color;
    var a = Number(alpha);
    if (!Number.isFinite(a)) a = 1;
    if (a < 0) a = 0;
    if (a > 1) a = 1;

    var hex = color.trim();
    if (/^#[0-9a-f]{3}$/i.test(hex)) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    if (/^#[0-9a-f]{6}$/i.test(hex)) {
      var r = parseInt(hex.slice(1, 3), 16);
      var g = parseInt(hex.slice(3, 5), 16);
      var b = parseInt(hex.slice(5, 7), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }
    var rgb = hex.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+\s*)?\)$/i);
    if (rgb) {
      return 'rgba(' + rgb[1] + ',' + rgb[2] + ',' + rgb[3] + ',' + a + ')';
    }
    return color;
  }

  function buildLinearScale(title, min, max, overrides) {
    var theme = getChartTheme();
    var scale = {
      type: 'linear',
      title: {
        display: true,
        text: title,
        color: theme.text,
        padding: { top: 4, bottom: 8 }
      },
      ticks: { color: theme.text, padding: 6 },
      grid: { color: theme.grid },
      border: { color: theme.grid },
    };
    if (typeof min === 'number') scale.min = min;
    if (typeof max === 'number') scale.max = max;
    return Object.assign(scale, overrides || {});
  }

  function buildCategoryScale(title, overrides) {
    var theme = getChartTheme();
    return Object.assign(
      {
        title: {
          display: true,
          text: title,
          color: theme.text,
          padding: { top: 4, bottom: 8 }
        },
        ticks: { color: theme.text, padding: 6 },
        grid: { color: theme.grid },
        border: { color: theme.grid },
      },
      overrides || {}
    );
  }

  function buildLabels(options) {
    var opts = options || {};
    var pointStyle = opts.pointStyle || 'circle';
    var boxSize = Number(opts.boxSize) || 10;
    var pointStyleWidth = Number.isFinite(Number(opts.pointStyleWidth))
      ? Number(opts.pointStyleWidth)
      : boxSize;
    if (pointStyle === 'circle') pointStyleWidth = boxSize;
    var padding = Number(opts.padding) || 10;
    var lineHeight = Number(opts.lineHeight) || 1;

    var result = {
      color: function () { return getTokenColor('--clr-text', 'currentColor'); },
      usePointStyle: true,
      pointStyle: pointStyle,
      boxWidth: boxSize,
      boxHeight: boxSize,
      padding: padding,
      font: { size: 11, lineHeight: lineHeight },
    };
    if (pointStyle !== 'circle') result.pointStyleWidth = pointStyleWidth;
    return result;
  }

  function createLegendOptions(options) {
    var opts = options || {};
    var labels = Object.assign(
      {},
      buildLabels(opts),
      opts.labels || {}
    );

    var legend = {
      display: opts.display !== false,
      labels: labels,
    };

    if (opts.position) legend.position = opts.position;
    if (typeof opts.onClick === 'function') legend.onClick = opts.onClick;

    function applyLegendHover(chart, activeDatasetIndex) {
      if (!chart || !chart.data || !Array.isArray(chart.data.datasets)) return;
      var datasets = chart.data.datasets;
      var hasActive = Number.isFinite(activeDatasetIndex) && activeDatasetIndex >= 0;

      datasets.forEach(function (ds) {
        if (!ds) return;
        if (!ds._legendHoverOriginal) {
          ds._legendHoverOriginal = {
            borderColor: ds.borderColor,
            backgroundColor: ds.backgroundColor,
            pointBackgroundColor: ds.pointBackgroundColor,
          };
        }
      });

      datasets.forEach(function (ds, idx) {
        if (!ds || !ds._legendHoverOriginal) return;
        var active = !hasActive || idx === activeDatasetIndex;
        var alpha = active ? 1 : 0.22;
        var orig = ds._legendHoverOriginal;

        if (typeof orig.borderColor === 'string') ds.borderColor = withAlpha(orig.borderColor, alpha);
        if (typeof orig.backgroundColor === 'string') ds.backgroundColor = withAlpha(orig.backgroundColor, alpha);
        if (typeof orig.pointBackgroundColor === 'string') ds.pointBackgroundColor = withAlpha(orig.pointBackgroundColor, alpha);
      });

      chart.update('none');
    }

    legend.onHover = function (_event, item, legendInstance) {
      if (typeof opts.onHover === 'function') {
        opts.onHover(_event, item, legendInstance);
      }
      if (!legendInstance || !legendInstance.chart) return;
      var idx = item && Number.isFinite(item.datasetIndex) ? item.datasetIndex : -1;
      applyLegendHover(legendInstance.chart, idx);
    };

    legend.onLeave = function (_event, item, legendInstance) {
      if (typeof opts.onLeave === 'function') {
        opts.onLeave(_event, item, legendInstance);
      }
      if (!legendInstance || !legendInstance.chart) return;
      applyLegendHover(legendInstance.chart, -1);
    };

    return legend;
  }

  function createTooltipOptions(options) {
    var opts = options || {};
    var tooltip = {
      enabled: opts.enabled !== false,
    };

    if (typeof opts.filter === 'function') tooltip.filter = opts.filter;
    if (opts.callbacks) tooltip.callbacks = opts.callbacks;
    if (opts.mode) tooltip.mode = opts.mode;
    if (typeof opts.intersect === 'boolean') tooltip.intersect = opts.intersect;

    return tooltip;
  }

  function createTooltipCallbacks(options) {
    var opts = options || {};
    var callbacks = Object.assign({}, opts.callbacks || {});
    if (typeof opts.label === 'function') callbacks.label = opts.label;
    return callbacks;
  }

  function createTooltipLabelOptions(options) {
    var opts = options || {};
    var tooltipOpts = Object.assign({}, opts);
    delete tooltipOpts.label;
    delete tooltipOpts.callbacks;
    var callbacks = createTooltipCallbacks(opts);
    if (Object.keys(callbacks).length) tooltipOpts.callbacks = callbacks;
    return createTooltipOptions(tooltipOpts);
  }

  function getLayoutPadding(overrides) {
    return Object.assign({ top: 3, right: 8, left: 6, bottom: 3 }, overrides || {});
  }

  function buildChartOptions(config) {
    var opts = config || {};
    var theme = opts.theme || getChartTheme();
    var out = {
      responsive: opts.responsive !== false,
      maintainAspectRatio: opts.maintainAspectRatio === true,
      animation: typeof opts.animation === 'undefined' ? false : opts.animation,
      layout: { padding: getLayoutPadding(opts.layoutPadding) },
      color: theme.text,
      plugins: Object.assign({}, opts.plugins || {}),
      scales: Object.assign({}, opts.scales || {}),
    };
    if (opts.interaction) out.interaction = opts.interaction;
    if (typeof opts.parsing !== 'undefined') out.parsing = opts.parsing;
    return out;
  }

  window.SharedChartLegend = {
    getTokenColor: getTokenColor,
    getChartTheme: getChartTheme,
    getDataColors: getDataColors,
    getDataPalette: getDataPalette,
    withAlpha: withAlpha,
    buildLinearScale: buildLinearScale,
    buildCategoryScale: buildCategoryScale,
    buildLabels: buildLabels,
    createLegendOptions: createLegendOptions,
    createTooltipOptions: createTooltipOptions,
    createTooltipCallbacks: createTooltipCallbacks,
    createTooltipLabelOptions: createTooltipLabelOptions,
    getLayoutPadding: getLayoutPadding,
    buildChartOptions: buildChartOptions,
  };
})();
