(function () {
  'use strict';
  const bridge = window.FishingAquariumDesktop, display = window.TracerFishingAquariumArt;
  if (!bridge || !display) return;
  const host = document.getElementById('aquarium-content'), frame = document.getElementById('aquarium-frame');
  let snapshot = null, renderer = null, nativeVisible = false, dragging = null, dragHost = null, lastDragPoint = null, passThrough = null, disposed = false, moveMode = false;
  const point = event => ({ screenX: event.screenX, screenY: event.screenY });
  let lastRegionsKey = null;
  function publishRegions() {
    if (!snapshot) return;
    const nodes = [...host.querySelectorAll('.fishing-aquarium-tank,.fishing-aquarium-base')];
    const regions = nodes.map(node => {
      const b = node.getBoundingClientRect(), x = Math.max(0, b.left / window.innerWidth), y = Math.max(0, b.top / window.innerHeight);
      return { x, y, width: Math.max(0, Math.min(1, b.right / window.innerWidth) - x), height: Math.max(0, Math.min(1, b.bottom / window.innerHeight) - y) };
    }).filter(r => r.width > 0 && r.height > 0);
    const key = JSON.stringify([snapshot.nativeSessionId, regions]);
    if (regions.length && key !== lastRegionsKey) { lastRegionsKey = key; bridge.send({type:'input-regions', value:regions}); }
  }
  function pointerMode(value) { const next = value && dragging === null; if (next !== passThrough) { passThrough = next; bridge.send({ type: 'pointer-pass-through', value: next }); } }
  function pause() { renderer?.destroy(); renderer = null; host.replaceChildren(); document.body.dataset.paused = 'true'; }
  function paint() {
    if (disposed || !snapshot || !nativeVisible || document.hidden) { pause(); return; }
    document.body.dataset.paused = 'false';
    if (!renderer) renderer = display.create(host, { compact: true, yaw: snapshot.desktopYaw, onBoundsChange: publishRegions });
    renderer.update(snapshot.showcase, snapshot.language, { yaw: snapshot.desktopYaw, accountScope:snapshot.accountScope, accountGeneration:snapshot.accountGeneration, accountRestoreId:snapshot.accountRestoreId });
    const en = snapshot.language === 'en';
    document.documentElement.lang = en ? 'en' : 'zh-CN';
    frame.setAttribute('aria-label', en ? 'Legendary aquarium. Drag with the left button; right-click to rotate, resize or hide.' : '传奇水族箱，左键拖动，右键可旋转、缩放或隐藏。');
    pointerMode(false);publishRegions();
  }
  function overTank(event) { return nativeVisible && [...host.querySelectorAll('.fishing-aquarium-tank,.fishing-aquarium-base')].some(element => contains(element, event.clientX, event.clientY)); }
  function contains(element, x, y) {
    if (!element) return false;
    const b = element.getBoundingClientRect();
    if (!b.width || !b.height || x < b.left || x > b.right || y < b.top || y > b.bottom) return false;
    const style = getComputedStyle(element);
    for (const [property, right, bottom] of [['borderTopLeftRadius', false, false], ['borderTopRightRadius', true, false], ['borderBottomLeftRadius', false, true], ['borderBottomRightRadius', true, true]]) {
      const parts = style[property].split(' '), length = (value, size) => Math.max(0, Math.min(size / 2, (parseFloat(value) || 0) * (value.endsWith('%') ? size / 100 : 1)));
      const rx = length(parts[0], b.width), ry = length(parts[1] || parts[0], b.height);
      const dx = right ? b.right - x : x - b.left, dy = bottom ? b.bottom - y : y - b.top;
      if (rx && ry && dx < rx && dy < ry && ((dx - rx) / rx) ** 2 + ((dy - ry) / ry) ** 2 > 1) return false;
    }
    return true;
  }
  function hit(event) {
    if (dragging !== null) { pointerMode(false); return; }
    const x = event.clientX, y = event.clientY;
    const visible = nativeVisible && [...host.querySelectorAll('.fishing-aquarium-tank,.fishing-aquarium-base')].some(element => contains(element,x,y));
    pointerMode(!visible);
  }

  function begin(event) { if (event.button !== 0 || !snapshot || !nativeVisible || dragging !== null) return; dragging = event.pointerId; dragHost = event.currentTarget; lastDragPoint = point(event); frame.dataset.dragging = 'true'; pointerMode(false); dragHost.setPointerCapture(event.pointerId); bridge.send({ type: 'drag-start', value: lastDragPoint }); event.preventDefault(); }
  function move(event) { if (dragging === event.pointerId) { lastDragPoint = point(event); bridge.send({ type: 'drag-move', value: lastDragPoint }); } }
  function end(event) { if (dragging !== event.pointerId) return; const id = dragging, capture = dragHost; dragging = null; dragHost = null; frame.dataset.dragging = 'false'; moveMode = false; frame.dataset.moving = 'false'; bridge.send({ type: 'drag-end', value: event.type === 'pointerup' ? point(event) : lastDragPoint }); if (capture?.hasPointerCapture?.(id)) capture.releasePointerCapture(id); }
  frame.addEventListener('pointerdown', event => { if (overTank(event)) begin(event); });
  // Window capture keeps dragging stable when the pointer leaves the glass.
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end); window.addEventListener('lostpointercapture', end);
  function fitFrame() { frame.style.zoom = String(Math.min(window.innerWidth / 420, window.innerHeight / 340)); publishRegions(); }
  window.addEventListener('resize',fitFrame);fitFrame();
  window.addEventListener('contextmenu',event=>{event.preventDefault();if(!nativeVisible||dragging!==null)return;pointerMode(false);bridge.send({type:'context-menu'});});
  const offMenu=bridge.onMenuAction?.(value=>{if(value.type==='move'){moveMode=true;frame.dataset.moving='true';pointerMode(false);}});
  // Windows click-through forwards mousemove; it need not emit pointermove.
  window.addEventListener('pointermove', hit); window.addEventListener('mousemove', hit); document.addEventListener('visibilitychange', paint);
  const offSnapshot = bridge.onSnapshot(value => { snapshot = value; nativeVisible = value.desktopVisible === true; paint(); });
  const offVisibility = bridge.onVisibility(value => { nativeVisible = value.visible; if (value.clear) snapshot = null; if (!nativeVisible) { moveMode=false;frame.dataset.moving='false';const id = dragging, capture = dragHost; dragging = null; dragHost = null; frame.dataset.dragging = 'false'; if (id !== null && capture?.hasPointerCapture?.(id)) capture.releasePointerCapture(id); } paint(); });
  window.addEventListener('beforeunload', () => { disposed = true; offSnapshot(); offVisibility(); offMenu?.(); window.removeEventListener('pointermove', hit); window.removeEventListener('mousemove', hit); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); window.removeEventListener('lostpointercapture', end); window.removeEventListener('resize', fitFrame); document.removeEventListener('visibilitychange', paint); pause(); });
  bridge.send({ type: 'ready' });
}());
