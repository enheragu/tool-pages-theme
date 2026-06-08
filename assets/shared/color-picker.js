/* ── SharedColorPicker ───────────────────────────────────────────────────────── *
 * API:
 *   SharedColorPicker.open(initialHex, onChange)
 *     — opens the picker dialog initialised to initialHex
 *     — onChange(hex) called on every interactive color change
 *   SharedColorPicker.close()
 *     — closes the dialog programmatically
 *   SharedColorPicker.hexToRgb(hex)  → [r, g, b]
 *   SharedColorPicker.rgbToHex(r,g,b) → '#RRGGBB'
 * ─────────────────────────────────────────────────────────────────────────────*/
(function () {
  'use strict';

  // ── Color math ──────────────────────────────────────────────────────────────

  function rgbToHex(r, g, b) {
    var c = function (v) { return Math.max(0, Math.min(255, Math.round(+v || 0))).toString(16).padStart(2, '0'); };
    return ('#' + c(r) + c(g) + c(b)).toUpperCase();
  }

  function hexToRgb(hex) {
    var h = String(hex || '#808080').trim().replace(/^#/, '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
  }

  function rgbToHsv(r, g, b) {
    var rn = r / 255, gn = g / 255, bn = b / 255;
    var max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    var delta = max - min, h = 0;
    if (delta) {
      if (max === rn)      h = ((gn - bn) / delta) % 6;
      else if (max === gn) h = (bn - rn) / delta + 2;
      else                 h = (rn - gn) / delta + 4;
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }
    return { h: h, s: max ? (delta / max) * 100 : 0, v: max * 100 };
  }

  function hsvToRgb(h, s, v) {
    var hh = ((+h % 360) + 360) % 360;
    var ss = Math.max(0, Math.min(100, +s)) / 100;
    var vv = Math.max(0, Math.min(100, +v)) / 100;
    var c = vv * ss, x = c * (1 - Math.abs(((hh / 60) % 2) - 1)), m = vv - c;
    var r1 = 0, g1 = 0, b1 = 0;
    if      (hh < 60)  { r1 = c; g1 = x; }
    else if (hh < 120) { r1 = x; g1 = c; }
    else if (hh < 180) { g1 = c; b1 = x; }
    else if (hh < 240) { g1 = x; b1 = c; }
    else if (hh < 300) { r1 = x; b1 = c; }
    else               { r1 = c; b1 = x; }
    return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
  }

  // ── Internal state ───────────────────────────────────────────────────────────

  var _hsv = { h: 0, s: 0, v: 100 };
  var _onChange = null;
  var _bound = false;
  var _d = null;

  function _dom() {
    if (_d) return _d;
    _d = {
      dialog:  document.getElementById('shared-color-picker-dialog'),
      sv:      document.getElementById('shared-cp-sv'),
      svThumb: document.getElementById('shared-cp-sv-thumb'),
      hue:     document.getElementById('shared-cp-hue'),
      r:       document.getElementById('shared-cp-r'),
      g:       document.getElementById('shared-cp-g'),
      b:       document.getElementById('shared-cp-b'),
      hex:     document.getElementById('shared-cp-hex'),
      close:   document.getElementById('shared-cp-close')
    };
    return _d;
  }

  function _syncUI() {
    var d = _dom();
    if (!d.sv) return;
    d.sv.style.setProperty('--picker-hue', _hsv.h + 'deg');
    d.svThumb.style.left = _hsv.s + '%';
    d.svThumb.style.top  = (100 - _hsv.v) + '%';
    d.sv.setAttribute('aria-valuenow', String(Math.round(_hsv.s)));
    d.sv.setAttribute('aria-valuetext', 'S ' + Math.round(_hsv.s) + ' V ' + Math.round(_hsv.v));
    if (document.activeElement !== d.hue) d.hue.value = String(Math.round(_hsv.h));
    var rgb = hsvToRgb(_hsv.h, _hsv.s, _hsv.v);
    if (document.activeElement !== d.r) d.r.value = String(rgb[0]);
    if (document.activeElement !== d.g) d.g.value = String(rgb[1]);
    if (document.activeElement !== d.b) d.b.value = String(rgb[2]);
    var hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
    if (document.activeElement !== d.hex) d.hex.value = hex;
  }

  function _emit() {
    _syncUI();
    if (_onChange) {
      var rgb = hsvToRgb(_hsv.h, _hsv.s, _hsv.v);
      _onChange(rgbToHex(rgb[0], rgb[1], rgb[2]));
    }
  }

  function _bind() {
    if (_bound) return;
    _bound = true;
    var d = _dom();
    if (!d.dialog) return;

    d.close && d.close.addEventListener('click', function () { d.dialog.close(); });
    d.dialog.addEventListener('cancel', function (e) { e.preventDefault(); d.dialog.close(); });
    d.dialog.addEventListener('click', function (e) { if (e.target === d.dialog) d.dialog.close(); });

    if (d.sv) {
      d.sv.addEventListener('pointerdown', function (e) {
        function move(ev) {
          var rect = d.sv.getBoundingClientRect();
          _hsv.s = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
          _hsv.v = Math.max(0, Math.min(100, (1 - (ev.clientY - rect.top) / rect.height) * 100));
          _emit();
        }
        move(e);
        var up = function () { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      });

      d.sv.addEventListener('keydown', function (e) {
        var step = e.shiftKey ? 5 : 1, changed = false;
        if (e.key === 'ArrowLeft')  { _hsv.s = Math.max(0,   _hsv.s - step); changed = true; }
        if (e.key === 'ArrowRight') { _hsv.s = Math.min(100, _hsv.s + step); changed = true; }
        if (e.key === 'ArrowUp')    { _hsv.v = Math.min(100, _hsv.v + step); changed = true; }
        if (e.key === 'ArrowDown')  { _hsv.v = Math.max(0,   _hsv.v - step); changed = true; }
        if (!changed) return;
        e.preventDefault();
        _emit();
      });
    }

    d.hue && d.hue.addEventListener('input', function () {
      _hsv.h = Number(this.value) || 0;
      _emit();
    });

    [d.r, d.g, d.b].forEach(function (el) {
      if (!el) return;
      el.addEventListener('input', function () {
        var r = +d.r.value, g = +d.g.value, b = +d.b.value;
        if (isNaN(r) || isNaN(g) || isNaN(b)) return;
        _hsv = rgbToHsv(r, g, b);
        _emit();
      });
    });

    d.hex && d.hex.addEventListener('input', function () {
      var val = this.value.trim();
      if (!/^#[0-9A-Fa-f]{6}$/.test(val)) return;
      var rgb = hexToRgb(val);
      _hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
      _emit();
    });

    var chips = d.dialog.querySelectorAll('.palette-chip');
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var rgb = hexToRgb(this.dataset.paletteColor);
        _hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
        _emit();
      });
    });
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  window.SharedColorPicker = {
    open: function (initialHex, onChange) {
      var d = _dom();
      if (!d.dialog) return;
      _onChange = onChange || null;
      var rgb = hexToRgb(initialHex || '#FF0000');
      _hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
      _bind();
      _syncUI();
      if (!d.dialog.open) d.dialog.showModal();
    },
    close: function () {
      var d = _dom();
      if (d.dialog && d.dialog.open) d.dialog.close();
    },
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex
  };
})();
