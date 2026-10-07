(function (root, factory) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./local-vfx-haunt-layers.js') : root.TracerLocalVfxHauntLayers,
    node ? require('./local-vfx-haunt-v2.js').sample : root.TracerLocalVfxHauntV2?.sample);
  if (node) module.exports = api;
  else root.TracerLocalVfxHauntTexture = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (descriptorApi, defaultSample) {
  'use strict';
  const STRIPS = 24, CROWN_STRIPS = 12, SMOKE_STRIPS = 8;
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const smooth = n => { n = clamp(n, 0, 1); return n * n * (3 - 2 * n); };
  const SMOKE = ['smoke-back', 'smoke-mid', 'smoke-front'];

  function create(options = {}) {
    const sample = options.sample || defaultSample;
    const schema = options.descriptorApi || descriptorApi;
    if (typeof sample !== 'function' || typeof schema?.validateCoreDescriptor !== 'function') throw new TypeError('haunt-texture-schema-required');
    if (typeof options.loadImage !== 'function' || typeof options.createCanvas !== 'function') throw new TypeError('haunt-texture-capability-required');
    let destroyed = false, token = 0, active = null, lastLoadError = null;
    let allocations = 0, smokePreparations = 0, coreWrites = 0, coreComposites = 0, renders = 0, closeFailures = 0, trackedBytesPeak = 0;
    const pending = new Set(), seen = new WeakSet(), seenCanvases = new WeakSet();

    function budget() {
      const canvases = active ? [...active.smoke.values(), ...(active.actor ? [active.actor] : [])] : [];
      const canvasBytes = canvases.reduce((sum, item) => sum + item.width * item.height * 4, 0);
      const decodedImageBytes = active?.core ? active.descriptor.canvas.width ** 2 * 4 : 0;
      let pendingImageBytes = 0, pendingCanvasBytes = 0;
      for (const transaction of pending) {
        pendingImageBytes += transaction.images.size * transaction.side ** 2 * 4;
        pendingCanvasBytes += [...transaction.surfaces].reduce((sum, item) => sum + item.width * item.height * 4, 0);
      }
      const total = canvasBytes + decodedImageBytes + pendingImageBytes + pendingCanvasBytes;
      trackedBytesPeak = Math.max(trackedBytesPeak, total);
      return { canvasBytes, decodedImageBytes, pendingImageBytes, pendingCanvasBytes, trackedOwnedBytes: total };
    }

    function closeImage(owned) {
      if (!owned || owned.closed) return;
      owned.closed = true;
      const image = owned.image; owned.image = null;
      try { if (typeof image?.close === 'function') image.close(); } catch (_) { closeFailures++; }
    }
    function releaseCanvas(surface) {
      if (!surface || surface.released) return;
      surface.released = true;
      try { surface.canvas.width = surface.canvas.height = 1; } catch (_) { /* injected release failure */ }
      surface.canvas = surface.ctx = null;
    }
    function cancel(transaction) {
      transaction.cancelled = true;
      for (const image of transaction.images.values()) closeImage(image);
      for (const surface of transaction.surfaces) releaseCanvas(surface);
      transaction.images.clear(); transaction.surfaces.clear(); pending.delete(transaction);
    }
    function releaseBundle(bundle) {
      if (!bundle) return;
      closeImage(bundle.core);
      for (const surface of bundle.smoke.values()) releaseCanvas(surface);
      releaseCanvas(bundle.actor); bundle.smoke.clear(); bundle.actor = bundle.core = null;
    }
    function surface(width, height, transaction) {
      let canvas, owned = false;
      try {
        canvas = options.createCanvas();
        if (!canvas || typeof canvas !== 'object' || seenCanvases.has(canvas)) throw new Error();
        seenCanvases.add(canvas); owned = true;
        if (typeof canvas.getContext !== 'function') throw new Error();
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx || !['save', 'restore', 'setTransform', 'clearRect', 'drawImage', 'transform', 'createLinearGradient', 'beginPath', 'moveTo', 'bezierCurveTo', 'closePath', 'fill'].every(name => typeof ctx[name] === 'function')) throw new Error();
        const result = { canvas, ctx, width, height, released: false };
        allocations++; if (transaction) { transaction.surfaces.add(result); budget(); }
        return result;
      } catch (_) {
        try { if (owned) canvas.width = canvas.height = 1; } catch (_) { /* invalid factory */ }
        throw new TypeError('haunt-texture-canvas-unavailable');
      }
    }
    function prepareSmoke(layer, image, side, transaction) {
      const pad = Math.ceil(layer.style.blurPx * 3), result = surface(side + pad * 2, side + pad * 2, transaction);
      const ctx = result.ctx;
      if (typeof ctx.filter !== 'string') throw new TypeError('haunt-texture-filter-unavailable');
      ctx.save();
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, result.width, result.height);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        // Numbers were independently validated; no manifest CSS string executes.
        ctx.filter = 'grayscale(' + layer.style.grayscale + ') brightness(' + layer.style.brightness + ') blur(' + layer.style.blurPx + 'px)';
        ctx.drawImage(image.image, pad, pad, side, side);
      } finally { ctx.restore(); }
      result.pad = pad; result.layer = layer; smokePreparations++;
      closeImage(image); transaction.images.delete(layer.id);
      return result;
    }

    async function load(input) {
      if (destroyed) return Object.freeze({ status: 'disposed', token });
      const descriptor = schema.validateCoreDescriptor(input), request = ++token;
      for (const old of pending) cancel(old);
      const transaction = { images: new Map(), surfaces: new Set(), side: descriptor.canvas.width, cancelled: false };
      pending.add(transaction); lastLoadError = null;
      const resultStatus = () => destroyed ? 'disposed' : request !== token ? 'superseded' : 'failed';
      try {
        await Promise.all(descriptor.layers.map(async layer => {
          const image = await options.loadImage(layer.src, Object.freeze({ bundleId: descriptor.bundleId, layerId: layer.id }));
          if (!image || typeof image !== 'object') throw new TypeError('haunt-texture-image-invalid');
          if (seen.has(image)) throw new TypeError('haunt-texture-image-reused');
          seen.add(image);
          const owned = { image, closed: false };
          if (transaction.cancelled || destroyed || request !== token) { closeImage(owned); return; }
          transaction.images.set(layer.id, owned);
          budget();
          if ((image.naturalWidth ?? image.width) !== descriptor.canvas.width
            || (image.naturalHeight ?? image.height) !== descriptor.canvas.height) throw new TypeError('haunt-texture-image-size');
        }));
        if (transaction.cancelled || destroyed || request !== token) {
          cancel(transaction); return Object.freeze({ status: resultStatus(), token: request });
        }
        const smoke = new Map();
        for (const id of SMOKE) {
          const layer = descriptor.layers.find(item => item.id === id);
          smoke.set(id, prepareSmoke(layer, transaction.images.get(id), descriptor.canvas.width, transaction));
        }
        if (transaction.cancelled || destroyed || request !== token) {
          cancel(transaction); return Object.freeze({ status: resultStatus(), token: request });
        }
        const previous = active;
        active = { descriptor, core: transaction.images.get('core'), smoke, actor: null, poseKey: null };
        transaction.images = new Map(); transaction.surfaces = new Set();
        releaseBundle(previous);
        return Object.freeze({ status: 'ready', token: request, bundleId: descriptor.bundleId });
      } catch (_) {
        cancel(transaction);
        if (!destroyed && request === token) lastLoadError = 'haunt-texture-load-failed';
        return Object.freeze({ status: resultStatus(), token: request, error: 'haunt-texture-load-failed' });
      } finally { pending.delete(transaction); }
    }

    function validateFrame(frame) {
      if (!frame || !frame.foot || ![frame.elapsed, frame.size, frame.rise, frame.alpha, frame.foot.x, frame.foot.y].every(Number.isFinite)
        || frame.elapsed < 0 || frame.elapsed > 7000 || frame.size <= 0 || frame.rise < 0 || frame.rise > 1 || frame.alpha < 0 || frame.alpha > 1) throw new TypeError('haunt-texture-frame-invalid');
      return frame;
    }
    function shadeCrown(ctx, pose, mapY, padX, padY) {
      // Broad filled troughs split the rounded shell into organic volumes.
      // source-atop keeps the original silhouette and intrinsic eye pixels;
      // the shading is part of the one opaque actor, never a second face.
      const mapX = x => padX + pose.ground.x * (1 - pose.breath) + x * pose.breath;
      const yy = y => mapY(y) + padY;
      ctx.save();
      try {
        ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = 1; ctx.filter = 'blur(9px)';
        for (const [left, right, bend] of [[531, 584, 18], [670, 723, -20]]) {
          const fill = ctx.createLinearGradient(mapX(left - 18), 0, mapX(right + 18), 0);
          fill.addColorStop(0, 'rgba(22,46,91,0)');
          fill.addColorStop(0.35, 'rgba(27,59,113,0.20)');
          fill.addColorStop(0.64, 'rgba(1,5,18,0.28)');
          fill.addColorStop(1, 'rgba(8,20,44,0)');
          ctx.fillStyle = fill; ctx.beginPath();
          ctx.moveTo(mapX(left - 18), yy(207));
          ctx.bezierCurveTo(mapX(left + bend), yy(249), mapX(left + bend + 18), yy(306), mapX(624), yy(377));
          ctx.bezierCurveTo(mapX(right + bend), yy(306), mapX(right), yy(246), mapX(right + 18), yy(207));
          ctx.closePath(); ctx.fill();
        }
      } finally { ctx.restore(); }
    }

    function writeActor(bundle, frame) {
      const { descriptor } = bundle, side = descriptor.canvas.width, { neck, ground } = descriptor.anchors;
      const reduced = !!frame.reducedMotion;
      const bend = reduced ? 0 : Math.sin(frame.elapsed / 980) * 23;
      const curl = reduced ? 0 : Math.sin(frame.elapsed / 1320 + 0.7) * 14;
      const breath = reduced ? 1 : 1 + Math.sin(frame.elapsed / 1850) * 0.008;
      const drift = reduced ? 0 : (2 + Math.sin(frame.elapsed / 1650) * 2) * frame.rise;
      const sourceHeadY = descriptor.coreRegions.head.y + descriptor.coreRegions.head.height / 2;
      const shift = (ground.y - neck.y) * (1 - frame.rise);
      const neckY = Math.min(ground.y, neck.y + shift + ((neck.y - sourceHeadY) * (breath - 1) + drift) * frame.rise);
      const key = frame.rise.toFixed(7) + ':' + bend.toFixed(5) + ':' + curl.toFixed(5) + ':' + breath.toFixed(7) + ':' + drift.toFixed(5);
      const pose = { breath, drift, neckY, sourceHeadY, ground, neck };
      if (bundle.actor && bundle.poseKey === key) return pose;
      if (!bundle.actor) {
        const padX = Math.ceil(side * 0.01 + 12), padY = Math.ceil(side * 0.01 + 4);
        bundle.actor = surface(side + padX * 2, side + padY * 2); bundle.actor.padX = padX; bundle.actor.padY = padY; budget();
      }
      const ctx = bundle.actor.ctx, { padX, padY } = bundle.actor;
      // A monotone swept profile bends and shortens the painted projections.
      // All source rows remain present; unseen crown folds are not fabricated.
      const crownHinge = descriptor.coreRegions.head.y + descriptor.coreRegions.head.height * 0.378;
      const crownMap = y => {
        if (y >= crownHinge) return y;
        const distance = crownHinge - y;
        return crownHinge - distance * (0.46 - 0.20 * distance / crownHinge);
      };
      const mapY = y => y <= neck.y ? neckY + (crownMap(y) - neck.y) * breath
        : y >= ground.y ? y : neckY + (y - neck.y) / (ground.y - neck.y) * (ground.y - neckY);
      const sway = y => {
        const q = (y - neck.y) / (ground.y - neck.y);
        return q <= 0 || q >= 1 ? 0 : Math.sin(Math.PI * q)
          * (bend * (0.65 + 0.35 * Math.sin(Math.PI * q)) + curl * Math.sin(q * Math.PI * 2.2)) * frame.rise;
      };
      const boundaries = [0, ...Array.from({ length: CROWN_STRIPS }, (_, i) => crownHinge * (i + 1) / CROWN_STRIPS), neck.y];
      for (let i = 1; i <= STRIPS; i++) boundaries.push(neck.y + (ground.y - neck.y) * i / STRIPS);
      boundaries.push(side);
      // A failed overwrite must never keep the previous pose's cache key while
      // the canvas already contains a cleared/partially painted new pose.
      bundle.poseKey = null;
      ctx.save();
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, bundle.actor.width, bundle.actor.height);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
        for (let i = 0; i + 1 < boundaries.length; i++) {
          // Adjacent strips share integer destination scanlines. Fractional
          // coverage makes Canvas source-over blend or miss translucent edges
          // twice even when their analytic coordinates are identical.
          const y = boundaries[i], end = boundaries[i + 1], top = Math.round(mapY(y) + padY), bottom = Math.round(mapY(end) + padY);
          if (end <= y || bottom <= top) continue;
          const topX = sway(y), bottomX = sway(end), shear = (bottomX - topX) / (bottom - top);
          ctx.save();
          try {
            ctx.transform(breath, 0, shear, 1, padX + ground.x * (1 - breath) + topX - shear * top, 0);
            ctx.drawImage(bundle.core.image, 0, y, side, end - y, 0, top, side, bottom - top);
          } finally { ctx.restore(); }
        }
        shadeCrown(ctx, pose, mapY, padX, padY);
        bundle.poseKey = key; coreWrites++;
      } finally { ctx.restore(); }
      return pose;
    }

    function drawSmoke(ctx, bundle, frame, id, depthWeight = 1, lobe = 0) {
      if (frame.localSmoke === false || frame.finished || depthWeight <= 0) return;
      const envelope = smooth(frame.elapsed / 650) * (1 - smooth((frame.elapsed - 6000) / 1000));
      if (envelope <= 0) return;
      const texture = bundle.smoke.get(id), layer = texture.layer, index = SMOKE.indexOf(id);
      const phase = index * 1.81 + lobe * 1.29, reduced = !!frame.reducedMotion;
      const rollPeriod = [1180, 980, 1740][index] * (lobe ? 1.43 : 1), rollAmplitude = [19, 38, 11][index];
      const breatheX = reduced ? 1 : 1 + Math.sin(frame.elapsed / rollPeriod + phase) * [0.026, 0.045, 0.016][index];
      const breatheY = reduced ? 1 : 1 + Math.cos(frame.elapsed / (rollPeriod * 1.23) + phase) * [0.038, 0.066, 0.02][index];
      const driftOpacity = reduced ? 1 : 0.97 + Math.sin(frame.elapsed / (rollPeriod * 1.67) + phase) * 0.03;
      const scale = frame.size / bundle.descriptor.coreRegions.head.width;
      const sx = scale * layer.scale.x * breatheX * (lobe === 2 ? 1.10 : lobe ? 1.18 : 1), sy = scale * layer.scale.y * breatheY * (lobe === 2 ? 0.40 : lobe ? 0.76 : 1);
      const pivotX = layer.sourceAnchor.x + texture.pad, pivotY = layer.sourceAnchor.y + texture.pad;
      const leftAt = x => frame.foot.x + (x - pivotX) * sx;
      const offsetAt = x => reduced ? 0 : Math.sin((x - pivotX) / texture.width * Math.PI)
        * Math.sin(frame.elapsed / rollPeriod + phase + x / texture.width * 3.8) * sy * rollAmplitude;
      const boundaries = [...new Set([0, ...Array.from({ length: SMOKE_STRIPS - 1 }, (_, i) => texture.width * (i + 1) / SMOKE_STRIPS), pivotX, texture.width])].sort((a, b) => a - b);
      ctx.save();
      try {
        ctx.globalAlpha = layer.opacity * envelope * driftOpacity * depthWeight * (lobe === 2 ? 0.68 : lobe ? 0.46 : 1);
        const top = frame.foot.y - pivotY * sy;
        for (let i = 0; i + 1 < boundaries.length; i++) {
          const x = boundaries[i], end = boundaries[i + 1], left = leftAt(x), right = leftAt(end);
          const offset = offsetAt(x), endOffset = offsetAt(end), shear = (endOffset - offset) / (right - left);
          ctx.save();
          try {
            ctx.transform(1, shear, 0, 1, 0, offset - shear * left);
            ctx.drawImage(texture.canvas, x, 0, end - x, texture.height,
              left, top, right - left, texture.height * sy);
          } finally { ctx.restore(); }
        }
      } finally { ctx.restore(); }
    }
    function render(ctx, packet, elapsed) {
      if (!ctx || !['save', 'restore', 'drawImage', 'transform'].every(name => typeof ctx[name] === 'function')) throw new TypeError('haunt-texture-context-required');
      const frame = validateFrame(sample(packet, elapsed));
      const assetStatus = destroyed ? 'destroyed' : active ? 'ready' : pending.size ? 'waiting' : lastLoadError ? 'failed' : 'empty';
      if (destroyed || !active || frame.finished) return { ...frame, assetStatus, layerStatus: assetStatus, drawn: false, bundleId: active?.descriptor.bundleId || null };
      const bundle = active, scale = frame.size / bundle.descriptor.coreRegions.head.width, ground = bundle.descriptor.anchors.ground;
      const pose = frame.alpha > 0 ? writeActor(bundle, frame) : null;
      // The shell starts within the ground cloud. Keep that cloud behind the
      // bright paired eyes until the head clears it, then move its depth
      // contribution smoothly in front of the lower tendrils. No face mask or
      // source pixels are cut out, and the core itself is still composed once.
      const frontDepth = smooth((frame.rise - 0.16) / 0.30);
      drawSmoke(ctx, bundle, frame, 'smoke-back');
      // Two filled billow masses have distinct scale and phase, sharing the
      // source pivot and cached texture. The low broad mass occludes the base
      // of the tall mass before the actor is composed; neither covers the eyes.
      drawSmoke(ctx, bundle, frame, 'smoke-mid', 1, 1);
      drawSmoke(ctx, bundle, frame, 'smoke-mid');
      drawSmoke(ctx, bundle, frame, 'smoke-front', 1 - frontDepth);
      if (frame.alpha > 0) {
        ctx.save();
        try {
          ctx.globalAlpha = frame.alpha;
          ctx.drawImage(bundle.actor.canvas, frame.foot.x - (ground.x + bundle.actor.padX) * scale,
            frame.foot.y - (ground.y + bundle.actor.padY) * scale, bundle.actor.width * scale, bundle.actor.height * scale);
          coreComposites++;
        } finally { ctx.restore(); }
      }
      // A low rolling filled billow sits in front of the support. It shares
      // the exact ground pivot but has its own phase/height and depth weight.
      // The complete source is scaled, not cropped; its top stays below eyes.
      drawSmoke(ctx, bundle, frame, 'smoke-mid', frontDepth * 0.92, 2);
      drawSmoke(ctx, bundle, frame, 'smoke-front', frontDepth); renders++;
      return { ...frame, assetStatus, layerStatus: assetStatus, drawn: frame.alpha > 0 || (frame.localSmoke !== false && frame.elapsed > 0),
        bundleId: bundle.descriptor.bundleId, renderMode: 'continuous-texture', texturePose: pose ? {
          ground: { x: frame.foot.x, y: frame.foot.y },
          neck: { x: frame.foot.x + (pose.neck.x - ground.x) * pose.breath * scale, y: frame.foot.y + (pose.neckY - ground.y) * scale },
          headCenter: { x: frame.foot.x + (bundle.descriptor.coreRegions.head.x + bundle.descriptor.coreRegions.head.width / 2 - ground.x) * pose.breath * scale,
            y: frame.foot.y + (pose.neckY + (pose.sourceHeadY - pose.neck.y) * pose.breath - ground.y) * scale },
          breath: pose.breath, verticalDriftSourcePx: pose.drift } : null };
    }
    function destroy() {
      if (destroyed) return;
      destroyed = true; token++;
      for (const transaction of pending) cancel(transaction);
      releaseBundle(active); active = null;
    }
    function getDiagnostics() {
      const surfaces = active ? [...active.smoke.values(), ...(active.actor ? [active.actor] : [])] : [];
      const bytes = budget();
      return Object.freeze({ destroyed, token, pendingLoads: pending.size, activeBundle: active?.descriptor.bundleId || null,
        headMode: 'continuous-texture', headTileCount: active?.actor ? 1 : 0,
        headTileBytes: active?.actor ? active.actor.width * active.actor.height * 4 : 0,
        canvasCount: surfaces.length, ...bytes, trackedBytesPeak,
        ownedImages: active?.core ? 1 : 0,
        allocations, smokePreparations, coreWrites, headComposites: coreComposites, renders, lastLoadError, closeFailures,
        ownsRAF: false, ownsResourceLoading: false, intrinsicEyes: true });
    }
    return Object.freeze({ load, render, sample: (packet, elapsed) => validateFrame(sample(packet, elapsed)), destroy, getDiagnostics });
  }

  function clear(ctx) {
    if (!ctx?.canvas || !['save', 'restore', 'setTransform', 'clearRect'].every(name => typeof ctx[name] === 'function')) throw new TypeError('haunt-texture-context-required');
    ctx.save(); try { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); } finally { ctx.restore(); }
  }
  return Object.freeze({ create, clear, durationMs: 7000, duration: 7000,
    sample: (packet, elapsed) => defaultSample(packet, elapsed),
    metadata: Object.freeze({ version: 'haunt-reference-texture-2', localOnly: true, originalReconstruction: true,
      usesGeometryHead: false, intrinsicEyes: true, tendrilStrips: STRIPS, smokeStrips: SMOKE_STRIPS,
      corePaddingRule: 'x=ceil(side*.01+12);y=ceil(side*.01+4)',
      crownShape: 'all source rows retained; swept projections and two softly filled shell troughs; no second face',
      smokeMotion: 'dense ground, two rear billows plus a low front billow that occludes supports, thin rear mist; distinct phases; fixed pivots',
      ownsRAF: false, ownsResourceLoading: false, smokeFilteredOncePerBundle: true,
      memoryAccounting: 'RGBA estimates; excludes browser/GPU duplication and external loader in-flight memory' }) });
});
