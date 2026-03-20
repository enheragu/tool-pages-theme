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

  function getDataPalette() {
    var colors = getDataColors();
    return [colors.blue, colors.green, colors.purple, colors.yellow, colors.red, colors.gray, colors.cyan];
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
    var lineHeight = Number(opts.lineHeight) || 1.2;

    return {
      color: function () { return getTokenColor('--clr-text', 'currentColor'); },
      usePointStyle: true,
      pointStyle: pointStyle,
      pointStyleWidth: pointStyleWidth,
      boxWidth: boxSize,
      boxHeight: boxSize,
      padding: padding,
      font: { size: 11, lineHeight: lineHeight },
    };
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
    return Object.assign({ top: 2, right: 8, left: 6, bottom: 12 }, overrides || {});
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
