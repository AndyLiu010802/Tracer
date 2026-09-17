(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerPetAnimation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const asset = /^\/api\/pet-art\/[a-f0-9]{32}\.png$/;
  const actions = Object.freeze(['idle', 'pet', 'feed', 'play', 'sleep', 'wake', 'focus', 'drag', 'fishing', 'exercise', 'farming', 'mining', 'reading', 'writing', 'crafting', 'tea']);
  // Hold anticipation and recovery poses so a loop has time to settle between gestures.
  const timings = [[2400,900,450,1800],[650,450,550,1000],[900,650,750,1100],[850,450,500,1000],
    [2000,1600,1800,2000],[750,800,1100,850],[2200,950,1800,1100],[1100,750,850,1300],
    [3000,900,1400,2000],[1600,950,1300,1800],[2200,1100,1800,2200],[2200,900,1100,2200],
    [3400,1100,1800,2400],[2600,1400,2200,1600],[2400,1500,2000,2400],[2800,1400,2200,2800]];
  const clips = Object.freeze(Object.fromEntries(actions.map((action, i) => [action, Object.freeze({ page: Math.floor(i / 4), row: i % 4, frames: 4, frameMs: Object.freeze(timings[i]) })])));
  // Dense sheets contain one complete action in reading order, including the in-betweens.
  // Keep expressive motion close together; long pauses belong to the resting pose only.
  const denseClips = Object.freeze(Object.fromEntries(actions.map((action, page) => {
    const quiet = ['idle', 'sleep', 'focus'].includes(action), work = page >= 8;
    const step = action === 'sleep' ? 160 : quiet ? 120 : work ? 100 : 85;
    const frameMs = Array.from({ length: 16 }, (_, i) => i === 0 ? (quiet ? 1200 : work ? 550 : 180) : i === 15 ? (quiet ? 500 : work ? 300 : 180) : step);
    return [action, Object.freeze({ page, row: 0, frames: 16, frameMs: Object.freeze(frameMs) })];
  })));
  const invalid = () => new Error('invalid-animation-sheet');
  const noCrop = 'inset(0% 0% 0% 0%)';
  // Older generated sheets can cross a grid line. Hide only a small, disconnected
  // strip that demonstrably continues from the neighboring cell; never resize art.
  function frameInsets(data, edge) {
    const size = edge / 4, band = Math.floor(size * .08) - 1, gap = Math.ceil(size * .02), result = [];
    const alpha = (x, y) => data[(y * edge + x) * 4 + 3];
    for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
      const left = column * size, top = row * size, counts = [new Uint32Array(size), new Uint32Array(size)];
      let total = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (alpha(left + x, top + y) >= 16) {
        counts[0][y]++; counts[1][x]++; total++;
      }
      const insets = [0, 0, 0, 0];
      let trimmed = 0;
      for (let side = 0; side < 4; side++) {
        if ((side === 0 && row === 0) || (side === 1 && column === 3) || (side === 2 && row === 3) || (side === 3 && column === 0)) continue;
        const horizontal = side % 2 === 0, reverse = side === 1 || side === 2;
        const lines = counts[horizontal ? 0 : 1];
        let continuity = 0;
        for (let i = 0; i < size; i++) {
          const x = left + (horizontal ? i : reverse ? size - 1 : 0);
          const y = top + (horizontal ? reverse ? size - 1 : 0 : i);
          if (alpha(x, y) >= 32 && alpha(x + (horizontal ? 0 : reverse ? 1 : -1), y + (horizontal ? reverse ? 1 : -1 : 0)) >= 32) continuity++;
        }
        if (continuity < 2) continue;
        let area = 0, clear = 0, end = 0;
        for (let distance = 0; distance < band + gap; distance++) {
          const count = lines[reverse ? size - 1 - distance : distance];
          if (count) { area += count; clear = 0; end = distance + 1; }
          else clear++;
          if (end > band || area > total * .1) break;
          if (end && clear >= gap) { insets[side] = (end + 1) * 100 / size; trimmed += area; break; }
        }
      }
      result.push(trimmed > total * .1 ? noCrop : 'inset(' + insets.map(value => value + '%').join(' ') + ')');
    }
    return result;
  }
  function sheetPixels(image) {
    const canvas = root.document.createElement('canvas'); canvas.width = canvas.height = 768;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw invalid();
    context.imageSmoothingEnabled = false; context.drawImage(image, 0, 0, 768, 768);
    return context.getImageData(0, 0, 768, 768).data;
  }
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || ![1, 2].includes(raw.version) ||
      Object.keys(raw).some(key => key !== 'version' && key !== 'pages') || !Array.isArray(raw.pages) || !(raw.version === 2 ? raw.pages.length === actions.length : [3, 4].includes(raw.pages.length)) ||
      !Array.from({ length: raw.pages.length }, (_, i) => i).every(i => typeof raw.pages[i] === 'string' && asset.test(raw.pages[i]))) return null;
    return { version: raw.version, pages: raw.pages.slice() };
  }
  function player(pages, options, firstPage, version = 1) {
    const selectedClips = version === 2 ? denseClips : clips, firstAction = actions[firstPage * (version === 2 ? 1 : 4)];
    const doc = root.document;
    if (!doc || typeof doc.createElement !== 'function') throw invalid();
    const element = doc.createElement('span'), image = doc.createElement('img'), placeholder = doc.createElement('span');
    const label = typeof options.label === 'string' ? options.label : 'Companion';
    element.className = 'pet-sprite pet-custom-sprite pet-animated-sprite';
    element.setAttribute('role', 'img'); element.setAttribute('aria-label', label);
    Object.assign(element.style, { position: 'relative', display: 'block', aspectRatio: '1 / 1', overflow: 'hidden', flexShrink: '0', pointerEvents: 'none', imageRendering: 'pixelated' });
    // These atlases already contain the poses; do not add whole-portrait CSS motion.
    element.style.setProperty('animation', 'none', 'important');
    image.className = 'pet-animation-sheet'; image.alt = ''; image.draggable = false; image.setAttribute('aria-hidden', 'true');
    Object.assign(image.style, { position: 'absolute', display: 'block', inset: '0 auto auto 0', width: '400%', height: '400%', minWidth: '0', minHeight: '0', maxWidth: 'none', maxHeight: 'none', objectFit: 'fill', margin: '0', padding: '0', border: '0', imageRendering: 'pixelated', transformOrigin: '0 0', pointerEvents: 'none' });
    image.style.setProperty('animation', 'none', 'important');
    element.appendChild(image);
    placeholder.className = 'pet-animation-placeholder'; placeholder.textContent = '✦'; placeholder.setAttribute('aria-hidden', 'true');
    Object.assign(placeholder.style, { position: 'absolute', inset: '0', display: 'none', alignItems: 'center', justifyContent: 'center', color: 'var(--pet-accent, #d6c17a)', font: '600 clamp(32px, 8vw, 72px) ui-sans-serif, sans-serif', textShadow: '0 3px 12px #0003' });
    element.appendChild(placeholder);
    const animated = options.animated !== false;
    const motion = animated && typeof root.matchMedia === 'function' ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const preloads = [];
    // Do not decode all sixteen large sheets just to show the first action.
    if (animated && typeof root.Image === 'function') for (const url of version === 2 ? pages.slice(firstPage + 1, firstPage + 2) : pages) {
      if (!url || url === pages[firstPage]) continue;
      const preload = new root.Image(); preload.decoding = 'async'; preload.src = url; preloads.push(preload);
    }
    const crops = new Map();
    let action = firstAction, requestedAction = action, frame = 0, timer = null, destroyed = false, unavailable = false, loading = false, loadSequence = 0;
    function crop() {
      const clip = selectedClips[action];
      element.style.clipPath = loading ? noCrop : crops.get(pages[clip.page])?.[version === 2 ? frame : clip.row * 4 + frame] || noCrop;
    }
    function draw(reload = false) {
      const clip = selectedClips[action], row = version === 2 ? Math.floor(frame / 4) : clip.row, column = frame % 4;
      element.dataset.action = action; element.dataset.page = String(clip.page); element.dataset.row = String(row); element.dataset.frame = String(frame);
      if (reload || image.getAttribute('src') !== pages[clip.page]) {
        const sequence = ++loadSequence;
        loading = true; image.style.visibility = 'hidden';
        image.onload = () => {
          if (destroyed || sequence !== loadSequence) return;
          if (!crops.has(pages[clip.page])) {
            try { crops.set(pages[clip.page], frameInsets(sheetPixels(image), 768)); } catch { /* Keep legacy art visible if pixel inspection is unavailable. */ }
          }
          loading = false; unavailable = false; delete element.dataset.error; crop();
          image.style.visibility = 'visible';
          image.style.display = 'block'; placeholder.style.display = 'none'; element.setAttribute('aria-label', label);
          schedule();
        };
        image.onerror = () => {
          if (destroyed || sequence !== loadSequence) return;
          const failure = { page: clip.page, action };
          loading = false; unavailable = true; stop(); element.style.clipPath = noCrop; element.dataset.error = 'image-unavailable';
          image.style.display = 'none'; placeholder.style.display = 'flex'; element.setAttribute('aria-label', label + ' — artwork unavailable');
          if (clip.page !== 0 && pages[0]) { action = 'idle'; frame = 0; draw(true); }
          schedule();
          if (typeof options.onError === 'function') { try { options.onError(failure); } catch {} }
        };
        image.setAttribute('src', pages[clip.page]);
      }
      image.style.transform = 'translate(' + (-column * 25) + '%, ' + (-row * 25) + '%)';
      crop();
    }
    function stop() { if (timer !== null) root.clearTimeout(timer); timer = null; }
    function paused() { return destroyed || unavailable || loading || options.animated === false || motion?.matches || doc.visibilityState === 'hidden'; }
    function schedule() {
      stop();
      element.dataset.playback = destroyed ? 'destroyed' : unavailable ? 'image-unavailable' : loading ? 'loading' : options.animated === false ? 'static' : motion?.matches ? 'reduced-motion' : doc.visibilityState === 'hidden' ? 'hidden' : 'playing';
      if (!paused()) timer = root.setTimeout(() => {
        timer = null;
        if (paused()) { schedule(); return; }
        frame = (frame + 1) % selectedClips[action].frames; draw(); schedule();
      }, selectedClips[action].frameMs[frame]);
    }
    function changed() { if (destroyed) return; if (motion?.matches) { frame = 0; draw(); } schedule(); }
    if (animated) doc.addEventListener('visibilitychange', changed);
    if (motion?.addEventListener) motion.addEventListener('change', changed);
    else motion?.addListener?.(changed);
    draw(); schedule();
    return {
      element,
      setAction(value) {
        if (destroyed) return;
        const next = Object.prototype.hasOwnProperty.call(selectedClips, value) && pages[selectedClips[value].page] ? value : firstAction;
        // Repeated snapshots of the failed action must not create an automatic retry loop.
        if (requestedAction === next) return;
        requestedAction = next; action = next; frame = 0; draw(unavailable); schedule();
      },
      destroy() {
        if (destroyed) return;
        destroyed = true; stop(); loadSequence++; image.onload = image.onerror = null; element.dataset.playback = 'destroyed';
        if (animated) doc.removeEventListener('visibilitychange', changed);
        if (motion?.removeEventListener) motion.removeEventListener('change', changed);
        else motion?.removeListener?.(changed);
        for (const preload of preloads) preload.src = '';
        preloads.length = 0;
        crops.clear();
      }
    };
  }
  function create(options = {}) {
    const animation = normalize(options.animation);
    if (!animation || options.image !== animation.pages[0]) throw invalid();
    return player(animation.pages, options, 0, animation.version);
  }
  function createPage(image, pageIndex, options = {}) {
    const version = options.version === undefined ? 1 : options.version;
    if (![1, 2].includes(version) || typeof image !== 'string' || !asset.test(image) || !Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= actions.length / (version === 2 ? 1 : 4)) throw invalid();
    const pages = []; pages[pageIndex] = image;
    return player(pages, options, pageIndex, version);
  }
  // Pixel checks establish a usable transparent atlas, not semantic pose quality or likeness.
  function inspectPixels(data, edge, version) {
    const cells = [], size = edge / 4, count = size * size;
    for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
      const pixels = new Uint8ClampedArray(count * 4);
      let foreground = 0, transparent = 0, boundary = 0, minX = size, minY = size, maxX = -1, maxY = -1;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const from = ((row * size + y) * edge + column * size + x) * 4, to = (y * size + x) * 4;
        const alpha = data[from + 3];
        // Premultiply RGB so invisible background colors cannot fake different frames.
        for (let channel = 0; channel < 3; channel++) pixels[to + channel] = Math.round(data[from + channel] * alpha / 255);
        pixels[to + 3] = alpha;
        if (alpha < 16) transparent++;
        // A narrow safety seam catches clipped anatomy and neighboring action strips.
        // The art prompt requests much more space; allow harmless faint edge noise.
        if (alpha >= 32 && (x < 2 || y < 2 || x >= size - 2 || y >= size - 2)) boundary++;
        if (alpha >= 32) { foreground++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
      }
      if (foreground < count * .006 || transparent < count * .03 || boundary > 2) throw invalid();
      cells.push({ pixels, foreground, minX, minY, maxX, maxY });
    }
    function differs(a, b, align) {
      const dx = align ? b.minX - a.minX : 0, dy = align ? b.minY - a.minY : 0;
      let changed = 0;
      const minimum = Math.max(8, Math.floor(Math.min(a.foreground, b.foreground) * .001));
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const from = (y * size + x) * 4, bx = x + dx, by = y + dy, to = (by * size + bx) * 4;
        let distance = 0;
        for (let channel = 0; channel < 4; channel++) distance += Math.abs(a.pixels[from + channel] - (bx < 0 || by < 0 || bx >= size || by >= size ? 0 : b.pixels[to + channel]));
        if (distance > 32 && ++changed >= minimum) return true;
      }
      return false;
    }
    if (version === 2) {
      const distinct = [];
      for (const cell of cells) if (distinct.every(other => differs(cell, other, false) && differs(cell, other, true))) distinct.push(cell);
      // A few held poses are allowed; repeating four pictures into sixteen slots is not.
      if (distinct.length < 12) throw invalid();
      return;
    }
    for (let row = 0; row < 4; row++) {
      let hasPoseChange = false;
      for (let a = 0; a < 4 && !hasPoseChange; a++) for (let b = a + 1; b < 4; b++) {
        const first = cells[row * 4 + a], second = cells[row * 4 + b];
        if (differs(first, second, false) && differs(first, second, true)) { hasPoseChange = true; break; }
      }
      // Holds are useful for blinking/breathing, but every behavior needs an actual pose change.
      if (!hasPoseChange) throw invalid();
    }
  }
  async function validatePage(imageURL, options = {}) {
    if (typeof imageURL !== 'string' || !asset.test(imageURL) || !root.document || typeof root.Image !== 'function') throw invalid();
    return validateImage(imageURL, options.version === undefined ? 1 : options.version);
  }
  async function validateBlob(blob, options = {}) {
    if (!(blob instanceof root.Blob) || blob.type !== 'image/png' || blob.size > 12 * 1024 * 1024) throw invalid();
    const url = root.URL.createObjectURL(blob);
    try { return await validateImage(url, options.version === undefined ? 1 : options.version); } finally { root.URL.revokeObjectURL(url); }
  }
  async function validateImage(imageURL, version) {
    if (![1, 2].includes(version)) throw invalid();
    const image = new root.Image();
    try {
      await new Promise((resolve, reject) => {
        const timer = root.setTimeout(() => { image.onload = image.onerror = null; image.src = ''; reject(invalid()); }, 20000);
        image.onload = () => { root.clearTimeout(timer); image.onload = image.onerror = null; resolve(); };
        image.onerror = () => { root.clearTimeout(timer); image.onload = image.onerror = null; reject(invalid()); };
        image.src = imageURL;
      });
      if (typeof image.decode === 'function') await image.decode();
      const width = image.naturalWidth, height = image.naturalHeight;
      if (!Number.isFinite(width) || !Number.isFinite(height) || Math.min(width, height) < 768 || Math.max(width, height) > 4096 || Math.abs(width - height) / Math.max(width, height) > .01) throw invalid();
      inspectPixels(sheetPixels(image), 768, version);
      return { width, height, columns: 4, rows: 4, frames: 16 };
    } catch { throw invalid(); }
  }
  return { normalize, actions, clips, denseClips, create, createPage, validatePage, validateBlob };
});
