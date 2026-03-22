(function () {
  if (window.SharedHistogramNormalChart) return;

  function withAlpha(color, alpha) {
    if (!color) return 'rgba(88,166,255,' + alpha + ')';
    var c = String(color).trim();
    if (c.charAt(0) === '#') {
      var hex = c.slice(1);
      if (hex.length === 3) {
        hex = hex.split('').map(function (ch) { return ch + ch; }).join('');
      }
      if (hex.length === 6) {
        var n = parseInt(hex, 16);
        if (!Number.isNaN(n)) {
          var r = (n >> 16) & 255;
          var g = (n >> 8) & 255;
          var b = n & 255;
          return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
        }
      }
    }
    if (c.indexOf('rgb(') === 0) {
      var rgbMatch = c.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
      if (rgbMatch) return 'rgba(' + rgbMatch[1] + ',' + rgbMatch[2] + ',' + rgbMatch[3] + ',' + alpha + ')';
    }
    if (c.indexOf('rgba(') === 0) {
      var rgbaMatch = c.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i);
      if (rgbaMatch) return 'rgba(' + rgbaMatch[1] + ',' + rgbaMatch[2] + ',' + rgbaMatch[3] + ',' + alpha + ')';
    }
    return c;
  }

  function withAlphaAny(color, alpha) {
    if (Array.isArray(color)) {
      return color.map(function (item) { return withAlphaAny(item, alpha); });
    }
    if (typeof color === 'string') return withAlpha(color, alpha);
    return color;
  }

  function getTokenPalette() {
    var sharedLegend = window.SharedChartLegend;
    if (sharedLegend && typeof sharedLegend.getDataPalette === 'function') {
      var fromLegend = sharedLegend.getDataPalette();
      if (Array.isArray(fromLegend) && fromLegend.length) return fromLegend;
    }
    var style = getComputedStyle(document.documentElement);
    var tokenColors = [
      style.getPropertyValue('--clr-data-blue').trim(),
      style.getPropertyValue('--clr-data-amber').trim(),
      style.getPropertyValue('--clr-data-green').trim(),
      style.getPropertyValue('--clr-data-purple').trim(),
      style.getPropertyValue('--clr-data-red').trim(),
      style.getPropertyValue('--pal-gray').trim(),
    ].filter(Boolean);
    if (tokenColors.length) return tokenColors;
    return ['#58a6ff', '#d29922', '#3fb950', '#bc8cff', '#f85149', '#6e7681'];
  }

  function normalPdf(x, mu, sigma) {
    if (!Number.isFinite(sigma) || sigma <= 0) return 0;
    var z = (x - mu) / sigma;
    return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
  }

  function erf(x) {
    var sign = x < 0 ? -1 : 1;
    var ax = Math.abs(x);
    var a1 = 0.254829592;
    var a2 = -0.284496736;
    var a3 = 1.421413741;
    var a4 = -1.453152027;
    var a5 = 1.061405429;
    var p = 0.3275911;
    var t = 1 / (1 + p * ax);
    var y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax));
    return sign * y;
  }

  function normalCdf(x, mu, sigma) {
    if (!Number.isFinite(sigma) || sigma <= 0) return x >= mu ? 1 : 0;
    return 0.5 * (1 + erf((x - mu) / (sigma * Math.sqrt(2))));
  }

  function mean(values) {
    if (!values.length) return 0;
    var total = 0;
    values.forEach(function (v) { total += v; });
    return total / values.length;
  }

  function stdDev(values, meanValue) {
    if (values.length < 2) return 0;
    var m = Number.isFinite(meanValue) ? meanValue : mean(values);
    var acc = 0;
    values.forEach(function (v) {
      var d = v - m;
      acc += d * d;
    });
    return Math.sqrt(acc / values.length);
  }

  function normalCdfBinMass(x, mu, sigma) {
    if (!(sigma > 0)) return 0;
    var upper = normalCdf(x + 0.5, mu, sigma);
    var lower = normalCdf(x - 0.5, mu, sigma);
    return Math.max(0, upper - lower);
  }

  function buildDiscreteHistogramDatasets(config) {
    var groups = Array.isArray(config.groups) ? config.groups : [];
    if (!groups.length) return null;

    var maxScore = Number.isFinite(Number(config.maxScore))
      ? Math.max(0, Math.round(Number(config.maxScore)))
      : 0;

    if (!maxScore) {
      groups.forEach(function (g) {
        var scores = Array.isArray(g.scores) ? g.scores : [];
        scores.forEach(function (s) {
          if (Number.isFinite(s)) maxScore = Math.max(maxScore, Math.round(s));
        });
      });
    }

    var labels = Array.from({ length: maxScore + 1 }, function (_, i) { return i; });
    var datasets = [];

    groups.forEach(function (g) {
      var scores = (Array.isArray(g.scores) ? g.scores : []).filter(Number.isFinite);
      var color = g.color || '#58a6ff';
      var label = g.label || 'Group';
      var freq = new Array(maxScore + 1).fill(0);
      scores.forEach(function (s) {
        var idx = Math.round(s);
        if (idx >= 0 && idx <= maxScore) freq[idx] += 1;
      });
      var denom = Math.max(1, scores.length);
      var prop = freq.map(function (f) { return f / denom; });

      datasets.push({
        type: 'bar',
        label: label,
        _hnsRole: 'histogram',
        _hnsGroup: label,
        _hnsBaseLabel: label,
        data: prop,
        grouped: false,
        backgroundColor: withAlpha(color, 0.42),
        borderColor: withAlpha(color, 0.95),
        borderWidth: 1,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
        order: 1,
      });

      var fit = config.fit || null;
      if (fit && fit.type === 'normal-binmass') {
        var m = mean(scores);
        var sd = stdDev(scores, m);
        var fitData = labels.map(function (x) {
          return normalCdfBinMass(x, m, sd);
        });
        var fitLabelPrefix = fit.labelPrefix || 'Fit';
        datasets.push({
          type: 'line',
          label: fitLabelPrefix + ' · ' + label,
          _hnsRole: 'normal-fit',
          _hnsGroup: label,
          data: fitData,
          borderColor: withAlpha(color, 0.98),
          borderWidth: 2,
          borderDash: [7, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0.22,
          order: 2,
        });
      }
    });

    return { labels: labels, datasets: datasets };
  }

  function getTokenColor(name, fallback) {
    var bodyValue = document.body ? getComputedStyle(document.body).getPropertyValue(name).trim() : '';
    if (bodyValue) return bodyValue;
    var rootValue = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return rootValue || fallback;
  }

  function quantile(sorted, q) {
    if (!sorted.length) return NaN;
    var pos = (sorted.length - 1) * q;
    var base = Math.floor(pos);
    var rest = pos - base;
    var a = sorted[base];
    var b = sorted[Math.min(base + 1, sorted.length - 1)];
    return a + (b - a) * rest;
  }

  function suggestRange(series, sigmaExtent, paddingFraction) {
    var valuesMin = Infinity;
    var valuesMax = -Infinity;
    var fitMin = Infinity;
    var fitMax = -Infinity;

    series.forEach(function (s) {
      var values = Array.isArray(s.values) ? s.values : [];
      values.forEach(function (v) {
        if (!Number.isFinite(v)) return;
        if (v < valuesMin) valuesMin = v;
        if (v > valuesMax) valuesMax = v;
      });

      var mean = Number(s.mean);
      var std = Number(s.std);
      if (Number.isFinite(mean) && Number.isFinite(std) && std > 0) {
        var lo = mean - sigmaExtent * std;
        var hi = mean + sigmaExtent * std;
        if (lo < fitMin) fitMin = lo;
        if (hi > fitMax) fitMax = hi;
      }
    });

    var min = Math.min(valuesMin, fitMin);
    var max = Math.max(valuesMax, fitMax);

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = valuesMin;
      max = valuesMax;
    }

    if (min === max) {
      min -= 0.5;
      max += 0.5;
    }

    var span = Math.max(1e-9, max - min);
    var pad = span * Math.max(0, paddingFraction);
    return { min: min - pad, max: max + pad };
  }

  function suggestBinCount(series, rangeMin, rangeMax) {
    var widths = [];

    series.forEach(function (s) {
      var values = (Array.isArray(s.values) ? s.values : []).filter(Number.isFinite);
      if (values.length < 4) return;
      var sorted = values.slice().sort(function (a, b) { return a - b; });
      var q1 = quantile(sorted, 0.25);
      var q3 = quantile(sorted, 0.75);
      var iqr = q3 - q1;
      var n = sorted.length;

      var fd = (iqr > 0) ? (2 * iqr / Math.cbrt(n)) : NaN;
      var std = Number(s.std);
      var scott = (Number.isFinite(std) && std > 0) ? (3.49 * std / Math.cbrt(n)) : NaN;
      var width = Number.isFinite(fd) && fd > 0 ? fd : scott;
      if (Number.isFinite(width) && width > 0) widths.push(width);
    });

    var span = Math.max(1e-9, rangeMax - rangeMin);
    if (!widths.length) {
      var approx = Math.round(Math.sqrt(span * 24));
      return Math.max(14, Math.min(120, approx));
    }

    widths.sort(function (a, b) { return a - b; });
    var medianWidth = widths[Math.floor(widths.length / 2)];
    var bins = Math.ceil(span / Math.max(1e-9, medianWidth));
    return Math.max(14, Math.min(120, bins));
  }

  function resolveFittedStd(values, empiricalStd, width, minStdBinWidthFactor) {
    var fallbackStd = Math.max(width * Math.max(0, minStdBinWidthFactor), 1e-9);
    if (Number.isFinite(empiricalStd) && empiricalStd > 0) return empiricalStd;
    return fallbackStd;
  }

  function createLegendOptions(config) {
    var opts = config || {};
    var normalLabel = opts.normalLabel || 'Fitted normal (dotted line)';
    var sharedLegend = window.SharedChartLegend;
    var baseLabels = sharedLegend && sharedLegend.buildLabels
      ? sharedLegend.buildLabels({ pointStyle: 'circle', pointStyleWidth: 12, boxSize: 10, padding: 10 })
      : {
          color: function () { return getTokenColor('--clr-text', '#3a4658'); },
          boxWidth: 10,
          boxHeight: 10,
          padding: 10,
          pointStyleWidth: 12,
          usePointStyle: true,
          pointStyle: 'circle',
          font: { lineHeight: 1 },
        };

    return {
      display: true,
      labels: {
        color: baseLabels.color,
        boxWidth: baseLabels.boxWidth,
        boxHeight: baseLabels.boxHeight,
        padding: baseLabels.padding,
        pointStyleWidth: baseLabels.pointStyleWidth,
        usePointStyle: baseLabels.usePointStyle,
        pointStyle: baseLabels.pointStyle,
        font: baseLabels.font,
        generateLabels: function (chart) {
          var datasets = (chart && chart.data && chart.data.datasets) || [];
          var legendTextColor = getTokenColor('--clr-text', '#3a4658');
          var labels = [];

          datasets.forEach(function (ds, idx) {
            if (ds && ds._hnsRole === 'histogram') {
              labels.push({
                text: ds._hnsBaseLabel || ds.label || ('Series ' + (idx + 1)),
                fillStyle: ds.backgroundColor,
                strokeStyle: ds.borderColor,
                lineWidth: ds.borderWidth || 1,
                hidden: !chart.isDatasetVisible(idx),
                datasetIndex: idx,
                pointStyle: 'circle',
                usePointStyle: true,
                fontColor: legendTextColor,
              });
            }
          });

          var firstNormal = datasets.find(function (ds) {
            return ds && ds._hnsRole === 'normal-fit';
          });

          if (firstNormal) {
            labels.push({
              text: normalLabel,
              fillStyle: 'rgba(0,0,0,0)',
              strokeStyle: firstNormal.borderColor,
              lineWidth: firstNormal.borderWidth || 2,
              lineDash: firstNormal.borderDash || [7, 4],
              hidden: false,
              datasetIndex: -1,
              pointStyle: 'line',
              pointStyleWidth: 22,
              usePointStyle: true,
              fontColor: legendTextColor,
            });
          }

          return labels;
        },
      },
      onClick: function (_evt, item, legend) {
        if (!item || typeof item.datasetIndex !== 'number' || item.datasetIndex < 0) return;
        var chart = legend.chart;
        var datasets = chart.data.datasets || [];
        var base = datasets[item.datasetIndex];
        if (!base || !base._hnsGroup) {
          var visible = chart.isDatasetVisible(item.datasetIndex);
          chart.setDatasetVisibility(item.datasetIndex, !visible);
          chart.update();
          return;
        }

        var groupId = base._hnsGroup;
        var indices = [];
        datasets.forEach(function (ds, idx) {
          if (ds && ds._hnsGroup === groupId) indices.push(idx);
        });
        if (!indices.length) return;

        var anyVisible = indices.some(function (idx) {
          return chart.isDatasetVisible(idx);
        });

        indices.forEach(function (idx) {
          chart.setDatasetVisibility(idx, !anyVisible);
        });
        chart.update();
      },
      onHover: function (_evt, item, legend) {
        var chart = legend && legend.chart;
        if (!chart || !chart.data || !Array.isArray(chart.data.datasets)) return;
        var datasets = chart.data.datasets;
        var targetGroup = null;

        if (item && Number.isFinite(item.datasetIndex) && item.datasetIndex >= 0) {
          var base = datasets[item.datasetIndex];
          if (base && base._hnsGroup) targetGroup = base._hnsGroup;
        } else if (item && item.datasetIndex === -1) {
          targetGroup = '__all_normals__';
        }
        chart._hnsLegendHoverGroup = targetGroup;

        datasets.forEach(function (ds) {
          if (!ds) return;
          if (!ds._hnsLegendHoverOriginal) {
            ds._hnsLegendHoverOriginal = {
              borderColor: ds.borderColor,
              backgroundColor: ds.backgroundColor,
              borderWidth: ds.borderWidth,
              order: ds.order,
            };
          }
        });

        datasets.forEach(function (ds, datasetIndex) {
          if (!ds || !ds._hnsLegendHoverOriginal) return;
          var active = true;
          if (targetGroup) {
            if (targetGroup === '__all_normals__') {
              active = ds._hnsRole === 'normal-fit';
            } else {
              active = ds._hnsGroup === targetGroup;
            }
          }
          var orig = ds._hnsLegendHoverOriginal;
          var inactiveAlpha = 0.08;
          var activeBarBgAlpha = 0.30;
          var activeBarBorderAlpha = 0.98;

          if (targetGroup) {
            if (active) {
              ds.order = ds._hnsRole === 'normal-fit' ? 40 : 30;
            } else {
              ds.order = ds._hnsRole === 'normal-fit' ? 20 : 10;
            }
          } else if (typeof orig.order === 'number') {
            ds.order = orig.order;
          }

          if (ds._hnsRole === 'histogram') {
            var nextBorder = active
              ? withAlphaAny(orig.borderColor, activeBarBorderAlpha)
              : withAlphaAny(orig.borderColor, inactiveAlpha);
            var nextBackground = active
              ? withAlphaAny(orig.backgroundColor, activeBarBgAlpha)
              : withAlphaAny(orig.backgroundColor, inactiveAlpha);
            ds.borderColor = nextBorder;
            ds.backgroundColor = nextBackground;

            var meta = typeof chart.getDatasetMeta === 'function' ? chart.getDatasetMeta(datasetIndex) : null;
            if (meta && Array.isArray(meta.data)) {
              meta.data.forEach(function (barEl) {
                if (!barEl || !barEl.options) return;
                barEl.options.backgroundColor = nextBackground;
                barEl.options.borderColor = nextBorder;
              });
            }
          } else {
            ds.borderColor = active ? withAlphaAny(orig.borderColor, 1) : withAlphaAny(orig.borderColor, inactiveAlpha);
            ds.backgroundColor = active ? orig.backgroundColor : withAlphaAny(orig.backgroundColor, inactiveAlpha);
          }

          if (typeof orig.borderWidth === 'number') ds.borderWidth = orig.borderWidth;
          if (active && typeof orig.borderWidth === 'number') ds.borderWidth = orig.borderWidth + 0.35;
        });

        chart.update('none');
      },
      onLeave: function (_evt, _item, legend) {
        var chart = legend && legend.chart;
        if (!chart || !chart.data || !Array.isArray(chart.data.datasets)) return;
        chart._hnsLegendHoverGroup = null;
        var datasets = chart.data.datasets;
        datasets.forEach(function (ds, datasetIndex) {
          if (!ds || !ds._hnsLegendHoverOriginal) return;
          ds.borderColor = ds._hnsLegendHoverOriginal.borderColor;
          ds.backgroundColor = ds._hnsLegendHoverOriginal.backgroundColor;
          ds.borderWidth = ds._hnsLegendHoverOriginal.borderWidth;
          ds.order = ds._hnsLegendHoverOriginal.order;

          if (ds._hnsRole === 'histogram') {
            var meta = typeof chart.getDatasetMeta === 'function' ? chart.getDatasetMeta(datasetIndex) : null;
            if (meta && Array.isArray(meta.data)) {
              meta.data.forEach(function (barEl) {
                if (!barEl || !barEl.options) return;
                barEl.options.backgroundColor = ds._hnsLegendHoverOriginal.backgroundColor;
                barEl.options.borderColor = ds._hnsLegendHoverOriginal.borderColor;
              });
            }
          }
        });
        chart.update('none');
      },
    };
  }

  function buildContinuousDatasets(config) {
    var series = Array.isArray(config.series) ? config.series : [];
    var sigmaExtent = Number.isFinite(Number(config.sigmaExtent)) ? Number(config.sigmaExtent) : 3.5;
    var rangePaddingFraction = Number.isFinite(Number(config.rangePaddingFraction)) ? Number(config.rangePaddingFraction) : 0.03;
    var minStdBinWidthFactor = Number.isFinite(Number(config.minStdBinWidthFactor))
      ? Number(config.minStdBinWidthFactor)
      : 0.22;
    var normalLineTensionRaw = Number.isFinite(Number(config.normalLineTension))
      ? Number(config.normalLineTension)
      : 0.25;
    var normalLineTension = Math.max(0, Math.min(1, normalLineTensionRaw));
    var normalLinePoints = Number.isFinite(Number(config.normalLinePoints))
      ? Math.max(64, Math.round(Number(config.normalLinePoints)))
      : 2001;

    var allValues = [];
    series.forEach(function (s) {
      allValues = allValues.concat(Array.isArray(s.values) ? s.values : []);
    });
    if (!allValues.length) return null;

    var range = suggestRange(series, sigmaExtent, rangePaddingFraction);
    var min = range.min;
    var max = range.max;

    var bins = Number(config.bins);
    if (!Number.isFinite(bins) || bins <= 0) {
      bins = suggestBinCount(series, min, max);
    }
    bins = Math.max(6, Math.round(bins));

    var width = (max - min) / bins;
    var centers = new Array(bins).fill(0).map(function (_, idx) {
      return min + width * (idx + 0.5);
    });
    var labels = centers.map(function (x) { return x.toFixed(4); });
    var palette = getTokenPalette();
    var datasets = [];

    series.forEach(function (s, index) {
      var values = Array.isArray(s.values) ? s.values : [];
      if (!values.length) return;
      var meanValue = mean(values);
      var stdValue = stdDev(values, meanValue);
      var stdForFit = resolveFittedStd(values, stdValue, width, minStdBinWidthFactor);
      var counts = new Array(bins).fill(0);

      values.forEach(function (v) {
        var idx = Math.floor((v - min) / width);
        if (idx < 0) idx = 0;
        if (idx >= bins) idx = bins - 1;
        counts[idx] += 1;
      });

      var lineData = [];
      if (normalLinePoints <= 1) {
        var xOnly = min + 0.5 * (max - min);
        var xOnlyIndex = (xOnly - min) / width - 0.5;
        lineData.push({ x: xOnlyIndex, y: values.length * width * normalPdf(xOnly, meanValue, stdForFit) });
      } else {
        for (var p = 0; p < normalLinePoints; p += 1) {
          var t = p / (normalLinePoints - 1);
          var xVal = min + (max - min) * t;
          var xIndex = (xVal - min) / width - 0.5;
          var yVal = values.length * width * normalPdf(xVal, meanValue, stdForFit);
          lineData.push({ x: xIndex, y: yVal });
        }
      }

      var color = palette[index % palette.length];
      var labelBase = s.label || ('Series ' + (index + 1));

      datasets.push({
        type: 'bar',
        label: labelBase + ' histogram',
        _hnsRole: 'histogram',
        _hnsGroup: labelBase,
        _hnsBaseLabel: labelBase,
        data: counts,
        grouped: false,
        categoryPercentage: 1,
        barPercentage: 1,
        borderWidth: 1,
        borderColor: withAlpha(color, 0.72),
        backgroundColor: withAlpha(color, 0.20),
        order: 1,
      });

      datasets.push({
        type: 'line',
        label: labelBase + ' normal fit',
        _hnsRole: 'normal-fit',
        _hnsGroup: labelBase,
        _hnsBaseLabel: labelBase,
        xAxisID: 'x',
        parsing: false,
        data: lineData,
        pointRadius: 0,
        pointHoverRadius: 0,
        borderWidth: 2,
        borderDash: [7, 4],
        borderColor: withAlpha(color, 0.95),
        tension: normalLineTension,
        spanGaps: true,
        order: 2,
      });
    });

    return { labels: labels, datasets: datasets };
  }

  function createContinuousHistogramChart(config) {
    var cfg = config || {};
    var canvas = cfg.canvas;
    var series = Array.isArray(cfg.series) ? cfg.series : [];
    if (!canvas || !window.Chart || !series.length) return null;

    var legendHelper = window.SharedChartLegend;
    if (!legendHelper) return null;

    var chartData = buildContinuousDatasets({
      series: series,
      sigmaExtent: cfg.sigmaExtent,
      rangePaddingFraction: cfg.rangePaddingFraction,
      minStdBinWidthFactor: cfg.minStdBinWidthFactor,
      normalLineTension: cfg.normalLineTension,
      normalLinePoints: cfg.normalLinePoints,
      bins: cfg.bins,
    });
    if (!chartData) return null;

    var chartTheme = legendHelper.getChartTheme();
    var legendOptions = createLegendOptions({ normalLabel: cfg.normalLabel });
    legendOptions = legendOptions || { display: true };
    legendOptions.labels = Object.assign({}, legendOptions.labels || {}, {
      usePointStyle: true,
      pointStyle: 'circle',
      boxWidth: 8,
      boxHeight: 8,
      padding: 14,
    });

    var xTickCallback = typeof cfg.xTickCallback === 'function' ? cfg.xTickCallback : undefined;

    return new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: chartData.labels,
        datasets: chartData.datasets
      },
      options: legendHelper.buildChartOptions({
        theme: chartTheme,
        plugins: { legend: legendOptions },
        scales: {
          x: {
            title: { display: true, text: cfg.xTitle || '', color: chartTheme.text },
            offset: true,
            ticks: Object.assign({ color: chartTheme.text, autoSkip: true, maxTicksLimit: 12 }, xTickCallback ? { callback: xTickCallback } : {}),
            grid: { color: chartTheme.grid },
            border: { color: chartTheme.grid }
          },
          y: {
            title: { display: true, text: cfg.yTitle || 'count', color: chartTheme.text },
            ticks: { color: chartTheme.text },
            grid: { color: chartTheme.grid },
            border: { color: chartTheme.grid },
            beginAtZero: true,
          }
        }
      })
    });
  }

  window.SharedHistogramNormalChart = {
    withAlpha: withAlpha,
    getTokenPalette: getTokenPalette,
    createLegendOptions: createLegendOptions,
    suggestBinCount: suggestBinCount,
    buildDiscreteHistogramDatasets: buildDiscreteHistogramDatasets,
    buildContinuousDatasets: buildContinuousDatasets,
    createContinuousHistogramChart: createContinuousHistogramChart,
  };
})();
