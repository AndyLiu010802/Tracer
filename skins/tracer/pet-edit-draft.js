(function (root, factory) {
  const common = typeof module === 'object' && module.exports;
  const api = factory(root, common ? require('./pet-model') : root.TracerPetModel, common ? require('./pet-animation') : root.TracerPetAnimation);
  if (common) module.exports = api;
  else root.TracerPetEditDraft = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root, Model, Animation) {
  'use strict';
  const imageLimit = 12 * 1024 * 1024, photoLimit = 4 * 1024 * 1024;
  const failure = code => new Error(code);
  function abortError() { const error = new Error('pet-edit-aborted'); error.name = 'AbortError'; return error; }
  function check(signal) { if (signal?.aborted) throw abortError(); }
  function release(image) { try { image?.close?.(); } catch {} }
  function abortable(operation, signal, lateValue) {
    if (!signal) return Promise.resolve(operation);
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => { if (settled) return; settled = true; signal.removeEventListener('abort', cancel); callback(value); };
      const cancel = () => finish(reject, abortError());
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
      Promise.resolve(operation).then(value => {
        if (settled) { lateValue?.(value); return; }
        finish(resolve, value);
      }, error => finish(reject, error));
    });
  }
  function profile(raw) {
    const value = Model?.customProfile(raw);
    if (!value) throw failure('invalid-custom');
    return value;
  }
  async function hash(bytes) {
    if (!root.crypto?.subtle) throw failure('pet-edit-unavailable');
    const result = await root.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  async function signature(raw) {
    const value = profile(raw);
    // customProfile normalizes both field order and animation metadata, including
    // omitted versus explicitly all-16 retainedFrames. Care state is not artwork.
    return hash(new root.TextEncoder().encode(JSON.stringify(value)));
  }
  function loadImage(url, { signal } = {}) {
    check(signal);
    if (typeof root.Image !== 'function') return Promise.reject(failure('pet-edit-unavailable'));
    return new Promise((resolve, reject) => {
      const image = new root.Image();
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true; root.clearTimeout(timer); signal?.removeEventListener('abort', cancel);
        image.onload = image.onerror = null;
        if (error) { image.removeAttribute?.('src'); reject(error); }
        else resolve(image);
      };
      const cancel = () => finish(abortError());
      const timer = root.setTimeout(() => finish(failure('pet-art-missing')), 20000);
      image.onload = () => finish(); image.onerror = () => finish(failure('pet-art-missing'));
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) { cancel(); return; }
      image.decoding = 'async'; image.src = url;
    });
  }
  function dimensions(image, animated, version = 1) {
    const width = image?.naturalWidth === undefined ? image?.width : image.naturalWidth;
    const height = image?.naturalHeight === undefined ? image?.height : image.naturalHeight;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 16777216 ||
        (animated && (Math.min(width, height) < 768 || Math.max(width, height) > 4096 || Math.abs(width - height*(version===3?2:1)) / width > .01))) throw failure('invalid-animation-image');
    return { width, height };
  }
  function canvas(width, height, options) {
    const value = options.createCanvas ? options.createCanvas(width, height) : root.document?.createElement('canvas');
    if (!value) throw failure('pet-edit-unavailable');
    value.width = width; value.height = height;
    const context = value.getContext('2d');
    if (!context) throw failure('pet-edit-unavailable');
    context.imageSmoothingEnabled = false;
    return { value, context };
  }
  function encoded(value, limit = imageLimit) {
    const url = value.toDataURL('image/png');
    const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
    if (!match || match[1].length % 4 || match[1].length > Math.ceil(limit / 3) * 4) throw failure('pet-photo-too-large');
    const binary = root.atob(match[1]);
    if (binary.length > limit) throw failure('pet-photo-too-large');
    if (!binary.startsWith('\x89PNG\r\n\x1a\n')) throw failure('invalid-animation-image');
    return { url, data: match[1], bytes: Uint8Array.from(binary, value => value.charCodeAt(0)) };
  }
  function drawCell(context, image, source, target, insets = [0, 0, 0, 0]) {
    const [top, right, bottom, left] = insets, width = 1 - left - right, height = 1 - top - bottom;
    // Clear the same border strips as the existing renderer by leaving them
    // transparent. Offset the destination too: never stretch a clipped fragment
    // back across the full frame or move its subject within that frame.
    context.drawImage(image, source.x + source.width * left, source.y + source.height * top, source.width * width, source.height * height,
      target.x + target.width * left, target.y + target.height * top, target.width * width, target.height * height);
  }
  function reference(image, size, animated, options, insets, version = 1) {
    const width = size.width / (animated ? version===3?8:4 : 1), height = size.height / (animated ? 4 : 1);
    // This is a fresh screenshot of the existing first pose, never the user's
    // original upload or metadata embedded in its PNG.
    for (const edge of [1024, 768]) {
      const scale = Math.min(1, edge / Math.max(width, height));
      const { value, context } = canvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)), options);
      try {
        drawCell(context, image, { x: 0, y: 0, width, height }, { x: 0, y: 0, width: value.width, height: value.height }, insets);
        return encoded(value, photoLimit).url;
      } catch (error) {
        if (edge !== 1024 || error.message !== 'pet-photo-too-large') throw error;
      } finally { value.width = value.height = 1; }
    }
    throw failure('pet-photo-too-large');
  }
  function actionSheet(image, size, row, retainedFrames, options, insets) {
    const width = size.width / (retainedFrames === 4 ? 4 : 1), height = size.height / (retainedFrames === 4 ? 4 : 1);
    const longest = Math.max(width, height), margin = Math.max(3, Math.ceil(longest * .02));
    const cell = Math.min(1024, Math.max(192, Math.ceil(longest) + margin * 2));
    const inset = Math.max(3, Math.ceil(cell * .02)), available = cell - inset * 2;
    const scale = available / longest, targetWidth = width * scale, targetHeight = height * scale;
    const { value, context } = canvas(cell * 4, cell * 4, options);
    try {
      for (let frame = 0; frame < 16; frame++) {
        const original = retainedFrames === 4 ? Math.floor(frame / 4) : 0;
        const left = (frame % 4) * cell + (cell - targetWidth) / 2;
        const top = Math.floor(frame / 4) * cell + (cell - targetHeight) / 2;
        drawCell(context, image, { x: original * width, y: row * height, width, height },
          { x: left, y: top, width: targetWidth, height: targetHeight }, insets?.[row * 4 + original]);
      }
      return encoded(value);
    } finally { value.width = value.height = 1; }
  }
  async function storePackage(pack, { signal } = {}) {
    const response = await root.fetch('/api/pet-package/import', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-tracer-pet': '1' },
      body: JSON.stringify(pack), signal
    });
    const result = await response.json();
    if (!response.ok) throw failure(result.error || 'pet-package-save-failed');
    return result;
  }
  async function prepare(raw, options = {}) {
    const original = profile(raw), signal = options.signal, animated = !!original.animation;
    check(signal);
    const read = options.loadImage || loadImage, save = options.storePackage || storePackage;
    const validate = options.validateSheet || ((blob, settings) => Animation.validateBlob(blob, settings));
    let current;
    async function imageFor(url) {
      check(signal);
      if (current?.url === url) return current;
      release(current?.image); current = null;
      const image = await abortable(Promise.resolve().then(() => { check(signal); return read(url, { signal }); }), signal, release);
      try {
        check(signal);
        const size = dimensions(image, animated, original.animation?.version);
        const insets = animated ? (options.frameInsetsForImage || Animation.frameInsetsForImage)(image, original.animation?.version) : undefined;
        if (insets !== undefined && (!Array.isArray(insets) || insets.length !== (original.animation?.version===3?32:16) || !insets.every(value =>
          Array.isArray(value) && value.length === 4 && value.every(part => Number.isFinite(part) && part >= 0 && part < 1) && value[0] + value[2] < 1 && value[1] + value[3] < 1))) throw failure('invalid-animation-image');
        current = { url, image, size, insets }; return current;
      }
      catch (error) { release(image); throw error; }
    }
    try {
      const first = await imageFor(original.image);
      const photo = reference(first.image, first.size, animated, options, first.insets?.[0], original.animation?.version);
      check(signal);
      if (original.animation?.version >= 2) {
        const pages = original.animation.pages.slice();
        return { photo, animationVersion: original.animation.version, pages, generationIdentity: pages[0], retainedFrames: original.animation.retainedFrames?.slice() || Array(16).fill(original.animation.version===3?32:16) };
      }
      const retained = animated ? 4 : 1, retainedFrames = Array(16).fill(retained), images = [];
      let portrait;
      for (let action = 0; action < 16; action++) {
        check(signal);
        let item = portrait;
        if (!item) {
          const page = animated ? Math.floor(action / 4) : 0;
          // Three-page legacy packs already fall back to idle for newer actions.
          const availablePage = animated && original.animation.pages[page] ? page : 0;
          const source = await imageFor(animated ? original.animation.pages[availablePage] : original.image);
          const row = animated && page === availablePage ? action % 4 : 0;
          const sheet = actionSheet(source.image, source.size, row, retained, options, source.insets);
          const blob = new root.Blob([sheet.bytes], { type: 'image/png' });
          await abortable(Promise.resolve().then(() => { check(signal); return validate(blob, { version: 2, retainedFrames: retained, signal }); }), signal);
          check(signal);
          item = { sha256: await hash(sheet.bytes), data: sheet.data };
          if (!animated) portrait = item;
        }
        images.push({ ...item });
      }
      check(signal);
      const pack = { format: 'tracer-companion', version: 2,
        companion: { name: original.name, kind: original.kind, personality: original.personality },
        artwork: { layout: 'atlas-4x4', animationVersion: 2, retainedFrames, images } };
      const stored = await abortable(Promise.resolve().then(() => { check(signal); return save(pack, { signal }); }), signal);
      check(signal);
      const result = Animation.normalize(stored?.animation);
      if (!result || result.version !== 2 || stored.image !== result.pages[0] || !result.retainedFrames || result.retainedFrames.some(value => value !== retained)) throw failure('invalid-animation-response');
      const pages = result.pages.slice();
      // The package importer creates its own identity. The caller deliberately
      // keeps the original companion ID and only adopts these new local assets.
      return { photo, animationVersion: 2, pages, generationIdentity: pages[0], retainedFrames: result.retainedFrames.slice() };
    } finally { release(current?.image); }
  }
  return { signature, prepare };
});
