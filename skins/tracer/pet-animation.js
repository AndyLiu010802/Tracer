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
    const step = action === 'sleep' ? 240 : quiet ? 200 : work ? 180 : 160;
    const frameMs = Array.from({ length: 16 }, (_, i) => i === 0 ? (quiet ? 1800 : work ? 800 : 500) : i === 15 ? (quiet ? 1000 : work ? 800 : 600) : step);
    return [action, Object.freeze({ page, row: 0, frames: 16, frameMs: Object.freeze(frameMs) })];
  })));
  const smoothClips = Object.freeze(Object.fromEntries(actions.map(action => {
    const clip = denseClips[action];
    return [action, Object.freeze({...clip, frames:32, frameMs:Object.freeze(Array.from({length:32},(_,i)=>i===0?clip.frameMs[0]:i===31?clip.frameMs[15]:clip.frameMs[1]/2))})];
  })));
  const invalid = () => new Error('invalid-animation-sheet');
  const loadFailed = () => new Error('animation-load-failed');
  const noCrop = 'inset(0% 0% 0% 0%)';
  function frameGeometry(data,edge,columns=4) {
    const size=edge/columns,frames=[];
    for(let frame=0;frame<columns*4;frame++){
      const x0=frame%columns*size,y0=Math.floor(frame/columns)*size,seen=new Uint8Array(size*size),queue=new Int32Array(size*size);
      let body=[];
      const opaque=at=>data[((y0+Math.floor(at/size))*edge+x0+at%size)*4+3]>=128;
      for(let start=0;start<seen.length;start++){
        if(seen[start]||!opaque(start))continue;
        let head=0,tail=1;queue[0]=start;seen[start]=1;
        while(head<tail){const at=queue[head++],x=at%size;
          for(const next of [x?at-1:-1,x<size-1?at+1:-1,at-size,at+size]){
            if(next<0||next>=seen.length||seen[next])continue;
            seen[next]=1;if(opaque(next))queue[tail++]=next;
          }
        }
        if(tail>body.length)body=Array.from(queue.subarray(0,tail));
      }
      if(!body.length){frames.push({x:.5,y:.875,area:0});continue;}
      let top=size,bottom=0;for(const at of body){top=Math.min(top,Math.floor(at/size));bottom=Math.max(bottom,Math.floor(at/size));}
      const massColumns=new Uint32Array(size);let total=0;
      for(const at of body){const y=Math.floor(at/size);if(y>=top+(bottom-top)*.3&&y<=top+(bottom-top)*.7){massColumns[at%size]++;total++;}}
      let mass=0,center=size/2;for(let x=0;x<size;x++){mass+=massColumns[x];if(mass>=total/2){center=x;break;}}
      let foot=top;for(const at of body)if(Math.abs(at%size-center)<size*.16)foot=Math.max(foot,Math.floor(at/size));
      frames.push({x:(center+.5)/size,y:(foot+1)/size,area:body.length});
    }
    return frames;
  }
  // Older generated sheets can cross a grid line. Hide only a small, disconnected
  // strip that demonstrably continues from the neighboring cell; never resize art.
  function frameInsets(data, edge, numeric = false, columns = 4) {
    const size = edge / columns, band = Math.floor(size * .08) - 1, gap = Math.ceil(size * .02), result = [];
    const alpha = (x, y) => data[(y * edge + x) * 4 + 3];
    for (let row = 0; row < 4; row++) for (let column = 0; column < columns; column++) {
      const left = column * size, top = row * size, counts = [new Uint32Array(size), new Uint32Array(size)];
      let total = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (alpha(left + x, top + y) >= 16) {
        counts[0][y]++; counts[1][x]++; total++;
      }
      const insets = [0, 0, 0, 0];
      let trimmed = 0;
      for (let side = 0; side < 4; side++) {
        if ((side === 0 && row === 0) || (side === 1 && column === columns-1) || (side === 2 && row === 3) || (side === 3 && column === 0)) continue;
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
      const safeInsets = trimmed > total * .1 ? [0, 0, 0, 0] : insets;
      result.push(numeric ? safeInsets.map(value => value / 100) : 'inset(' + safeInsets.map(value => value + '%').join(' ') + ')');
    }
    return result;
  }
  function sheetPixels(image, columns = 4) {
    const canvas = root.document.createElement('canvas'); canvas.width = columns * 192; canvas.height = 768;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw invalid();
    context.imageSmoothingEnabled = false; context.drawImage(image, 0, 0, columns * 192, 768);
    return context.getImageData(0, 0, columns * 192, 768).data;
  }
  // Conversion reuses the exact display mask before adding padding. Fractions
  // use top/right/bottom/left order and retain the original full-cell coordinates.
  function frameInsetsForImage(image, version = 1) {
    try { return frameInsets(sheetPixels(image, version===3?8:4), version===3?1536:768, true, version===3?8:4); }
    catch { throw loadFailed(); }
  }
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || ![1, 2, 3].includes(raw.version) ||
      Object.keys(raw).some(key => key !== 'version' && key !== 'pages' && key !== 'retainedFrames') || !Array.isArray(raw.pages) || !(raw.version >= 2 ? raw.pages.length === actions.length : [3, 4].includes(raw.pages.length)) ||
      !Array.from({ length: raw.pages.length }, (_, i) => i).every(i => typeof raw.pages[i] === 'string' && asset.test(raw.pages[i]))) return null;
    if (Object.prototype.hasOwnProperty.call(raw, 'retainedFrames') && (raw.version < 2 || !Array.isArray(raw.retainedFrames) || raw.retainedFrames.length !== actions.length ||
      !Array.from({ length: actions.length }, (_, i) => i).every(i => (raw.version === 3 ? [32] : [1, 4, 16]).includes(raw.retainedFrames[i])))) return null;
    const retainedFrames = raw.retainedFrames?.some(count => count !== (raw.version === 3 ? 32 : 16)) ? raw.retainedFrames.slice() : null;
    return { version: raw.version, pages: raw.pages.slice(), ...(retainedFrames ? { retainedFrames } : {}) };
  }
  function player(pages, options, firstPage, version = 1, retainedFrames = []) {
    const columns = version === 3 ? 8 : 4, edge = columns * 192;
    const selectedClips = version === 3 ? smoothClips : version === 2 ? denseClips : clips, firstAction = actions[firstPage * (version >= 2 ? 1 : 4)];
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
    Object.assign(image.style, { position: 'absolute', display: 'block', inset: '0 auto auto 0', width: (columns * 100)+'%', height: '400%', minWidth: '0', minHeight: '0', maxWidth: 'none', maxHeight: 'none', objectFit: 'fill', margin: '0', padding: '0', border: '0', imageRendering: 'pixelated', transformOrigin: '0 0', pointerEvents: 'none' });
    image.style.setProperty('animation', 'none', 'important');
    element.appendChild(image);
    placeholder.className = 'pet-animation-placeholder'; placeholder.textContent = '✦'; placeholder.setAttribute('aria-hidden', 'true');
    Object.assign(placeholder.style, { position: 'absolute', inset: '0', display: 'none', alignItems: 'center', justifyContent: 'center', color: 'var(--pet-accent, #d6c17a)', font: '600 clamp(32px, 8vw, 72px) ui-sans-serif, sans-serif', textShadow: '0 3px 12px #0003' });
    element.appendChild(placeholder);
    const animated = options.animated !== false;
    const motion = animated && typeof root.matchMedia === 'function' ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const preloads = [];
    // Do not decode all sixteen large sheets just to show the first action.
    if (animated && typeof root.Image === 'function') for (const url of version >= 2 ? pages.slice(firstPage + 1, firstPage + 2) : pages) {
      if (!url || url === pages[firstPage]) continue;
      const preload = new root.Image(); preload.decoding = 'async'; preload.src = url; preloads.push(preload);
    }
    const crops = new Map(),geometry = new Map();
    let action = firstAction, requestedAction = action, frame = 0, timer = null, destroyed = false, unavailable = false, loading = false, loadSequence = 0;
    function crop() {
      const clip = selectedClips[action];
      element.style.clipPath = loading ? noCrop : crops.get(pages[clip.page])?.[version >= 2 ? frame : clip.row * 4 + frame] || noCrop;
    }
    function draw(reload = false) {
      if(action==='sleep')frame=retainedCount()===1?0:version>=2?(version===3?24:retainedCount()===4?8:12):2;
      const clip = selectedClips[action], row = version >= 2 ? Math.floor(frame / columns) : clip.row, column = frame % columns;
      element.dataset.action = action; element.dataset.page = String(clip.page); element.dataset.row = String(row); element.dataset.frame = String(frame);
      if (reload || image.getAttribute('src') !== pages[clip.page]) {
        const sequence = ++loadSequence;
        loading = true; image.style.visibility = 'hidden';
        image.onload = () => {
          if (destroyed || sequence !== loadSequence) return;
          if (!crops.has(pages[clip.page])) {
            try { const pixels=sheetPixels(image,columns);crops.set(pages[clip.page], frameInsets(pixels, edge, false, columns));if(version>=2)geometry.set(pages[clip.page],frameGeometry(pixels,edge,columns)); } catch { /* Keep legacy art visible if pixel inspection is unavailable. */ }
          }
          loading = false; unavailable = false; delete element.dataset.error; draw();
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
      const anchor=geometry.get(pages[clip.page])?.[frame];
      // Translate inside a clipped source cell, retaining one pixel scale for all
      // actions. Never fit each pose to its changing silhouette or prop bounds.
      const dx=(.5-(anchor?.x??.5))*100/columns,dy=(.875-(anchor?.y??.875))*25;
      image.style.transform = 'translate(' + (-column * 100/columns+dx) + '%, ' + (-row * 25+dy) + '%)';
      image.style.clipPath='inset('+(row*25)+'% '+((columns-1-column)*100/columns)+'% '+((3-row)*25)+'% '+(column*100/columns)+'%)';
      crop();
    }
    function stop() { if (timer !== null) root.clearTimeout(timer); timer = null; }
    function retainedCount() { return version >= 2 ? retainedFrames[selectedClips[action].page] || (version===3?32:16) : 4; }
    function staticAction() { return options.animated === false || (version === 2 && retainedCount() === 1); }
    function paused() { return destroyed || unavailable || loading || action === 'sleep' || staticAction() || motion?.matches || (doc.visibilityState === 'hidden' || doc.tracerHidden); }
    function schedule() {
      stop();
      element.dataset.playback = destroyed ? 'destroyed' : unavailable ? 'image-unavailable' : loading ? 'loading' : staticAction() ? 'static' : motion?.matches ? 'reduced-motion' : (doc.visibilityState === 'hidden' || doc.tracerHidden) ? 'hidden' : action === 'sleep' ? 'sleeping' : 'playing';
      if (!paused()) timer = root.setTimeout(() => {
        timer = null;
        if (paused()) { schedule(); return; }
        frame = (frame + 1) % selectedClips[action].frames; draw(); schedule();
      }, version === 2 && retainedCount() === 4 ? clips[action].frameMs[Math.floor(frame / 4)] / 4 : selectedClips[action].frameMs[frame]);
    }
    function changed() { if (destroyed) return; if (motion?.matches) { frame = 0; draw(); } schedule(); }
    if (animated) ['visibilitychange','tracer-visibilitychange'].forEach(event=>doc.addEventListener(event,changed));
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
        if (animated) ['visibilitychange','tracer-visibilitychange'].forEach(event=>doc.removeEventListener(event,changed));
        if (motion?.removeEventListener) motion.removeEventListener('change', changed);
        else motion?.removeListener?.(changed);
        for (const preload of preloads) preload.src = '';
        preloads.length = 0;
        crops.clear();
        geometry.clear();
      }
    };
  }
  function create(options = {}) {
    const animation = normalize(options.animation);
    if (!animation || options.image !== animation.pages[0]) throw invalid();
    return player(animation.pages, options, 0, animation.version, animation.retainedFrames);
  }
  function createPage(image, pageIndex, options = {}) {
    const version = options.version === undefined ? 1 : options.version;
    if (![1, 2, 3].includes(version) || typeof image !== 'string' || !asset.test(image) || !Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= actions.length / (version >= 2 ? 1 : 4)) throw invalid();
    if (options.retainedFrames !== undefined && (version < 2 || !(version===3?[32]:[1,4,16]).includes(options.retainedFrames))) throw invalid();
    const pages = []; pages[pageIndex] = image;
    const retainedFrames = []; retainedFrames[pageIndex] = options.retainedFrames;
    return player(pages, options, pageIndex, version, retainedFrames);
  }
  // Pixel checks establish a usable transparent atlas, not semantic pose quality or likeness.
  function inspectPixels(data, edge, version, retainedFrames = version===3?32:16, generated = false) {
    const columns = version===3?8:4, cells = [], size = edge / columns, count = size * size;
    for (let row = 0; row < 4; row++) for (let column = 0; column < columns; column++) {
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
    if (generated) {
      // The prompt reserves 12.5% on every side. Require at least 8% after
      // rasterization, both in the source cell and after the player's foot anchor.
      // Include detached props and tail tips, not just the largest body component.
      const margin = size * .08, anchors = version >= 2 ? frameGeometry(data, edge, columns) : [];
      for (const [index, cell] of cells.entries()) {
        const fits = (dx, dy) => cell.minX + dx >= margin && cell.minY + dy >= margin &&
          cell.maxX + 1 + dx <= size - margin && cell.maxY + 1 + dy <= size - margin;
        const anchor = anchors[index];
        if (!fits(0, 0) || (anchor && !fits((.5 - anchor.x) * size, (.875 - anchor.y) * size))) throw invalid();
      }
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
    if (version >= 2) {
      if (version === 2 && retainedFrames !== 16) {
        // Converted artwork declares its original frame count. Every repeated
        // slot must contain the same visible pixels; this never creates new poses.
        const copies = 16 / retainedFrames;
        for (let first = 0; first < 16; first += copies) for (let copy = first + 1; copy < first + copies; copy++) {
          const a = cells[first].pixels, b = cells[copy].pixels;
          for (let index = 0; index < a.length; index++) if (a[index] !== b[index]) throw invalid();
        }
        return;
      }
      const distinct = [];
      for (const cell of cells) if (distinct.every(other => differs(cell, other, false) && differs(cell, other, true))) distinct.push(cell);
      // A few held poses are allowed; repeating four pictures into sixteen slots is not.
      if (distinct.length < (version===3?12:6)) throw invalid();
      const geometry=frameGeometry(data,edge,columns),areas=geometry.map(frame=>frame.area);
      // Reject extreme within-action discontinuities; allow normal articulation/contact.
      if(Math.max(...areas)>Math.min(...areas)*2.5)throw invalid();
      if(Math.max(...geometry.map(frame=>frame.x))-Math.min(...geometry.map(frame=>frame.x))>.2||Math.max(...geometry.map(frame=>frame.y))-Math.min(...geometry.map(frame=>frame.y))>.25)throw invalid();
      // Area of the largest connected component changes when hands or props
      // touch the torso. It is not a reliable proxy for character scale.
      // Empty cells, opaque backgrounds, cut edges and cloned poses are checked above.
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
    // Comparing body area to idle falsely rejects sitting/sleeping and props.
    // Identity is provided to the generator; pixels cannot measure likeness.
    if(options.identityImage && !asset.test(options.identityImage))throw invalid();
    return validateImage(imageURL, options.version === undefined ? 1 : options.version, options.retainedFrames, options.generated === true);
  }

  async function validateBlob(blob, options = {}) {
    if (!(blob instanceof root.Blob) || blob.type !== 'image/png' || blob.size > 12 * 1024 * 1024) throw invalid();
    const url = root.URL.createObjectURL(blob);
    try { return await validateImage(url, options.version === undefined ? 1 : options.version, options.retainedFrames); } finally { root.URL.revokeObjectURL(url); }
  }
  async function validateImage(imageURL, version, retainedFrames, generated = false) {
    if (![1, 2, 3].includes(version) || (retainedFrames !== undefined && (version < 2 || !(version===3?[32]:[1,4,16]).includes(retainedFrames)))) throw invalid();
    const image = new root.Image();
    try {
      await new Promise((resolve, reject) => {
        const timer = root.setTimeout(() => { image.onload = image.onerror = null; image.src = ''; reject(loadFailed()); }, 20000);
        image.onload = () => { root.clearTimeout(timer); image.onload = image.onerror = null; resolve(); };
        image.onerror = () => { root.clearTimeout(timer); image.onload = image.onerror = null; reject(loadFailed()); };
        image.src = imageURL;
      });
      if (typeof image.decode === 'function') await image.decode();
    } catch { throw loadFailed(); }
    const width = image.naturalWidth, height = image.naturalHeight;
    if (!Number.isFinite(width) || !Number.isFinite(height) || Math.min(width, height) < 768 || Math.max(width, height) > 4096 || Math.abs(width - height * (version===3?2:1)) / width > .01) throw invalid();
    const columns=version===3?8:4, edge=columns*192;
    let pixels;
    try { pixels = sheetPixels(image, columns); } catch { throw loadFailed(); }
    try { inspectPixels(pixels, edge, version, retainedFrames, generated); }
    catch (error) { if (error?.message === 'invalid-animation-sheet') throw error; throw loadFailed(); }
    return { width, height, columns, rows: 4, frames: columns*4 };
  }
  return { normalize, actions, clips, denseClips, smoothClips, create, createPage, validatePage, validateBlob, frameInsetsForImage };
});
