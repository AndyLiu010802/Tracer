(function () {
  'use strict';
  const PANEL = 800, HEIGHT = 900, WIDTH = 1600;
  const canvas = document.getElementById('preview'), ctx = canvas.getContext('2d');
  const play = document.getElementById('play'), cancelButton = document.getElementById('cancel'), centerButton = document.getElementById('center'), strengthInput = document.getElementById('strength'), status = document.getElementById('status');
  const descriptorPath = '/skins/tracer/local-vfx/haunt-art/fade-v1/runtime-descriptor.json', prefix = '/skins/tracer/local-vfx/haunt-art/fade-v1/';
  const allowedPaths = new Set(['fade-haunt-core-v1.png', 'fade-smoke-wisps-v1.png', 'fade-smoke-billows-v1.png', 'fade-smoke-ground-v1.png'].map(name => prefix + name));
  const resources = [], images = [], errors = [], clicks = [], loading = new AbortController();
  let descriptor = null, players = [], ready = false, disposed = false, selected = null, raf = null, active = false, tailing = false, began = 0;
  let timing = { frameTimes: [], renderTimes: [], states: [], ended: null, cancelled: null };
  const packet = { width: PANEL, height: HEIGHT, start: { x: 160, y: 595 }, target: { x: 400, y: 702 }, size: 192, strength: 0.35, intensity: 0.35, seed: 189273, localSmoke: true, atmosphere: true, motion: 'normal', durationMs: 7000 };
  function createdCanvas(owner) { const item = document.createElement('canvas'); resources.push({ owner, canvas: item }); return item; }
  function background(dark) {
    const item = document.createElement('canvas'); item.width = PANEL; item.height = HEIGHT; const c = item.getContext('2d');
    const gradient = c.createLinearGradient(0, 0, PANEL, HEIGHT); gradient.addColorStop(0, dark ? '#17222e' : '#e4edf5'); gradient.addColorStop(1, dark ? '#293d4b' : '#bdcedd'); c.fillStyle = gradient; c.fillRect(0, 0, PANEL, HEIGHT);
    c.fillStyle = dark ? '#dce8f0' : '#31475c'; c.font = '600 25px system-ui'; c.fillText(dark ? 'DARK BACKGROUND' : 'LIGHT BACKGROUND', 42, 51); c.font = '15px system-ui'; c.fillText('Reviewed PNG artwork / isolated synthetic desktop', 42, 82);
    c.fillStyle = dark ? '#273642' : '#fcfdfd'; c.fillRect(90, 140, 590, 544); c.fillStyle = dark ? '#e6edf2' : '#233a4d'; c.font = '600 27px system-ui'; c.fillText('Workspace notes', 123, 195); c.font = '19px system-ui'; ['Synthetic content only.', 'No real apps or private screens.', 'Normal time: no crossfade / slow motion.'].forEach((text, i) => c.fillText(text, 123, 236 + i * 36));
    c.strokeStyle = dark ? '#435762' : '#d2e0e9'; for (let y = 398; y < 647; y += 44) { c.beginPath(); c.moveTo(123, y); c.lineTo(646, y); c.stroke(); }
    c.fillStyle = dark ? '#adbed0' : '#556b7e'; c.font = '15px system-ui'; c.fillText('Reference remake. Intrinsic eyes, continuous core texture.', 42, 794); c.fillText('Black edge atmosphere = desktop adaptation.', 42, 820); return item;
  }
  const surfaces = [0, 1].map(i => { const item = document.createElement('canvas'); item.width = PANEL; item.height = HEIGHT; return { canvas: item, ctx: item.getContext('2d', { willReadFrequently: true }), background: background(i === 1) }; });
  function compose(time) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    surfaces.forEach((surface, i) => { ctx.save(); ctx.translate(i * PANEL, 0); ctx.drawImage(surface.background, 0, 0); ctx.drawImage(surface.canvas, 0, 0); ctx.fillStyle = i ? '#adbed0' : '#556b7e'; ctx.font = '14px system-ui'; ctx.fillText((selected ? 'Clicked ground: (' + selected.x.toFixed(0) + ', ' + selected.y.toFixed(0) + ')' : 'Select a ground point to play') + ' / strength ' + Math.round(packet.strength * 100) + '%', 42, 848); ctx.fillText((time / 1000).toFixed(2) + ' s / in-place rise, fixed source offset', 42, 878); ctx.restore(); });
  }
  function clear() { surfaces.forEach(surface => surface.ctx.clearRect(0, 0, PANEL, HEIGHT)); }
  function controls() { play.disabled = !ready || !selected || disposed; centerButton.disabled = !ready || disposed; cancelButton.disabled = !active || disposed; canvas.setAttribute('aria-disabled', String(!ready || disposed)); }
  function stop(reason) { if (raf !== null) cancelAnimationFrame(raf); raf = null; active = false; tailing = false; if (reason === 'cancel') timing.cancelled = timing.frameTimes.at(-1) || 0; clear(); compose(timing.frameTimes.at(-1) || 0); controls(); }
  function draw(time, options) { clear(); let frame = null; surfaces.forEach((surface, i) => { if (!options?.coreOnly) players[i].fog.draw(surface.ctx, packet, time); frame = players[i].body.render(surface.ctx, options?.coreOnly ? { ...packet, localSmoke: false } : packet, time); }); compose(time); return frame; }
  function tick(now) {
    if (disposed || (!active && !tailing)) return;
    const elapsed = Math.max(0, now - began);
    if (elapsed >= 7000) { if (active) { active = false; tailing = true; timing.ended = elapsed; clear(); controls(); status.textContent = '播放完成，特效已清空。'; } compose(elapsed); if (elapsed < 8000) raf = requestAnimationFrame(tick); else { raf = null; tailing = false; } return; }
    try { const start = performance.now(), frame = draw(elapsed), rig = TracerLocalVfxHauntLayers.mapCoreRig(descriptor, frame); timing.renderTimes.push(performance.now() - start); timing.frameTimes.push(elapsed); timing.states.push({ elapsed, phase: frame.phase, foot: frame.foot, sampleCenter: frame.center, alpha: frame.alpha, rise: frame.rise, scale: frame.scale, assetStatus: frame.assetStatus, drawn: frame.drawn, ground: rig.ground, idealHeadCenter: rig.headCenter, idealNeck: rig.neck, texturePose: frame.texturePose }); raf = requestAnimationFrame(tick); }
    catch (error) { errors.push(String(error.stack || error)); loading.abort(); stop('error'); releasePlayers(); ready = false; status.textContent = '播放失败，已清空并释放资源。请重新打开预览。'; controls(); }
  }
  function start() { if (!ready || !selected || disposed) return; stop('replace'); packet.target = { ...selected }; const strength = Number(strengthInput.value); packet.strength = packet.intensity = Number.isFinite(strength) ? Math.max(0, Math.min(0.6, strength)) : 0.35; strengthInput.value = String(packet.strength); timing = { frameTimes: [], renderTimes: [], states: [], ended: null, cancelled: null }; began = performance.now(); active = true; status.textContent = '正在所选合成位置播放…'; controls(); raf = requestAnimationFrame(tick); }
  function pointerDown(event) { if (!ready || disposed || event.button !== 0) return; const rect = canvas.getBoundingClientRect(), x = (event.clientX - rect.left) * WIDTH / rect.width, y = (event.clientY - rect.top) * HEIGHT / rect.height, panel = Math.max(0, Math.min(1, Math.floor(x / PANEL))); selected = { x: Math.max(0, Math.min(PANEL, x - panel * PANEL)), y: Math.max(0, Math.min(HEIGHT, y)) }; clicks.push({ trusted: event.isTrusted, client: { x: event.clientX, y: event.clientY }, cssRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, backing: { x, y }, panel, localPoint: { ...selected }, devicePixelRatio: devicePixelRatio }); canvas.focus({ preventScroll: true }); start(); }
  function cancelClick() { if (disposed || !ready) return; stop('cancel'); status.textContent = '已取消，特效已清空。'; }
  function centerClick() { if (disposed || !ready) return; selected = { x: 400, y: 702 }; packet.target = { ...selected }; compose(0); controls(); status.textContent = '已选择场景中心，按播放开始。'; }
  function keyDown(event) { if (!disposed && event.key === 'Escape') { stop('cancel'); if (ready) status.textContent = '已取消，特效已清空。'; } }
  canvas.addEventListener('pointerdown', pointerDown); play.addEventListener('click', start); cancelButton.addEventListener('click', cancelClick); centerButton.addEventListener('click', centerClick); document.addEventListener('keydown', keyDown);
  async function loadImage(logicalPath) {
    const pathname = '/' + logicalPath; if (disposed || !allowedPaths.has(pathname)) throw new Error('haunt-preview-image-path-rejected');
    const response = await fetch(pathname, { credentials: 'omit', cache: 'no-store', signal: loading.signal }); if (disposed || !response.ok) throw new Error('haunt-preview-image-load-failed');
    const blob = await response.blob(); if (disposed) throw new Error('haunt-preview-disposed'); const bitmap = await createImageBitmap(blob);
    const item = { path: logicalPath, bitmap, width: bitmap.width, height: bitmap.height, closes: 0 }, originalClose = bitmap.close.bind(bitmap); bitmap.close = () => { item.closes++; originalClose(); }; images.push(item);
    if (disposed) { bitmap.close(); throw new Error('haunt-preview-disposed'); } return bitmap;
  }
  function distribution(values) { const sorted = values.slice().sort((a, b) => a - b); return { count: values.length, mean: sorted.reduce((a, b) => a + b, 0) / Math.max(1, sorted.length), p95: sorted[Math.floor(sorted.length * 0.95)] || 0 }; }
  function pixels() { return surfaces.map(surface => { const data = surface.ctx.getImageData(0, 0, PANEL, HEIGHT).data; let nontransparent = 0, peakAlpha = 0; for (let i = 3; i < data.length; i += 4) { if (data[i]) nontransparent++; peakAlpha = Math.max(peakAlpha, data[i]); } return { nontransparent, peakAlpha }; }); }
  function releasePlayers() { players.forEach(item => { item.body?.destroy(); item.fog?.destroy(); }); }
  function dispose() { if (disposed) return; disposed = true; ready = false; loading.abort(); stop('dispose'); releasePlayers(); canvas.removeEventListener('pointerdown', pointerDown); play.removeEventListener('click', start); cancelButton.removeEventListener('click', cancelClick); centerButton.removeEventListener('click', centerClick); document.removeEventListener('keydown', keyDown); window.removeEventListener('pagehide', dispose); clear(); compose(0); controls(); }
  window.addEventListener('pagehide', dispose, { once: true });
  window.TracerHauntPreviewDiagnostics = Object.freeze({
    snapshot(options) { return { ready, disposed, active, tailing, selected, descriptor, packet: { ...packet }, clicks: clicks.slice(), errors: errors.slice(), frames: timing.frameTimes.length, frameTimes: timing.frameTimes.slice(), states: timing.states.slice(), render: distribution(timing.renderTimes), cadence: distribution(timing.frameTimes.slice(1).map((time, i) => time - timing.frameTimes[i])), ended: timing.ended, cancelled: timing.cancelled, effects: options?.pixels ? pixels() : null, engines: players.map(item => ({ body: item.body?.getDiagnostics() || null, fog: item.fog?.getDiagnostics() || null })), images: images.map(item => ({ path: item.path, width: item.width, height: item.height, currentWidth: item.bitmap.width, currentHeight: item.bitmap.height, closes: item.closes })), resources: resources.map(item => ({ owner: item.owner, width: item.canvas.width, height: item.canvas.height })) }; },
    capture(time, options) { if (!ready || disposed || active || tailing || !Number.isFinite(time) || time < 0 || time >= 7000) throw new Error('haunt-preview-capture-unavailable'); const strength = Number(strengthInput.value); packet.strength = packet.intensity = Number.isFinite(strength) ? Math.max(0, Math.min(0.6, strength)) : 0.35; const frame = draw(time, options); return { time, frame, rig: TracerLocalVfxHauntLayers.mapCoreRig(descriptor, frame), effects: pixels(), image: canvas.toDataURL('image/png') }; }
  });
  compose(0); controls();
  (async () => {
    const response = await fetch(descriptorPath, { credentials: 'omit', cache: 'no-store', signal: loading.signal }); if (disposed) return; if (!response.ok) throw new Error('haunt-preview-descriptor-load-failed');
    const raw = await response.json(); if (disposed) return; descriptor = TracerLocalVfxHauntLayers.validateCoreDescriptor(raw); if (descriptor.bundleId !== 'fade-v1' || descriptor.layers.some(layer => !allowedPaths.has('/' + layer.src))) throw new Error('haunt-preview-descriptor-path-rejected');
    for (let i = 0; i < surfaces.length; i++) { if (disposed) return; const item = { body: null, fog: null }; players.push(item); item.body = TracerLocalVfxHauntTexture.create({ loadImage, createCanvas: () => createdCanvas('texture-' + i) }); item.fog = TracerLocalVfxHauntAtmosphere.create({ createCanvas: () => createdCanvas('fog-' + i) }); }
    const results = await Promise.all(players.map(item => item.body.load(descriptor))); if (disposed) { releasePlayers(); return; } if (results.some(item => item.status !== 'ready')) throw new Error('haunt-preview-texture-not-ready'); ready = true; status.textContent = '画稿加载完成；点击场景选择位置并播放。'; controls();
  })().catch(error => { releasePlayers(); ready = false; clear(); compose(0); if (!disposed) { errors.push(String(error.stack || error)); status.textContent = '画稿加载失败，播放已禁用。请检查本地资源后重新打开。'; } controls(); });
})();
