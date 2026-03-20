(function () {
  function touchDistance(a, b) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  function clampedPanRange(nextMin, nextMax, clampMin, clampMax) {
    if (!Number.isFinite(nextMin) || !Number.isFinite(nextMax) || nextMax <= nextMin) {
      return { min: nextMin, max: nextMax };
    }
    if (!Number.isFinite(clampMin) || !Number.isFinite(clampMax) || clampMax <= clampMin) {
      return { min: nextMin, max: nextMax };
    }

    const span = nextMax - nextMin;
    const full = clampMax - clampMin;
    if (span >= full) return { min: clampMin, max: clampMax };
    if (nextMin < clampMin) return { min: clampMin, max: clampMin + span };
    if (nextMax > clampMax) return { min: clampMax - span, max: clampMax };
    return { min: nextMin, max: nextMax };
  }

  function nextScaleRange(scale, factor, pixel, clampMin, clampMax) {
    const min = Number(scale.min);
    const max = Number(scale.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
      return { min, max };
    }

    const center = Number.isFinite(pixel) ? scale.getValueForPixel(pixel) : ((min + max) / 2);
    const anchor = Number.isFinite(center) ? center : ((min + max) / 2);
    let nextMin = anchor - (anchor - min) * factor;
    let nextMax = anchor + (max - anchor) * factor;

    if (Number.isFinite(clampMin) && Number.isFinite(clampMax)) {
      const full = clampMax - clampMin;
      const span = Math.min(nextMax - nextMin, full);
      if (nextMin < clampMin) {
        nextMin = clampMin;
        nextMax = clampMin + span;
      }
      if (nextMax > clampMax) {
        nextMax = clampMax;
        nextMin = clampMax - span;
      }
      nextMin = Math.max(nextMin, clampMin);
      nextMax = Math.min(nextMax, clampMax);
    }

    return { min: nextMin, max: nextMax };
  }

  function attach(options) {
    const { canvas, getChart, defaults, onActivate } = options || {};
    if (!canvas || typeof getChart !== 'function') return;
    detach(canvas);

    let mouseDown = false;
    let dragActive = false;
    let moved = false;
    let downX = 0;
    let downY = 0;
    let lastClientX = 0;
    let lastClientY = 0;
    let touchMode = null;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let lastPinchDistance = 0;
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    const reset = () => {
      const chart = getChart();
      if (!chart || !defaults) return;
      if (chart.options.scales?.x && Number.isFinite(defaults.xMin) && Number.isFinite(defaults.xMax)) {
        chart.options.scales.x.min = defaults.xMin;
        chart.options.scales.x.max = defaults.xMax;
      }
      if (defaults.mode !== 'x' && chart.options.scales?.y && Number.isFinite(defaults.yMin) && Number.isFinite(defaults.yMax)) {
        chart.options.scales.y.min = defaults.yMin;
        chart.options.scales.y.max = defaults.yMax;
      }
      chart.update('none');
    };

    const panChart = (chart, dx, dy) => {
      const xScale = chart.scales?.x;
      const yScale = chart.scales?.y;
      if (!xScale) return;

      const xSpan = Number(xScale.max) - Number(xScale.min);
      const xPxSpan = xScale.right - xScale.left;
      if (xSpan > 0 && xPxSpan > 0) {
        const dValX = (-dx / xPxSpan) * xSpan;
        const nextX = clampedPanRange(Number(xScale.min) + dValX, Number(xScale.max) + dValX, defaults?.xMin, defaults?.xMax);
        chart.options.scales.x.min = nextX.min;
        chart.options.scales.x.max = nextX.max;
      }

      if (defaults?.mode !== 'x' && yScale) {
        const ySpan = Number(yScale.max) - Number(yScale.min);
        const yPxSpan = yScale.bottom - yScale.top;
        if (ySpan > 0 && yPxSpan > 0) {
          const dValY = (dy / yPxSpan) * ySpan;
          const nextY = clampedPanRange(Number(yScale.min) + dValY, Number(yScale.max) + dValY, defaults?.yMin, defaults?.yMax);
          chart.options.scales.y.min = nextY.min;
          chart.options.scales.y.max = nextY.max;
        }
      }

      chart.update('none');
    };

    const handleDblClick = () => reset();
    const handleWheel = e => {
      const chart = getChart();
      if (!chart) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 0.9 : 1.1;
      const xScale = chart.scales?.x;
      const yScale = chart.scales?.y;
      if (xScale) {
        const nextX = nextScaleRange(xScale, factor, e.offsetX, defaults?.xMin, defaults?.xMax);
        chart.options.scales.x.min = nextX.min;
        chart.options.scales.x.max = nextX.max;
      }
      if (defaults?.mode !== 'x' && yScale) {
        const nextY = nextScaleRange(yScale, factor, e.offsetY, defaults?.yMin, defaults?.yMax);
        chart.options.scales.y.min = nextY.min;
        chart.options.scales.y.max = nextY.max;
      }
      chart.update('none');
    };

    const handleMouseDown = e => {
      if (e.button !== 0) return;
      mouseDown = true;
      dragActive = false;
      moved = false;
      downX = lastClientX = e.clientX;
      downY = lastClientY = e.clientY;
      e.preventDefault();
    };

    const handleMouseMove = e => {
      if (!mouseDown) return;
      const chart = getChart();
      if (!chart) return;
      const dx = e.clientX - lastClientX;
      const dy = e.clientY - lastClientY;
      lastClientX = e.clientX;
      lastClientY = e.clientY;

      if (!dragActive) {
        const totalDx = e.clientX - downX;
        const totalDy = e.clientY - downY;
        if (Math.hypot(totalDx, totalDy) < 5) return;
        dragActive = true;
        moved = true;
      }

      canvas.style.cursor = 'grabbing';
      panChart(chart, dx, dy);
      e.preventDefault();
    };

    const handleMouseUp = () => {
      mouseDown = false;
      dragActive = false;
      canvas.style.cursor = '';
    };

    const handleClick = e => {
      if (moved) {
        moved = false;
        e.preventDefault();
        return;
      }
      if (typeof onActivate === 'function') onActivate();
    };

    const handleTouchStart = e => {
      if (e.touches.length === 1) {
        touchMode = 'pan';
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      } else if (e.touches.length >= 2) {
        touchMode = 'pinch';
        lastPinchDistance = touchDistance(e.touches[0], e.touches[1]);
      }
    };

    const handleTouchMove = e => {
      const chart = getChart();
      if (!chart) return;
      const xScale = chart.scales?.x;
      const yScale = chart.scales?.y;
      if (!xScale) return;

      if (touchMode === 'pan' && e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - lastTouchX;
        const dy = touch.clientY - lastTouchY;
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        panChart(chart, dx, dy);
        e.preventDefault();
        return;
      }

      if (e.touches.length >= 2) {
        const distance = touchDistance(e.touches[0], e.touches[1]);
        if (!(distance > 0) || !(lastPinchDistance > 0)) {
          lastPinchDistance = distance;
          return;
        }

        const factor = lastPinchDistance / distance;
        const rect = canvas.getBoundingClientRect();
        const centerX = ((e.touches[0].clientX + e.touches[1].clientX) / 2) - rect.left;
        const nextX = nextScaleRange(xScale, factor, centerX, defaults?.xMin, defaults?.xMax);
        chart.options.scales.x.min = nextX.min;
        chart.options.scales.x.max = nextX.max;

        if (defaults?.mode !== 'x' && yScale) {
          const centerY = ((e.touches[0].clientY + e.touches[1].clientY) / 2) - rect.top;
          const nextY = nextScaleRange(yScale, factor, centerY, defaults?.yMin, defaults?.yMax);
          chart.options.scales.y.min = nextY.min;
          chart.options.scales.y.max = nextY.max;
        }

        chart.update('none');
        lastPinchDistance = distance;
        touchMode = 'pinch';
        e.preventDefault();
      }
    };

    const handleTouchEnd = e => {
      if (!e.changedTouches || e.changedTouches.length !== 1) return;
      const now = Date.now();
      const touch = e.changedTouches[0];
      const dt = now - lastTapTime;
      const dx = Math.abs(touch.clientX - lastTapX);
      const dy = Math.abs(touch.clientY - lastTapY);
      if (dt > 0 && dt < 320 && dx < 24 && dy < 24) {
        reset();
        e.preventDefault();
      }
      lastTapTime = now;
      lastTapX = touch.clientX;
      lastTapY = touch.clientY;
      touchMode = null;
      lastPinchDistance = 0;
    };

    canvas.addEventListener('dblclick', handleDblClick);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    canvas._sharedChartInteractionHandlers = {
      handleDblClick,
      handleWheel,
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleClick,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
    };
  }

  function detach(canvas) {
    const handlers = canvas?._sharedChartInteractionHandlers;
    if (!handlers) return;
    canvas.removeEventListener('dblclick', handlers.handleDblClick);
    canvas.removeEventListener('wheel', handlers.handleWheel);
    canvas.removeEventListener('mousedown', handlers.handleMouseDown);
    window.removeEventListener('mousemove', handlers.handleMouseMove);
    window.removeEventListener('mouseup', handlers.handleMouseUp);
    canvas.removeEventListener('click', handlers.handleClick);
    canvas.removeEventListener('touchstart', handlers.handleTouchStart);
    canvas.removeEventListener('touchmove', handlers.handleTouchMove);
    canvas.removeEventListener('touchend', handlers.handleTouchEnd);
    canvas.style.cursor = '';
    delete canvas._sharedChartInteractionHandlers;
  }

  window.SharedChartInteractions = {
    attach,
    detach,
    touchDistance,
    clampedPanRange,
    nextScaleRange,
  };
})();
