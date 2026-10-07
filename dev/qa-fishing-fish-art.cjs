'use strict';

// Production fish meshes, isolated from application state and account data.
// This verifies rendering and produces visual evidence; it does not prove anatomy.
// Run after dev/build-fishing-catalog-art.cjs so the fallback atlas is current.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../.cache/desktop-qa-tools/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(root, '.cache/fishing-fish-art-'));
const oddSpecies = ['gulpuffer', 'grumpangler', 'flopray', 'snagglefin'];
const detailedSpecies = ['seahorse', 'angelfish', 'crystal', 'dreamray', 'galaxywhale', 'koi', 'lantern', 'catfish', ...oddSpecies];
const atlasCell = { columns: 5, width: 328, height: 216 };
const permittedFiles = new Set(['fishing-model.js', 'fishing-lighting.js', 'fishing-art.js', 'fishing-art/fish-model-v1.png']);
// Freeze one coherent source snapshot even if model work continues elsewhere.
const sourceFiles = new Map([...permittedFiles].map(file => [file, fs.readFileSync(path.join(root, 'skins/tracer', file))]));
const sourceHashes = Object.fromEntries([...sourceFiles].map(([file, bytes]) => [file, crypto.createHash('sha256').update(bytes).digest('hex')]));
fs.writeFileSync(path.join(output, 'source-snapshot.json'), JSON.stringify(sourceHashes, null, 2) + '\n');
const documentSource = `<!doctype html><meta charset="utf-8"><title>Fish model visual review</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#13242b;color:#ecf3e9;font:15px system-ui,sans-serif;padding:28px}h1,h2,p{margin:0}h1{font-size:30px}h2{font-size:26px}p{color:#bdcfc8;line-height:1.65;margin:7px 0 22px}.sheet{padding:26px;background:#1b3036;border:1px solid #4c6c72;border-radius:18px;margin-bottom:26px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}.card{min-width:0;background:radial-gradient(ellipse at 50% 40%,#3f6067,#172e37 85%);border:1px solid #54747a;border-radius:12px;overflow:hidden;padding:10px}.card img{display:block;width:100%;height:160px;object-fit:contain}.card strong,.card small{display:block;text-align:center}.card strong{margin-top:7px;font-size:15px}.card small{color:#b5cec7;margin:4px 0 6px;font-size:12px}.detail-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.detail-grid .card img{height:264px}#stage{width:656px;height:432px;margin:auto}#stage canvas{display:block;width:100%;height:100%}#live{max-width:950px;margin:0 auto 24px}#status{text-align:center}.fallback-row{display:grid;grid-template-columns:1fr 1fr;gap:20px}.fallback-cell{height:280px}.fallback-cell svg{width:100%;height:100%;display:block}
.odd-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}.odd-grid .card{padding:20px}.odd-grid .card img{height:340px}.odd-grid .card strong{font-size:22px}.odd-grid .card small{font-size:15px}
</style>
<section class="sheet" id="live"><h1>水生物 · 实时模型检查</h1><p id="status">鱼的真实模型、材质与动画</p><div id="stage"></div></section>
<section class="sheet" id="contact"><h2>水生物 · 实时模型</h2><p>直接截取游戏中的 3D 模型。柔和表情与物种轮廓需要结合多视角人工检查。</p><div class="grid" id="contact-grid"></div></section>
<section class="sheet" id="odd-legends"><h2>异形传说 · 四种新朋友</h2><p>夸张的表情与独特轮廓，来自游戏中的实时 3D 模型。</p><div class="odd-grid" id="odd-grid"></div></section>
<section class="sheet" id="angles"><h2>结构观察 · 左右两侧与斜侧</h2><p>生产相机的俯角固定，仅通过真实拖动水平环绕。下方并非正俯视。</p><div class="detail-grid" id="angle-grid"></div></section>
<section class="sheet" id="feeding"><h2>异形传说 · 鱼塘投喂</h2><p>真实鱼塘中的投喂前、动作高点与恢复游动。</p><div class="detail-grid" id="feeding-grid"></div></section>
<section class="sheet" id="fallback"><h2>无 WebGL 时的同源图鉴</h2><p>左：无法创建 WebGL 时的展示；右：同一物种的图鉴。</p><div class="fallback-row"><div class="card fallback-cell" id="fallback-host"></div><div class="card fallback-cell" id="atlas-host"></div></div></section>
<script src="/fishing-model.js"></script><script src="/fishing-lighting.js"></script><script src="/fishing-art.js"></script>`;

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const errors = [], warnings = [];
  let report;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1.5, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url()), file = url.pathname.slice(1);
      if (url.origin !== 'http://fish-art-review.test') return route.abort();
      if (!file) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: documentSource });
      if (!permittedFiles.has(file)) return route.fulfill({ status: 404 });
      return route.fulfill({ contentType: file.endsWith('.png') ? 'image/png' : 'application/javascript; charset=utf-8', body: sourceFiles.get(file) });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (['warning', 'error'].includes(message.type())) warnings.push(message.text()); });
    await page.goto('http://fish-art-review.test/', { waitUntil: 'load' });
    await page.evaluate(oddSpecies => {
      const audit = window.fishAudit = { bufferUploads: 0, matrixUploads: 0, checkedValues: 0, invalidValues: [], resources: [], glErrors: [], contexts: [], feedingUniforms: {} };
      const prototype = WebGLRenderingContext.prototype;
      const uniformNames = new WeakMap(), currentSpecies = new WeakMap(), getUniformLocation = prototype.getUniformLocation, uniform1f = prototype.uniform1f;
      prototype.getUniformLocation = function (program, name) { const location = getUniformLocation.call(this, program, name); if (location) uniformNames.set(location, name); return location; };
      prototype.uniform1f = function (location, value) {
        audit.checkedValues++;
        if (!Number.isFinite(value)) audit.invalidValues.push({ method: 'uniform1f', name: uniformNames.get(location), value: String(value) });
        if (location && uniformNames.get(location) === 'uSpecies') currentSpecies.set(this, value);
        if (location && uniformNames.get(location) === 'uFishFeed') {
          const species = TracerFishingModel.catalog.fish[currentSpecies.get(this)]?.id;
          if (species) audit.feedingUniforms[species] = Math.max(audit.feedingUniforms[species] || 0, value);
        }
        return uniform1f.call(this, location, value);
      };
      for (const [method, argument] of [['bufferData', 1], ['uniformMatrix4fv', 2], ['uniform3fv', 1], ['uniform4fv', 1]]) {
        const original = prototype[method];
        prototype[method] = function (...args) {
          const values = args[argument];
          if (values && typeof values.length === 'number') {
            audit.checkedValues += values.length;
            for (let i = 0; i < values.length; i++) if (!Number.isFinite(values[i])) { audit.invalidValues.push({ method, index: i, value: String(values[i]) }); break; }
          }
          if (method === 'bufferData') audit.bufferUploads++;
          if (method === 'uniformMatrix4fv') audit.matrixUploads++;
          return original.apply(this, args);
        };
      }
      for (const suffix of ['Buffer', 'Texture', 'Program']) {
        const create = prototype['create' + suffix], remove = prototype['delete' + suffix];
        const live = new Set();
        audit.resources.push({ type: suffix, live });
        prototype['create' + suffix] = function (...args) { const value = create.apply(this, args); if (value) live.add(value); return value; };
        prototype['delete' + suffix] = function (value) { live.delete(value); return remove.call(this, value); };
      }
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, options) {
        const gl = getContext.call(this, type, options);
        if (gl && /webgl/.test(type) && !audit.contexts.includes(gl)) audit.contexts.push(gl);
        return gl;
      };
      const stage = document.getElementById('stage');
      window.fishReview = {
        stage, renderer: TracerFishingArt.createFishFigure(stage, { fish: TracerFishingModel.catalog.fish[0], catalog: TracerFishingModel.catalog }),
        frames: [], current: null, oddSpecies,
        capture(id, interactive = false) {
          const fish = TracerFishingModel.catalog.fish.find(item => item.id === id);
          this.current = fish;
          this.renderer.update({ fish: interactive ? [fish] : fish });
          const source = stage.querySelector('canvas'), canvas = document.createElement('canvas');
          canvas.width = source.width; canvas.height = source.height;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.drawImage(source, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let left = canvas.width, top = canvas.height, right = -1, bottom = -1, occupiedPixels = 0;
          for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
            if (pixels[(y * canvas.width + x) * 4 + 3] < 3) continue;
            occupiedPixels++; left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
          }
          const gl = source.getContext('webgl');
          for (let error = gl.getError(), i = 0; error !== gl.NO_ERROR && i < 10; error = gl.getError(), i++) audit.glErrors.push({ id, error });
          const portrait = document.createElement('canvas'); portrait.width = canvas.width; portrait.height = canvas.height;
          if (occupiedPixels) {
            const cropWidth = right - left + 1, cropHeight = bottom - top + 1, fit = Math.min(portrait.width / cropWidth, portrait.height / cropHeight) * .88;
            portrait.getContext('2d').drawImage(canvas, left, top, cropWidth, cropHeight, (portrait.width - cropWidth * fit) / 2, (portrait.height - cropHeight * fit) / 2, cropWidth * fit, cropHeight * fit);
          }
          return { id, name: fish.name, width: canvas.width, height: canvas.height, bounds: [left, top, right + 1, bottom + 1], occupiedPixels, png: canvas.toDataURL('image/png'), portrait: portrait.toDataURL('image/png'), pixels };
        },
        saveCard(frame, grid, label) {
          const card = document.createElement('article'), image = document.createElement('img'), title = document.createElement('strong'), note = document.createElement('small');
          card.className = 'card'; image.src = frame.portrait; title.textContent = frame.name[0]; note.textContent = label || frame.name[1];
          card.append(image, title, note); document.getElementById(grid).appendChild(card);
        },
      };
      document.querySelector('#contact h2').textContent = TracerFishingModel.catalog.fish.length + ' 种水生物 · 实时模型';
    }, oddSpecies);
    assert.equal(await page.evaluate(() => fishReview.renderer.kind), 'webgl', 'Live review requires real WebGL geometry');
    const ids = await page.evaluate(() => TracerFishingModel.catalog.fish.map(fish => fish.id));
    assert(ids.length > 0, 'The catalogue must contain fish');
    assert.equal(new Set(ids).size, ids.length, 'Every fish must have a unique catalogue identity');
    for (const id of detailedSpecies) assert(ids.includes(id), 'Detailed review species is in the catalogue: ' + id);
    const atlasLayout = { ...atlasCell, count: ids.length, rows: Math.ceil(ids.length / atlasCell.columns), pixelWidth: atlasCell.columns * atlasCell.width, pixelHeight: Math.ceil(ids.length / atlasCell.columns) * atlasCell.height };
    const atlasBytes = sourceFiles.get('fishing-art/fish-model-v1.png');
    assert.equal(atlasBytes.readUInt32BE(16), atlasLayout.pixelWidth, 'Atlas width follows the five-column layout');
    assert.equal(atlasBytes.readUInt32BE(20), atlasLayout.pixelHeight, 'Atlas height fits the current catalogue');
    const fish = [];
    for (const id of ids) {
      await page.evaluate(id => {
        document.getElementById('status').textContent = TracerFishingModel.catalog.fish.find(fish => fish.id === id).name.join(' / ');
        fishReview.previous = fishReview.capture(id);
      }, id);
      await page.waitForTimeout(450);
      const result = await page.evaluate(id => {
        const next = fishReview.capture(id), previous = fishReview.previous;
        let changedPixels = 0;
        for (let i = 0; i < next.pixels.length; i += 4) if ([0, 1, 2, 3].some(c => Math.abs(next.pixels[i + c] - previous.pixels[i + c]) > 8)) changedPixels++;
        fishReview.saveCard(next, 'contact-grid');
        if (fishReview.oddSpecies.includes(id)) fishReview.saveCard(next, 'odd-grid');
        const { pixels, png, portrait, ...stats } = next;
        delete fishReview.previous;
        return { ...stats, changedPixels, animationIntervalMs: 450 };
      }, id);
      assertFrame(result, id);
      assert(result.changedPixels > 25, id + ' must visibly animate over 450 ms');
      fish.push(result);
    }
    await page.locator('#contact').screenshot({ path: path.join(output, 'fish-live-contact.png') });
    assert.equal(await page.locator('#contact-grid .card').count(), ids.length);
    assert.equal(await page.locator('#odd-grid .card').count(), oddSpecies.length);
    await page.locator('#odd-legends').screenshot({ path: path.join(output, 'odd-legends.png') });
    await page.locator('#live').scrollIntoViewIfNeeded();
    const recordMovie = async (ids, filename, durationMs = 1350, closeup = false) => {
      const result = await page.evaluate(async ({ ids, durationMs, closeup }) => {
      if (typeof MediaRecorder === 'undefined') return { supported: false };
      const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) return { supported: false };
      const canvas = document.createElement('canvas'); canvas.width = 984; canvas.height = 744;
      const context = canvas.getContext('2d'), stream = canvas.captureStream(24), recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2200000 }), chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const stopped = new Promise(resolve => { recorder.onstop = resolve; });
      recorder.start();
      for (const id of ids) {
        const specimen = TracerFishingModel.catalog.fish.find(fish => fish.id === id);
        const frame = closeup ? fishReview.capture(id) : null;
        let crop;
        if (frame) {
          const [left, top, right, bottom] = frame.bounds, width = right - left, height = bottom - top;
          const x = Math.max(0, left - width * .24), y = Math.max(0, top - height * .24);
          crop = { x, y, width: Math.min(frame.width, right + width * .24) - x, height: Math.min(frame.height, bottom + height * .24) - y };
        }
        const start = performance.now();
        while (performance.now() - start < durationMs) {
          fishReview.renderer.update({ fish: specimen });
          context.fillStyle = '#19313a'; context.fillRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = '#eef5e9'; context.font = '32px system-ui'; context.textAlign = 'center'; context.fillText(specimen.name[0] + ' / ' + specimen.name[1], canvas.width / 2, 52);
          const source = fishReview.stage.querySelector('canvas');
          if (crop) {
            const fit = Math.min(canvas.width / crop.width, 648 / crop.height);
            context.drawImage(source, crop.x, crop.y, crop.width, crop.height, (canvas.width - crop.width * fit) / 2, 72 + (648 - crop.height * fit) / 2, crop.width * fit, crop.height * fit);
          } else context.drawImage(source, 0, 72, canvas.width, 648);
          await new Promise(resolve => setTimeout(resolve, 1000 / 24));
        }
      }
      recorder.stop(); await stopped; stream.getTracks().forEach(track => track.stop());
      const blob = new Blob(chunks, { type: mimeType });
      const data = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
      return { supported: true, mimeType, bytes: blob.size, species: ids, durationPerSpeciesMs: durationMs, closeup, base64: data.split(',')[1] };
      }, { ids, durationMs, closeup });
      if (result.supported) { fs.writeFileSync(path.join(output, filename), Buffer.from(result.base64, 'base64')); delete result.base64; assert(result.bytes > 10000, 'Recorded animation must contain video data'); }
      return { ...result, file: filename };
    };
    const movie = await recordMovie(detailedSpecies, 'fish-live-motion.webm');
    const oddMovie = await recordMovie(oddSpecies, 'odd-legends-motion.webm', 1850, true);
    await page.evaluate(() => {
      fishReview.renderer.destroy();
      fishReview.renderer = TracerFishingArt.createPond(fishReview.stage, { figureOnly: true, interactive: true, fish: [TracerFishingModel.catalog.fish[0]], catalog: TracerFishingModel.catalog });
    });
    let currentYaw = .2;
    const angles = [];
    for (const id of detailedSpecies) {
      for (const [label, yaw] of [['左侧 · 固定俯角', -.22], ['右侧 · 固定俯角', Math.PI - .22], ['斜侧 · 固定俯角', .88]]) {
        const bounds = await page.locator('#stage canvas').boundingBox();
        const dx = (yaw - currentYaw) / .008;
        const startX = bounds.x + bounds.width / 2 - dx / 2, startY = bounds.y + bounds.height / 2;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + dx, startY, { steps: 8 });
        await page.mouse.up();
        currentYaw = yaw;
        const result = await page.evaluate(({ id, label }) => {
          const frame = fishReview.capture(id, true); fishReview.saveCard(frame, 'angle-grid', label);
          const { pixels, png, portrait, ...stats } = frame; return { ...stats, label, png };
        }, { id, label });
        assertFrame(result, id + ' ' + label);
        fs.writeFileSync(path.join(output, id + '-' + (angles.length % 3) + '.png'), Buffer.from(result.png.split(',')[1], 'base64'));
        delete result.png; angles.push(result);
      }
    }
    await page.locator('#angles').screenshot({ path: path.join(output, 'fish-multiple-views.png') });
    await page.evaluate(() => fishReview.renderer.destroy());
    assert.equal(await page.locator('#stage canvas').count(), 0, 'Destroy removes all live surfaces');
    await page.locator('#live').scrollIntoViewIfNeeded();
    const pondKind = await page.evaluate(oddSpecies => {
      const fish = oddSpecies.map(speciesId => ({ id: 'review-' + speciesId, instanceId: 'review-' + speciesId, speciesId, growth: 100 }));
      fishReview.renderer = TracerFishingArt.createPond(fishReview.stage, { fish, catalog: TracerFishingModel.catalog, interactive: false, pond: { id: 'review-pond', styleId: 'moon' } });
      fishReview.captureFeeding = label => {
        fishReview.renderer.update({});
        const source = fishReview.stage.querySelector('canvas'), copy = document.createElement('canvas'); copy.width = source.width; copy.height = source.height;
        const context = copy.getContext('2d', { willReadFrequently: true }); context.drawImage(source, 0, 0);
        const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
        let occupiedPixels = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) occupiedPixels++;
        const gl = source.getContext('webgl'); for (let error = gl.getError(), i = 0; error !== gl.NO_ERROR && i < 10; error = gl.getError(), i++) fishAudit.glErrors.push({ id: 'feeding-' + label, error });
        fishReview.saveCard({ portrait: copy.toDataURL('image/png'), name: [label, oddSpecies.join(' / ')] }, 'feeding-grid', '四种新鱼 · 真实鱼塘');
        return { label, occupiedPixels, feeding: fishReview.stage.dataset.feeding === 'true' };
      };
      return fishReview.renderer.kind;
    }, oddSpecies);
    assert.equal(pondKind, 'webgl', 'Feeding review uses the actual pond renderer');
    await page.waitForTimeout(150);
    const feeding = { frames: [await page.evaluate(() => fishReview.captureFeeding('投喂前'))] };
    await page.evaluate(oddSpecies => fishReview.renderer.feed({ id: 'review-odd-feeding', at: Date.now(), fishIds: oddSpecies }), oddSpecies);
    await page.waitForFunction(ids => ids.every(id => fishAudit.feedingUniforms[id] > .8), oddSpecies, { timeout: 15000 });
    feeding.frames.push(await page.evaluate(() => fishReview.captureFeeding('投喂动作')));
    await page.waitForFunction(() => fishReview.stage.dataset.feeding !== 'true', null, { timeout: 20000 });
    feeding.frames.push(await page.evaluate(() => fishReview.captureFeeding('恢复游动')));
    feeding.maximumUniforms = await page.evaluate(ids => Object.fromEntries(ids.map(id => [id, fishAudit.feedingUniforms[id]])), oddSpecies);
    assert.equal(feeding.frames[0].feeding, false); assert.equal(feeding.frames[1].feeding, true); assert.equal(feeding.frames[2].feeding, false);
    for (const frame of feeding.frames) assert(frame.occupiedPixels > 1000, frame.label + ' must contain the real pond');
    for (const id of oddSpecies) assert(feeding.maximumUniforms[id] > .8, id + ' executes its nonzero feeding deformation and particles');
    await page.locator('#feeding').screenshot({ path: path.join(output, 'odd-legends-feeding.png') });
    await page.evaluate(() => fishReview.renderer.destroy());
    assert.equal(await page.locator('#stage canvas').count(), 0, 'Feeding review releases its surface');
    const cleanup = await page.evaluate(() => ({ resources: fishAudit.resources.map(({ type, live }) => ({ type, live: live.size })), contextsCreated: fishAudit.contexts.length, contextsLost: fishAudit.contexts.filter(gl => gl.isContextLost()).length, bufferUploads: fishAudit.bufferUploads, matrixUploads: fishAudit.matrixUploads, checkedValues: fishAudit.checkedValues, invalidValues: fishAudit.invalidValues, glErrors: fishAudit.glErrors }));
    assert(cleanup.bufferUploads > 0 && cleanup.matrixUploads > 0 && cleanup.checkedValues > 0);
    assert.deepEqual(cleanup.invalidValues, [], 'Geometry and uniform values must remain finite');
    assert.deepEqual(cleanup.glErrors, [], 'No WebGL errors after real rendered frames');
    assert.equal(cleanup.contextsCreated, 3, 'All fish share one figure, one rotating figure and one real pond renderer');
    assert.equal(cleanup.contextsLost, cleanup.contextsCreated, 'Destroyed figures explicitly release their contexts');
    for (const resource of cleanup.resources) assert.equal(resource.live, 0, resource.type + ' objects released');
    const fallback = await page.evaluate(() => {
      const host = document.getElementById('fallback-host'), atlas = document.getElementById('atlas-host'), original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, options) { return /webgl/.test(kind) ? null : original.call(this, kind, options); };
      const records = [];
      try {
        const figure = TracerFishingArt.createFishFigure(host, { fish: TracerFishingModel.catalog.fish[0], catalog: TracerFishingModel.catalog });
        for (const fish of TracerFishingModel.catalog.fish) {
          figure.update({ fish }); atlas.innerHTML = TracerFishingArt.fishMarkup(fish);
          const signature = element => {
            const svg = element.querySelector('svg'), image = svg.querySelector('image'), rectangle = svg.querySelector('clipPath rect');
            return { species: svg.dataset.species, viewBox: svg.getAttribute('viewBox'), transform: svg.querySelector('g').getAttribute('transform'), image: ['href', 'x', 'y', 'width', 'height'].map(key => image.getAttribute(key)), clip: ['width', 'height'].map(key => rectangle.getAttribute(key)) };
          };
          records.push({ id: fish.id, kind: figure.kind, art: host.dataset.figureArt, fallback: signature(host), catalogue: signature(atlas) });
        }
        const koi = TracerFishingModel.catalog.fish.find(fish => fish.id === 'koi'); figure.update({ fish: koi }); atlas.innerHTML = TracerFishingArt.fishMarkup(koi);
        window.fallbackFigure = figure;
      } finally { HTMLCanvasElement.prototype.getContext = original; }
      return records;
    });
    for (const [index, result] of fallback.entries()) {
      assert.equal(result.kind, 'css3d'); assert.equal(result.art, 'illustration');
      assert.deepEqual(result.fallback, result.catalogue, result.id + ' fallback uses exactly the catalogue atlas cell');
      assert.equal(result.fallback.image[0], '/fishing-art/fish-model-v1.png');
      assert.equal(Number(result.fallback.image[1]), -(index % atlasCell.columns) * atlasCell.width || 0, result.id + ' uses its own atlas column');
      assert.equal(Number(result.fallback.image[2]), -Math.floor(index / atlasCell.columns) * atlasCell.height || 0, result.id + ' uses its own atlas row');
      assert.equal(Number(result.fallback.image[3]), atlasLayout.pixelWidth, 'Fallback SVG uses the full current atlas width');
      assert.equal(Number(result.fallback.image[4]), atlasLayout.pixelHeight, 'Fallback SVG uses the full current atlas height');
    }
    await page.evaluate(() => new Promise((resolve, reject) => { const image = new Image(); image.onload = resolve; image.onerror = reject; image.src = '/fishing-art/fish-model-v1.png'; }));
    await page.locator('#fallback').screenshot({ path: path.join(output, 'fish-catalogue-fallback.png') });
    await page.evaluate(() => fallbackFigure.destroy());
    assert.equal(await page.locator('#fallback-host .fishing-fish-figure-fallback').count(), 0);
    assert.deepEqual(errors, [], 'No page errors');
    assert(!warnings.some(warning => /too many active|INVALID_|shader.*error/i.test(warning)), 'No WebGL exhaustion or shader warnings');
    report = { passed: true, scope: 'Rendering checks and real visual artifacts; biological anatomy requires human review.', sourceHashes, atlasLayout, fish, angles, movie, oddMovie, feeding, cleanup, fallback, errors, warnings };
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('PASS ' + ids.length + ' live fish, animation, finite geometry, ' + angles.length + ' views, clean WebGL, matching fallback and cleanup. Artifacts: ' + output);
  } finally {
    await browser.close();
  }
}

function assertFrame(frame, label) {
  assert(frame.occupiedPixels > 100, label + ' must contain a model');
  const [left, top, right, bottom] = frame.bounds;
  assert(left >= 4 && top >= 4 && right <= frame.width - 4 && bottom <= frame.height - 4, label + ' must have transparent margins on every side: ' + JSON.stringify(frame.bounds));
}

main().catch(error => { console.error(error); console.error('Artifacts: ' + output); process.exitCode = 1; });
