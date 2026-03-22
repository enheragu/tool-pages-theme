/**
 * SharedImageCard – reusable image card controller.
 *
 * Handles file loading (file-input, drag-and-drop, URL), preview rendering
 * to a canvas element, expand-button wiring, and clear-button wiring.
 *
 * Does NOT handle channel assignment or view modes – those are tool-specific.
 *
 * Usage:
 *   const card = window.SharedImageCard.create({
 *     canvasId:    'preview-rgb',          // OR canvas: element
 *     fileInputId: 'file-rgb',             // OR fileInput: element
 *     clearBtnId:  'btn-clear-rgb',        // OR clearBtn: element  (optional)
 *     expandBtnId: 'btn-expand-rgb',       // OR expandBtn: element (optional)
 *     dropHintId:  'drop-hint-rgb',        // OR dropHint: element  (optional)
 *     fileNameId:  'file-name-rgb',        // OR fileNameEl: element (optional)
 *     dragTarget:  someElement,            // optional – element to attach drag events to
 *                                          //   (default: canvas.closest('.preview-wrap') || canvas)
 *     dragOverClass: 'is-drag-over',       // optional – CSS class during drag (default: 'drag-over')
 *     onLoad:  (bitmap, fileName) => { ... },
 *     onClear: () => { ... },
 *     onExpand: (bitmap) => { ... },       // optional – caller wires modal open
 *   });
 *
 *   card.loadUrl('/path/to/image.jpg');
 *   card.setImage(bitmap, 'label');  // sync external state (e.g. sample loads) without triggering onLoad
 *   card.getBitmap();   // → ImageBitmap | null
 *   card.hasImage();    // → boolean
 *   card.clear();
 */
window.SharedImageCard = (() => {
  'use strict';

  /**
   * Draw an ImageBitmap (or HTMLImageElement) into a canvas, letterboxed.
   * @param {HTMLCanvasElement} canvas
   * @param {ImageBitmap|HTMLImageElement} bitmap
   */
  function drawLetterboxed(canvas, bitmap) {
    const ctx = canvas.getContext('2d');
    const cw = canvas.width;
    const ch = canvas.height;
    const bw = bitmap.width || bitmap.naturalWidth;
    const bh = bitmap.height || bitmap.naturalHeight;
    const scale = Math.min(cw / bw, ch / bh);
    const dw = bw * scale;
    const dh = bh * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(bitmap, dx, dy, dw, dh);
  }

  /**
   * Create an image card controller.
   * @param {object} config
   */
  function create(config) {
    const {
      // Element IDs (string) – resolved via getElementById
      canvasId,
      fileInputId,
      clearBtnId,
      expandBtnId,
      dropHintId,
      fileNameId,
      // Direct element references (take precedence over ID strings)
      canvas:      canvasEl,
      fileInput:   fileInputEl,
      clearBtn:    clearBtnEl,
      expandBtn:   expandBtnEl,
      dropHint:    dropHintEl,
      fileNameEl:  fileNameElProp,
      // Drag configuration
      dragTarget,                       // element to attach drag events (overrides .preview-wrap)
      dragOverClass = 'drag-over',      // CSS class added during drag
      // Callbacks
      onLoad,
      onClear,
      onExpand,
    } = config;

    const canvas     = canvasEl      || (canvasId     ? document.getElementById(canvasId)     : null);
    const fileInput  = fileInputEl   || (fileInputId  ? document.getElementById(fileInputId)  : null);
    const clearBtn   = clearBtnEl    || (clearBtnId   ? document.getElementById(clearBtnId)   : null);
    const expandBtn  = expandBtnEl   || (expandBtnId  ? document.getElementById(expandBtnId)  : null);
    const dropHint   = dropHintEl    || (dropHintId   ? document.getElementById(dropHintId)   : null);
    const fileNameEl = fileNameElProp || (fileNameId   ? document.getElementById(fileNameId)   : null);

    let _bitmap   = null;
    let _fileName = '';

    // ── internal helpers ──────────────────────────────────────────

    function _markLoaded(bitmap, fileName) {
      _bitmap   = bitmap;
      _fileName = fileName;

      drawLetterboxed(canvas, bitmap);

      if (fileNameEl) fileNameEl.textContent = fileName;
      if (dropHint)   dropHint.closest('.preview-wrap')?.classList.add('has-image');
      if (clearBtn)   clearBtn.disabled = false;

      if (typeof onLoad === 'function') onLoad(bitmap, fileName);
    }

    function _fromFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      createImageBitmap(file)
        .then((bmp) => _markLoaded(bmp, file.name))
        .catch((err) => console.warn('[SharedImageCard] Failed to decode file:', err));
    }

    // ── public API ────────────────────────────────────────────────

    function loadUrl(url, labelOverride) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        createImageBitmap(img)
          .then((bmp) => _markLoaded(bmp, labelOverride || url.split('/').pop()))
          .catch(() => {
            // Fallback: draw the img element directly
            canvas.width = canvas.width; // clear
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            _markLoaded(img, labelOverride || url.split('/').pop());
          });
      };
      img.onerror = () => console.warn('[SharedImageCard] Failed to load URL:', url);
      img.src = url;
    }

    function loadFile(file) {
      _fromFile(file);
    }

    /**
     * Sync card state with an externally loaded image (e.g. sample preloads).
     * Updates internal state and UI (clear button, file-name label) without triggering onLoad.
     * @param {ImageBitmap|HTMLImageElement} imageOrBitmap
     * @param {string} fileName
     */
    function setImage(imageOrBitmap, fileName) {
      _bitmap   = imageOrBitmap;
      _fileName = fileName;
      if (canvas) drawLetterboxed(canvas, imageOrBitmap);
      if (fileNameEl) fileNameEl.textContent = fileName;
      if (dropHint)   dropHint.closest('.preview-wrap')?.classList.add('has-image');
      if (clearBtn)   clearBtn.disabled = false;
    }

    function clear() {
      _bitmap   = null;
      _fileName = '';

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (fileInput)  fileInput.value = '';
      if (fileNameEl) fileNameEl.textContent = '';
      if (dropHint)   dropHint.closest('.preview-wrap')?.classList.remove('has-image');
      if (clearBtn)   clearBtn.disabled = true;

      if (typeof onClear === 'function') onClear();
    }

    function getBitmap()  { return _bitmap; }
    function getFileName(){ return _fileName; }
    function hasImage()   { return _bitmap !== null; }

    // ── event wiring ──────────────────────────────────────────────

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) _fromFile(e.target.files[0]);
      });
    }

    if (clearBtn) {
      clearBtn.disabled = true;
      clearBtn.addEventListener('click', clear);
    }

    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        if (_bitmap && typeof onExpand === 'function') onExpand(_bitmap);
      });
    }

    // Drag-and-drop + click-to-pick on canvas
    if (canvas) {
      const dropZone = dragTarget || canvas.closest('.preview-wrap') || canvas;

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add(dragOverClass);
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove(dragOverClass);
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove(dragOverClass);
        const file = e.dataTransfer?.files[0];
        if (file) _fromFile(file);
      });

      // Click on canvas / drop-hint triggers file input
      if (fileInput) {
        canvas.addEventListener('click', () => fileInput.click());
        if (dropHint) {
          dropHint.addEventListener('click', () => fileInput.click());
        }
      }
    }

    return { getBitmap, getFileName, hasImage, loadUrl, loadFile, setImage, clear };
  }

  return { create, drawLetterboxed };
})();
