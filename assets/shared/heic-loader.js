/* ── SharedHeicLoader ────────────────────────────────────────────────────────── *
 * Detects HEIC/HEIF files and converts them to JPEG blobs via heic2any (lazy CDN).
 * API:
 *   SharedHeicLoader.isHeic(file)          → boolean
 *   SharedHeicLoader.toBlob(file)          → Promise<Blob>  (JPEG; original if not HEIC)
 *   SharedHeicLoader.toBlobUrl(file)       → Promise<string> (object URL; caller must revoke)
 * ─────────────────────────────────────────────────────────────────────────────*/
(function () {
  'use strict';

  var CDN_URL = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
  var _loaded = false;
  var _loading = null;

  function isHeic(file) {
    if (!file) return false;
    var type = (file.type || '').toLowerCase();
    var name = (file.name || '').toLowerCase();
    return type === 'image/heic' || type === 'image/heif' ||
           type === 'image/heic-sequence' || type === 'image/heif-sequence' ||
           name.endsWith('.heic') || name.endsWith('.heif');
  }

  function _ensureLib() {
    if (_loaded && window.heic2any) return Promise.resolve();
    if (_loading) return _loading;
    _loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = CDN_URL;
      s.onload  = function () { _loaded = true; resolve(); };
      s.onerror = function () { reject(new Error('heic2any CDN load failed')); };
      document.head.appendChild(s);
    });
    return _loading;
  }

  function toBlob(file) {
    if (!isHeic(file)) return Promise.resolve(file);
    return _ensureLib().then(function () {
      return window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    }).then(function (result) {
      return Array.isArray(result) ? result[0] : result;
    });
  }

  function toBlobUrl(file) {
    return toBlob(file).then(function (blob) {
      return URL.createObjectURL(blob);
    });
  }

  window.SharedHeicLoader = { isHeic: isHeic, toBlob: toBlob, toBlobUrl: toBlobUrl };
})();
