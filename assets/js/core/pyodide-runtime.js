/*
 * pyodide-runtime.js — shared Pyodide runtime for tool-pages-theme.
 *
 * Generic, reusable wrapper around a Pyodide-in-a-Web-Worker. Replaces the
 * duplicated worker boilerplate that lived in psychometric-tools/DIF-AnalysisTool
 * and mlv-tools (worker spawn, ready handshake, id→callback routing, prewarm).
 *
 * Usage:
 *   const rt = PyodideRuntime.create({
 *     id: 'multispectral',
 *     version: '0.27.0',                 // pyodide CDN version
 *     packages: ['numpy'],               // loaded at init
 *     pythonCode: '<python source>',     // run once at init (defines functions)
 *     prewarm: true,                     // begin loading immediately
 *   });
 *   await rt.ready();
 *   await rt.loadPackages(['scipy', 'scikit-image']);   // lazy, idempotent
 *   await rt.install(['curvelets']);                     // micropip (pure-python wheels)
 *   const out = await rt.call('combine', payloadObj, { transfer: [buf] });
 *   rt.terminate();
 *
 * call(fn, payload): the worker runs `fn(payload)` in Python, where `payload`
 * is the JS object converted via .to_py() (TypedArrays become memoryviews →
 * wrap with np.asarray). Return a Python dict; bytes/bytearray values come back
 * as JS Uint8Array (their ArrayBuffers are transferred back, zero-copy).
 */
(function () {
  if (window.PyodideRuntime) return;

  function buildWorkerSrc(cfg) {
    var cdn = 'https://cdn.jsdelivr.net/pyodide/v' + cfg.version + '/full/pyodide.js';
    // The worker is intentionally self-contained (no closures over JS scope).
    return [
      "importScripts('" + cdn + "');",
      'var _py = null;',
      'var _loaded = {};',            // package name -> true
      '',
      'async function _ensure(pkgs) {',
      '  pkgs = (pkgs || []).filter(function (p) { return !_loaded[p]; });',
      '  if (!pkgs.length) return;',
      '  await _py.loadPackage(pkgs);',
      '  pkgs.forEach(function (p) { _loaded[p] = true; });',
      '}',
      '',
      'async function _install(pkgs) {',  // micropip for pure-python PyPI wheels
      '  pkgs = (pkgs || []).filter(function (p) { return !_loaded[p]; });',
      '  if (!pkgs.length) return;',
      "  await _py.loadPackage('micropip');",
      '  var micropip = _py.pyimport("micropip");',
      '  for (var i = 0; i < pkgs.length; i++) { await micropip.install(pkgs[i]); _loaded[pkgs[i]] = true; }',
      '}',
      '',
      'function _writeFiles(files) {',   // {path: content} → written to Pyodide FS (mkdir -p)
      '  if (!files) return;',
      '  var FS = _py.FS;',
      '  Object.keys(files).forEach(function (path) {',
      '    var parts = path.split("/"); var dir = "";',
      '    for (var i = 0; i < parts.length - 1; i++) {',
      '      dir += (i ? "/" : "") + parts[i];',
      '      try { FS.mkdir(dir); } catch (e) { /* exists */ }',
      '    }',
      '    FS.writeFile(path, files[path]);',
      '  });',
      '}',
      '',
      'async function _init(msg) {',
      '  try {',
      '    _py = await loadPyodide();',
      '    await _ensure(msg.packages);',
      '    if (msg.install && msg.install.length) await _install(msg.install);',
      '    _writeFiles(msg.files);',
      '    if (msg.pythonCode) _py.runPython(msg.pythonCode);',
      '    // tiny dispatch helper: call a named global with the JS payload',
      "    _py.runPython('def _dispatch(_fn, _payload):\\n    return globals()[_fn](_payload)');",
      "    postMessage({ type: 'ready' });",
      '  } catch (err) {',
      "    postMessage({ type: 'fatal', error: String(err && err.stack || err) });",
      '  }',
      '}',
      '',
      'onmessage = async function (e) {',
      '  var d = e.data;',
      '  try {',
      "    if (d.type === 'init') { return _init(d); }",
      "    if (d.type === 'load') { await _ensure(d.packages); return postMessage({ type: 'loaded', id: d.id }); }",
      "    if (d.type === 'install') { await _install(d.packages); return postMessage({ type: 'loaded', id: d.id }); }",
      "    if (d.type === 'call') {",
      '      _py.globals.set("_payload", d.payload);',
      '      var pyRes = _py.runPython("_dispatch(" + JSON.stringify(d.fn) + ", _payload)");',
      '      var res = pyRes;',
      '      if (pyRes && typeof pyRes.toJs === "function") { res = pyRes.toJs({ dict_converter: Object.fromEntries }); pyRes.destroy(); }',
      '      // collect ArrayBuffers for zero-copy transfer back',
      '      var transfer = [];',
      '      (function scan(o) {',
      '        if (!o) return;',
      '        if (o.buffer instanceof ArrayBuffer) { transfer.push(o.buffer); return; }',
      '        if (o instanceof ArrayBuffer) { transfer.push(o); return; }',
      '        if (typeof o === "object") { for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) scan(o[k]); } }',
      '      })(res);',
      "      return postMessage({ type: 'result', id: d.id, result: res }, transfer);",
      '    }',
      '  } catch (err) {',
      "    postMessage({ type: 'error', id: d.id, error: String(err && err.stack || err) });",
      '  }',
      '};',
    ].join('\n');
  }

  function create(cfg) {
    cfg = cfg || {};
    cfg.version = cfg.version || '0.27.0';
    cfg.packages = cfg.packages || [];
    var nWorkers = Math.max(1, cfg.workers || 1);

    var workers = [];
    var readyPromise = null;
    var callbacks = {};
    var callId = 0;
    var rr = 0;            // round-robin index

    function spawn() {
      var src = buildWorkerSrc(cfg);
      var blob = new Blob([src], { type: 'application/javascript' });
      var url = URL.createObjectURL(blob);
      var w = new Worker(url);
      URL.revokeObjectURL(url);
      w.addEventListener('message', function (e) {
        var d = e.data;
        if (d.type === 'ready' || d.type === 'fatal') return; // handled in ready()
        var cb = callbacks[d.id];
        if (!cb) return;
        delete callbacks[d.id];
        if (d.type === 'error') cb.reject(new Error(d.error));
        else cb.resolve(d.result);          // 'result' or 'loaded'(result undefined)
      });
      return w;
    }

    function ready() {
      if (readyPromise) return readyPromise;
      readyPromise = new Promise(function (resolve, reject) {
        var done = 0, failed = false;
        for (var i = 0; i < nWorkers; i++) {
          var w = spawn();
          workers.push(w);
          w.addEventListener('message', function (e) {
            if (failed) return;
            if (e.data.type === 'fatal') { failed = true; return reject(new Error(e.data.error)); }
            if (e.data.type === 'ready') { done += 1; if (done === nWorkers) resolve(); }
          });
          w.onerror = function (err) { if (!failed) { failed = true; reject(new Error('Pyodide worker failed: ' + (err.message || err))); } };
          w.postMessage({ type: 'init', packages: cfg.packages, install: cfg.install, files: cfg.files, pythonCode: cfg.pythonCode });
        }
      });
      readyPromise.catch(function () { readyPromise = null; });
      return readyPromise;
    }

    function broadcast(type, packages) {
      return ready().then(function () {
        return Promise.all(workers.map(function (w) {
          return new Promise(function (resolve, reject) {
            var id = ++callId;
            callbacks[id] = { resolve: resolve, reject: reject };
            w.postMessage({ type: type, id: id, packages: packages });
          });
        }));
      });
    }

    function call(fn, payload, opts) {
      opts = opts || {};
      return ready().then(function () {
        var w = workers[rr++ % workers.length];
        return new Promise(function (resolve, reject) {
          var id = ++callId;
          callbacks[id] = { resolve: resolve, reject: reject };
          w.postMessage({ type: 'call', id: id, fn: fn, payload: payload }, opts.transfer || []);
        });
      });
    }

    function terminate() {
      workers.forEach(function (w) { w.terminate(); });
      Object.keys(callbacks).forEach(function (id) { callbacks[id].reject(new Error('terminated')); });
      workers = []; callbacks = {}; readyPromise = null;
    }

    if (cfg.prewarm) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { ready().catch(function () {}); });
      } else {
        ready().catch(function () {});
      }
    }

    return {
      ready: ready,
      loadPackages: function (pkgs) { return broadcast('load', pkgs); },
      install: function (pkgs) { return broadcast('install', pkgs); },
      call: call,
      terminate: terminate,
      _workers: function () { return workers; },
    };
  }

  window.PyodideRuntime = { create: create };
})();
