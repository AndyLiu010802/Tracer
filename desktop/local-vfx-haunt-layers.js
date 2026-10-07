(function (root, factory) {
  'use strict';
  const fallbackSample = typeof module === 'object' && module.exports
    ? require('./local-vfx-haunt-v2.js').sample : root.TracerLocalVfxHauntV2?.sample;
  const api = factory(fallbackSample);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerLocalVfxHauntLayers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (fallbackSample) {
  'use strict';

  // Preparation for reviewed, original transparent artwork. This module contains
  // no character artwork and does not load files, start a clock, or own a RAF.
  const SIDE = 1024, STRIPS = 16;
  const REQUIRED = ['head', 'eye-left', 'eye-right', 'tendril-1', 'tendril-2', 'tendril-3', 'tendril-4'];
  const OPTIONAL = ['smoke-back', 'smoke-mid', 'smoke-front'];
  const IDS = new Set([...REQUIRED, ...OPTIONAL]);
  const fail = code => { throw new TypeError('haunt-layer-manifest-invalid:' + code); };

  function record(value, keys, code) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code);
    const proto = Object.getPrototypeOf(value);
    if (proto && Object.getPrototypeOf(proto) !== null) fail(code);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !keys.includes(key)) fail(code);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail(code);
    }
    if (keys.some(key => !Object.hasOwn(value, key))) fail(code);
    return value;
  }

  function anchor(value, code) {
    record(value, ['x', 'y'], code);
    if (![value.x, value.y].every(n => Number.isFinite(n) && n >= 0 && n <= SIDE)) fail(code);
    return Object.freeze({ x: value.x, y: value.y });
  }

  function validateManifest(input) {
    record(input, ['version', 'character', 'bundleId', 'canvas', 'anchors', 'headSpanPx', 'layers'], 'structure');
    if (input.version !== 1 || input.character !== 'haunt-reference-remake') fail('identity');
    if (typeof input.bundleId !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,47}$/.test(input.bundleId)) fail('bundle');
    record(input.canvas, ['width', 'height'], 'canvas');
    if (input.canvas.width !== SIDE || input.canvas.height !== SIDE) fail('canvas');
    record(input.anchors, ['ground', 'head'], 'anchors');
    const ground = anchor(input.anchors.ground, 'ground'), head = anchor(input.anchors.head, 'head');
    // A shared vertical axis makes the caller's selected ground point invariant.
    if (ground.x !== head.x || ground.y - head.y < 64) fail('anchor-axis');
    if (!Number.isFinite(input.headSpanPx) || input.headSpanPx < 64 || input.headSpanPx > 768) fail('head-span');
    if (!Array.isArray(input.layers) || input.layers.length < REQUIRED.length || input.layers.length > IDS.size) fail('layers');
    const ids = new Set(), paths = new Set(), layers = [];
    const prefix = 'skins/tracer/local-vfx/haunt-art/' + input.bundleId + '/';
    for (let i = 0; i < input.layers.length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(input.layers, String(i));
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('layer-array');
      const item = record(descriptor.value, ['id', 'src'], 'layer');
      if (!IDS.has(item.id) || ids.has(item.id)) fail('layer-id');
      if (typeof item.src !== 'string' || !item.src.startsWith(prefix)
        || !/^[a-z0-9][a-z0-9_-]{0,95}\.png$/.test(item.src.slice(prefix.length)) || paths.has(item.src)) fail('layer-path');
      ids.add(item.id); paths.add(item.src);
      layers.push(Object.freeze({ id: item.id, src: item.src }));
    }
    if (REQUIRED.some(id => !ids.has(id))) fail('required-layer');
    return Object.freeze({ version: 1, character: input.character, bundleId: input.bundleId,
      canvas: Object.freeze({ width: SIDE, height: SIDE }), anchors: Object.freeze({ ground, head }),
      headSpanPx: input.headSpanPx, layers: Object.freeze(layers) });
  }

  function validFrame(frame) {
    if (!frame || typeof frame !== 'object' || !frame.foot || !frame.center
      || ![frame.elapsed, frame.size, frame.scale, frame.alpha, frame.eye,
        frame.foot.x, frame.foot.y, frame.center.x, frame.center.y].every(Number.isFinite)
      || frame.size <= 0 || frame.scale <= 0 || frame.alpha < 0 || frame.alpha > 1
      || frame.eye < 0 || frame.eye > 1 || Math.abs(frame.center.x - frame.foot.x) > 0.000001) {
      throw new TypeError('haunt-layer-frame-invalid');
    }
    return frame;
  }

  // The newly supplied artwork has one continuous head/eyes/tendrils PNG, not
  // seven interchangeable parts. Prepare a separate numeric descriptor without
  // interpreting provenance URLs, CSS filter strings, or inventing pixel data.
  function validateCoreDescriptor(input) {
    record(input, ['version', 'character', 'bundleId', 'canvas', 'anchors', 'coreRegions', 'eyeMode', 'layers'], 'core-structure');
    if (input.version !== 1 || input.character !== 'haunt-reference-remake' || input.eyeMode !== 'intrinsic') fail('core-identity');
    if (typeof input.bundleId !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,47}$/.test(input.bundleId)) fail('bundle');
    record(input.canvas, ['width', 'height'], 'core-canvas');
    const side = input.canvas.width;
    if (!Number.isInteger(side) || side < 64 || side > 2048 || input.canvas.height !== side) fail('core-canvas');
    function point(value, code) {
      record(value, ['x', 'y'], code);
      if (![value.x, value.y].every(n => Number.isFinite(n) && n >= 0 && n <= side)) fail(code);
      return Object.freeze({ x: value.x, y: value.y });
    }
    function region(value, code) {
      record(value, ['x', 'y', 'width', 'height'], code);
      if (![value.x, value.y, value.width, value.height].every(Number.isFinite)
        || value.x < 0 || value.y < 0 || value.width < 1 || value.height < 1
        || value.x + value.width > side || value.y + value.height > side) fail(code);
      return Object.freeze({ x: value.x, y: value.y, width: value.width, height: value.height });
    }
    const within = (p, r) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
    record(input.anchors, ['ground', 'neck'], 'core-anchors');
    const ground = point(input.anchors.ground, 'core-ground'), neck = point(input.anchors.neck, 'core-neck');
    if (ground.y - neck.y < 1) fail('core-neck-order');
    record(input.coreRegions, ['head', 'tendrils'], 'core-regions');
    const head = region(input.coreRegions.head, 'core-head-region'), tendrils = region(input.coreRegions.tendrils, 'core-tendril-region');
    if (!within(neck, head) || !within(neck, tendrils) || !within(ground, tendrils)) fail('core-attachment');
    if (!Array.isArray(input.layers) || input.layers.length !== 4) fail('core-layers');
    const ids = new Set(), paths = new Set(), normalized = [];
    const prefix = 'skins/tracer/local-vfx/haunt-art/' + input.bundleId + '/';
    for (let i = 0; i < input.layers.length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(input.layers, String(i));
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('core-layer-array');
      const item = descriptor.value, idDescriptor = item && Object.getOwnPropertyDescriptor(item, 'id');
      if (!idDescriptor || !Object.hasOwn(idDescriptor, 'value')) fail('core-layer-id');
      const id = idDescriptor.value, core = id === 'core';
      record(item, core ? ['id', 'src'] : ['id', 'src', 'sourceAnchor', 'targetAnchor', 'scale', 'opacity', 'style'], 'core-layer');
      if ((!core && !OPTIONAL.includes(id)) || ids.has(id)) fail('core-layer-id');
      if (typeof item.src !== 'string' || !item.src.startsWith(prefix)
        || !/^[a-z0-9][a-z0-9_-]{0,95}\.png$/.test(item.src.slice(prefix.length)) || paths.has(item.src)) fail('layer-path');
      ids.add(id); paths.add(item.src);
      if (core) { normalized.push(Object.freeze({ id, src: item.src })); continue; }
      const sourceAnchor = point(item.sourceAnchor, 'smoke-source-anchor'), targetAnchor = point(item.targetAnchor, 'smoke-target-anchor');
      if (targetAnchor.x !== ground.x || targetAnchor.y !== ground.y) fail('smoke-ground-anchor');
      record(item.scale, ['x', 'y'], 'smoke-scale');
      if (![item.scale.x, item.scale.y].every(n => Number.isFinite(n) && n >= 0.05 && n <= 2)) fail('smoke-scale');
      if (!Number.isFinite(item.opacity) || item.opacity < 0 || item.opacity > 1) fail('smoke-opacity');
      record(item.style, ['grayscale', 'brightness', 'blurPx'], 'smoke-style');
      if (![item.style.grayscale, item.style.brightness].every(n => Number.isFinite(n) && n >= 0 && n <= 1)
        || !Number.isFinite(item.style.blurPx) || item.style.blurPx < 0 || item.style.blurPx > 6) fail('smoke-style');
      normalized.push(Object.freeze({ id, src: item.src, sourceAnchor, targetAnchor,
        scale: Object.freeze({ x: item.scale.x, y: item.scale.y }), opacity: item.opacity,
        style: Object.freeze({ grayscale: item.style.grayscale, brightness: item.style.brightness, blurPx: item.style.blurPx }) }));
    }
    if (!ids.has('core') || OPTIONAL.some(id => !ids.has(id))) fail('core-required-layer');
    return Object.freeze({ version: 1, character: input.character, bundleId: input.bundleId,
      canvas: Object.freeze({ width: side, height: side }), anchors: Object.freeze({ ground, neck }),
      coreRegions: Object.freeze({ head, tendrils }), eyeMode: 'intrinsic', layers: Object.freeze(normalized) });
  }

  function mapCoreRig(input, frame) {
    const descriptor = validateCoreDescriptor(input);
    validFrame(frame);
    if (!Number.isFinite(frame.rise) || frame.rise < 0 || frame.rise > 1) throw new TypeError('haunt-layer-frame-invalid');
    const { ground, neck } = descriptor.anchors, sourceHead = descriptor.coreRegions.head;
    // Logical rise changes only vertical placement. Keep the original image's
    // relative X offsets (neck/head do not share the ground's source X).
    const scale = frame.size / sourceHead.width, shift = (ground.y - neck.y) * (1 - frame.rise);
    const neckY = frame.foot.y + (neck.y + shift - ground.y) * scale;
    const mapPoint = (x, y) => {
      if (![x, y].every(n => Number.isFinite(n) && n >= 0 && n <= descriptor.canvas.width)) throw new TypeError('haunt-core-point-invalid');
      const mappedY = y <= neck.y ? frame.foot.y + (y + shift - ground.y) * scale
        : y >= ground.y ? frame.foot.y + (y - ground.y) * scale
          : neckY + (y - neck.y) * frame.rise * scale;
      return Object.freeze({ x: frame.foot.x + (x - ground.x) * scale, y: mappedY });
    };
    const mapSmokePoint = (id, x, y) => {
      if (![x, y].every(n => Number.isFinite(n) && n >= 0 && n <= descriptor.canvas.width)) throw new TypeError('haunt-core-point-invalid');
      const layer = descriptor.layers.find(item => item.id === id);
      if (!layer || id === 'core') throw new TypeError('haunt-core-smoke-id-invalid');
      return Object.freeze({ x: frame.foot.x + (x - layer.sourceAnchor.x) * layer.scale.x * scale,
        y: frame.foot.y + (y - layer.sourceAnchor.y) * layer.scale.y * scale });
    };
    return Object.freeze({ scale, rise: frame.rise, opacity: frame.alpha, finished: !!frame.finished,
      ground: Object.freeze({ x: frame.foot.x, y: frame.foot.y }), neck: mapPoint(neck.x, neck.y),
      headCenter: mapPoint(sourceHead.x + sourceHead.width / 2, sourceHead.y + sourceHead.height / 2),
      mapPoint, mapSmokePoint, textureContainsEyes: true, renderedPixelsVerified: false });
  }

  function create(options = {}) {
    const sample = options.sample || fallbackSample;
    if (typeof sample !== 'function') throw new TypeError('haunt-layer-sample-required');
    if (typeof options.loadImage !== 'function') throw new TypeError('haunt-layer-loader-required');
    let destroyed = false, token = 0, active = null, tile = null, tileContext = null;
    let allocations = 0, renders = 0, composites = 0, headWrites = 0, lastLoadError = null, closeFailures = 0;
    let cachedHeadImages = null, cachedEye = -1;
    const pending = new Set(), seenSources = new WeakSet();

    function releaseImage(owned) {
      if (!owned || owned.closed) return;
      owned.closed = true;
      const source = owned.source; owned.source = null;
      try { if (typeof source?.close === 'function') source.close(); } catch (_) { closeFailures++; }
    }
    function releaseBundle(bundle) {
      if (!bundle) return;
      for (const image of bundle.images.values()) releaseImage(image);
      bundle.images.clear();
    }
    function releaseTransaction(transaction) {
      transaction.cancelled = true;
      for (const image of transaction.images.values()) releaseImage(image);
      transaction.images.clear();
    }
    function invalidatePending() {
      for (const transaction of pending) { releaseTransaction(transaction); pending.delete(transaction); }
    }

    async function load(input) {
      if (destroyed) return Object.freeze({ status: 'disposed', token });
      const manifest = validateManifest(input);
      const request = ++token;
      invalidatePending();
      const transaction = { token: request, cancelled: false, images: new Map() };
      pending.add(transaction); lastLoadError = null;
      const status = () => destroyed ? 'disposed' : request !== token ? 'superseded' : 'failed';
      try {
        await Promise.all(manifest.layers.map(async layer => {
          const source = await options.loadImage(layer.src, Object.freeze({ bundleId: manifest.bundleId, layerId: layer.id }));
          if (!source || typeof source !== 'object') throw new TypeError('haunt-layer-image-invalid');
          // The loader transfers exclusive ownership. Reusing an existing bitmap
          // would make a rejected/new bundle destroy a currently displayed one.
          if (seenSources.has(source)) throw new TypeError('haunt-layer-image-reused');
          seenSources.add(source);
          const owned = { source, closed: false };
          if (transaction.cancelled || destroyed || request !== token) { releaseImage(owned); return; }
          // Register ownership before reading an injected source's dimensions:
          // failing getters must be covered by transaction rollback too.
          transaction.images.set(layer.id, owned);
          const width = source.naturalWidth ?? source.width, height = source.naturalHeight ?? source.height;
          if (width !== SIDE || height !== SIDE) { releaseImage(owned); throw new TypeError('haunt-layer-image-size'); }
        }));
        if (transaction.cancelled || destroyed || request !== token) {
          releaseTransaction(transaction); return Object.freeze({ status: status(), token: request });
        }
        const previous = active;
        active = { manifest, images: transaction.images };
        transaction.images = new Map();
        releaseBundle(previous);
        return Object.freeze({ status: 'ready', token: request, bundleId: manifest.bundleId });
      } catch (_) {
        releaseTransaction(transaction);
        if (!destroyed && request === token) lastLoadError = 'haunt-layer-load-failed';
        return Object.freeze({ status: status(), token: request, error: 'haunt-layer-load-failed' });
      } finally { pending.delete(transaction); }
    }

    function ensureTile() {
      if (tile) return;
      if (typeof options.createCanvas !== 'function') throw new TypeError('haunt-layer-canvas-required');
      let candidate;
      try {
        candidate = options.createCanvas();
        if (!candidate || typeof candidate.getContext !== 'function') throw new Error();
        candidate.width = SIDE; candidate.height = SIDE;
        const context = candidate.getContext('2d');
        if (!context || !['setTransform', 'clearRect', 'drawImage', 'save', 'restore'].every(name => typeof context[name] === 'function')) throw new Error();
        tile = candidate; tileContext = context; allocations++;
      } catch (_) {
        try { if (candidate) candidate.width = candidate.height = 1; } catch (_) { /* invalid injected canvas */ }
        throw new TypeError('haunt-layer-canvas-unavailable');
      }
    }

    function rig(frame, manifest) {
      const scale = frame.size * frame.scale / manifest.headSpanPx;
      const head = manifest.anchors.head, ground = manifest.anchors.ground;
      const mapY = y => y <= head.y ? frame.center.y + (y - head.y) * scale
        : y >= ground.y ? frame.foot.y + (y - ground.y) * scale
          : frame.center.y + (y - head.y) / (ground.y - head.y) * (frame.foot.y - frame.center.y);
      return { scale, head, ground, mapY, left: frame.foot.x - ground.x * scale, width: SIDE * scale };
    }

    function drawGround(ctx, image, frame, placement, opacity) {
      if (!image || opacity <= 0) return;
      ctx.save();
      try {
        ctx.globalAlpha = opacity;
        ctx.drawImage(image.source, placement.left, frame.foot.y - placement.ground.y * placement.scale,
          placement.width, SIDE * placement.scale);
      } finally { ctx.restore(); }
    }

    function drawTendril(ctx, image, frame, placement, index) {
      const boundaries = [0, placement.head.y];
      for (let i = 1; i <= STRIPS; i++) boundaries.push(placement.head.y + (placement.ground.y - placement.head.y) * i / STRIPS);
      boundaries.push(SIDE);
      ctx.save();
      try {
        ctx.globalAlpha = frame.alpha;
        const swayAt = y => {
          const q = (y - placement.head.y) / (placement.ground.y - placement.head.y);
          if (q <= 0 || q >= 1) return 0;
          return Math.sin(q * Math.PI) * Math.sin(frame.elapsed / 760 + index * 1.37)
            * frame.size * (frame.reducedMotion ? 0.004 : 0.018);
        };
        for (let i = 0; i + 1 < boundaries.length; i++) {
          const y = boundaries[i], end = boundaries[i + 1];
          if (end <= y) continue;
          const top = placement.mapY(y), bottom = placement.mapY(end);
          if (bottom <= top) continue;
          const topSway = swayAt(y), bottomSway = swayAt(end), shear = (bottomSway - topSway) / (bottom - top);
          // Shared endpoints keep neighboring PNG strips continuous; a constant
          // midpoint translation would introduce a visible stair step or gap.
          ctx.save();
          try {
            ctx.transform(1, 0, shear, 1, topSway - shear * top, 0);
            ctx.drawImage(image.source, 0, y, SIDE, end - y,
              placement.left, top, placement.width, bottom - top);
          } finally { ctx.restore(); }
        }
      } finally { ctx.restore(); }
    }

    function composeHead(ctx, images, frame, placement) {
      ensureTile();
      if (cachedHeadImages !== images || cachedEye !== frame.eye) {
        tileContext.save();
        try {
          tileContext.setTransform(1, 0, 0, 1, 0, 0); tileContext.clearRect(0, 0, SIDE, SIDE);
          tileContext.globalCompositeOperation = 'source-over'; tileContext.globalAlpha = 1;
          tileContext.drawImage(images.get('head').source, 0, 0, SIDE, SIDE);
          tileContext.globalAlpha = frame.eye;
          if (frame.eye > 0) for (const id of ['eye-left', 'eye-right']) tileContext.drawImage(images.get(id).source, 0, 0, SIDE, SIDE);
          cachedHeadImages = images; cachedEye = frame.eye; headWrites++;
        } finally { tileContext.restore(); }
      }
      ctx.save();
      try {
        ctx.globalAlpha = frame.alpha;
        ctx.drawImage(tile, frame.center.x - placement.head.x * placement.scale,
          frame.center.y - placement.head.y * placement.scale, placement.width, SIDE * placement.scale);
        composites++;
      } finally { ctx.restore(); }
    }

    function render(ctx, packet, elapsed) {
      if (!ctx || !['drawImage', 'save', 'restore', 'transform'].every(name => typeof ctx[name] === 'function')) throw new TypeError('haunt-layer-context-required');
      const frame = validFrame(sample(packet, elapsed));
      const layerStatus = destroyed ? 'destroyed' : active ? 'ready' : pending.size ? 'waiting' : lastLoadError ? 'failed' : 'empty';
      if (destroyed || !active || frame.finished || frame.alpha <= 0) return { ...frame, layerStatus, drawn: false, bundleId: active?.manifest.bundleId || null };
      // Validate lazy offscreen capability before drawing any destination layers.
      ensureTile();
      const { manifest, images } = active, placement = rig(frame, manifest);
      const smoke = frame.localSmoke !== false;
      if (smoke) drawGround(ctx, images.get('smoke-back'), frame, placement, frame.alpha * 0.55);
      for (let i = 1; i <= 4; i++) drawTendril(ctx, images.get('tendril-' + i), frame, placement, i);
      if (smoke) drawGround(ctx, images.get('smoke-mid'), frame, placement, frame.alpha * 0.45);
      composeHead(ctx, images, frame, placement);
      // Foreground artwork must be reviewed to leave the head/eyes clear. The
      // renderer does not crop legitimate painted smoke or invent missing pixels.
      if (smoke) drawGround(ctx, images.get('smoke-front'), frame, placement, frame.alpha * 0.35);
      renders++;
      return { ...frame, layerStatus, drawn: true, bundleId: manifest.bundleId };
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true; token++;
      invalidatePending(); releaseBundle(active); active = null;
      cachedHeadImages = null; cachedEye = -1;
      if (tile) { tile.width = tile.height = 1; tile = tileContext = null; }
    }
    function getDiagnostics() {
      return Object.freeze({ destroyed, token, pendingLoads: pending.size, activeBundle: active?.manifest.bundleId || null,
        ownedImages: active?.images.size || 0, decodedImageBytes: (active?.images.size || 0) * SIDE * SIDE * 4,
        pendingImageBytes: [...pending].reduce((bytes, transaction) => bytes + transaction.images.size * SIDE * SIDE * 4, 0),
        headTileCount: tile ? 1 : 0, headTileBytes: tile ? SIDE * SIDE * 4 : 0,
        allocations, renders, headComposites: composites, headWrites, lastLoadError, closeFailures });
    }
    return Object.freeze({ load, render, sample: (packet, elapsed) => validFrame(sample(packet, elapsed)), destroy, getDiagnostics });
  }

  return Object.freeze({ create, validateManifest, validateCoreDescriptor, mapCoreRig,
    metadata: Object.freeze({ version: 'haunt-png-layer-preparation-1',
    containsArtwork: false, canvasSide: SIDE, maxLayers: IDS.size, requiredLayers: Object.freeze([...REQUIRED]),
    maxHeadTileBytes: SIDE * SIDE * 4, maxDecodedBundleBytes: IDS.size * SIDE * SIDE * 4,
    maxOwnedBytesDuringReplacement: (IDS.size * 2 + 1) * SIDE * SIDE * 4,
    tendrilStrips: STRIPS, ownsRAF: false, ownsResourceLoading: false,
    localOnly: true, preservesSharedCanvas: true, continuousCoreDescriptorPrepared: true,
    continuousCoreRenderReady: false, coreMaxCanvasSide: 2048 }) });
});
