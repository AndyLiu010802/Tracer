'use strict';

// Rebuild the catalogue previews from the same meshes used while fishing.
// Run: node dev/build-fishing-catalog-art.cjs
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('../.cache/desktop-qa-tools/node_modules/playwright');
const { catalog } = require('../public/fishing-model');

const root = path.resolve(__dirname, '..');
const outputDirectory = path.join(root, 'skins/tracer/fishing-art');
const sourceFiles = [
  'skins/tracer/fishing-lighting.js',
  'skins/tracer/fishing-art.js',
  'skins/tracer/fishing-rod-renderer.js',
  'public/fishing-model.js',
  'dev/build-fishing-catalog-art.cjs',
];
const sourceContents = new Map(sourceFiles.map(file => [file, fs.readFileSync(path.join(root, file))]));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sources = Object.fromEntries([...sourceContents].map(([file, bytes]) => [
  file, sha256(bytes.toString('utf8').replace(/\r\n/g, '\n')),
]));
const layouts = {
  rods: { file: 'rods-model-v1.png', columns: 5, rows: Math.ceil(catalog.rods.length / 5), cellWidth: 300, cellHeight: 500 },
  fish: { file: 'fish-model-v1.png', columns: 5, rows: Math.ceil(catalog.fish.length / 5), cellWidth: 328, cellHeight: 216 },
};

// This is deliberately a tiny renderer-only page: no application, API routes,
// workspace files, or user account data are involved in building the assets.
const documentSource = '<!doctype html><meta charset="utf-8"><title>Fishing catalogue renderer</title>' +
  '<script src="/fishing-lighting.js"></script><script src="/fishing-art.js"></script><script src="/fishing-rod-renderer.js"></script>';
const routes = new Map([
  ['/fishing-lighting.js', sourceContents.get('skins/tracer/fishing-lighting.js')],
  ['/fishing-art.js', sourceContents.get('skins/tracer/fishing-art.js')],
  ['/fishing-rod-renderer.js', sourceContents.get('skins/tracer/fishing-rod-renderer.js')],
]);
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (pathname === '/') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(documentSource);
  } else if (routes.has(pathname)) {
    response.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' });
    response.end(routes.get(pathname));
  } else {
    response.writeHead(404);
    response.end();
  }
});

async function main() {
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 2,
      serviceWorkers: 'block',
    });
    await context.route('**/*', route => {
      if (new URL(route.request().url()).origin !== origin) return route.abort();
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin, { waitUntil: 'load' });

    const rendered = await page.evaluate(({ catalog, layouts }) => {
      function host(width, height) {
        const element = document.createElement('div');
        Object.assign(element.style, {
          position: 'absolute', left: '-10000px', top: '0',
          width: width + 'px', height: height + 'px',
        });
        document.body.appendChild(element);
        return element;
      }

      function canvas(width, height) {
        const element = document.createElement('canvas');
        element.width = width;
        element.height = height;
        const context = element.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('A 2D canvas is required to capture the meshes.');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        return { element, context };
      }

      function occupied(context, x, y, width, height, label) {
        const pixels = context.getImageData(x, y, width, height).data;
        let left = width, top = height, right = -1, bottom = -1, occupiedPixels = 0;
        for (let py = 0; py < height; py++) {
          for (let px = 0; px < width; px++) {
            if (!pixels[(py * width + px) * 4 + 3]) continue;
            occupiedPixels++;
            left = Math.min(left, px);
            top = Math.min(top, py);
            right = Math.max(right, px);
            bottom = Math.max(bottom, py);
          }
        }
        if (occupiedPixels < 100) throw new Error(label + ' rendered an empty or incomplete model.');
        if (left < 2 || top < 2 || right >= width - 2 || bottom >= height - 2) {
          throw new Error(label + ' touches its canvas edge; adjust the capture to avoid clipping.');
        }
        return { bounds: [left, top, right + 1, bottom + 1], occupiedPixels };
      }

      function atlas(items, layout, element, renderer, type) {
        const width = layout.columns * layout.cellWidth;
        const height = layout.rows * layout.cellHeight;
        const output = canvas(width, height);
        const records = [];
        if (items.length > layout.columns * layout.rows || items.length <= layout.columns * (layout.rows - 1)) {
          throw new Error(type + ' catalogue changed; update the atlas layout before rebuilding.');
        }
        if (renderer.kind !== 'webgl') throw new Error(type + ' requires the live WebGL mesh renderer.');

        for (let index = 0; index < items.length; index++) {
          const item = items[index];
          renderer.update(type === 'rods' ? { rod: item, bend: 0 } : { fish: item });
          const source = element.querySelector('canvas');
          if (!source) throw new Error('No rendered canvas for ' + item.id);

          // Copy immediately after update, within this synchronous evaluate.
          // WebGL uses preserveDrawingBuffer=false, and returning control to the
          // browser before drawImage would let it clear the completed frame.
          const capture = canvas(source.width, source.height);
          capture.context.drawImage(source, 0, 0);
          const sourceStats = occupied(capture.context, 0, 0, source.width, source.height, item.id);
          const x = index % layout.columns * layout.cellWidth;
          const y = Math.floor(index / layout.columns) * layout.cellHeight;

          // Remove the live rod's bend padding or the fish camera's empty
          // viewport. Fit the entire model, including fins/reels/ornaments,
          // into a readable preview while preserving its rendered perspective
          // and aspect ratio (including naturally tall fish such as seahorses).
          const [left, top, right, bottom] = sourceStats.bounds;
          const cropWidth = right - left, cropHeight = bottom - top;
          const fit = Math.min(layout.cellWidth / cropWidth, layout.cellHeight / cropHeight) * .94;
          const drawWidth = cropWidth * fit, drawHeight = cropHeight * fit;
          output.context.drawImage(capture.element, left, top, cropWidth, cropHeight,
            x + (layout.cellWidth - drawWidth) / 2, y + (layout.cellHeight - drawHeight) / 2,
            drawWidth, drawHeight);
          const cellStats = occupied(output.context, x, y, layout.cellWidth, layout.cellHeight, item.id + ' atlas cell');
          records.push({
            id: item.id,
            bounds: cellStats.bounds.map((value, axis) => value + (axis % 2 ? y : x)),
            occupiedPixels: cellStats.occupiedPixels,
            sourceBounds: sourceStats.bounds,
          });
        }
        return {
          ...layout, width, height, renderer: renderer.kind,
          ids: items.map(item => item.id), items: records,
          png: output.element.toDataURL('image/png').split(',')[1],
        };
      }

      const rodHost = host(250.8, 418);
      const fishHost = host(656, 432);
      let rodRenderer, fishRenderer;
      try {
        rodRenderer = TracerFishingRodRenderer.create(rodHost, { rod: catalog.rods[0], bend: 0 });
        const rods = atlas(catalog.rods, layouts.rods, rodHost, rodRenderer, 'rods');
        fishRenderer = TracerFishingArt.createFishFigure(fishHost, { fish: catalog.fish[0], catalog });
        // createFishFigure starts at time=0. The entire loop is synchronous, so
        // no animation frame or offscreen IntersectionObserver can alter poses.
        const fish = atlas(catalog.fish, layouts.fish, fishHost, fishRenderer, 'fish');
        return [rods, fish];
      } finally {
        rodRenderer?.destroy();
        fishRenderer?.destroy();
        rodHost.remove();
        fishHost.remove();
      }
    }, { catalog, layouts });

    assert.deepEqual(errors, [], 'Renderer page must not have JavaScript errors.');
    const atlases = rendered.map(({ png, ...metadata }) => {
      const bytes = Buffer.from(png, 'base64');
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      assert.equal(bytes.readUInt32BE(16), metadata.width);
      assert.equal(bytes.readUInt32BE(20), metadata.height);
      return { bytes, metadata: { ...metadata, sha256: sha256(bytes) } };
    });
    // Finish all captures and validations before replacing any catalogue asset.
    fs.mkdirSync(outputDirectory, { recursive: true });
    for (const { bytes, metadata } of atlases) {
      fs.writeFileSync(path.join(outputDirectory, metadata.file), bytes);
    }
    const manifest = { version: 1, sources, atlases: atlases.map(atlas => atlas.metadata) };
    fs.writeFileSync(path.join(outputDirectory, 'catalog-model-v1.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(JSON.stringify({
      outputDirectory,
      atlases: manifest.atlases.map(({ file, width, height, items, sha256 }) => ({
        file, width, height, count: items.length, sha256,
        occupiedPixels: items.map(({ id, occupiedPixels }) => ({ id, occupiedPixels })),
        transparentPaddingVerified: true,
      })),
    }, null, 2));
  } finally {
    const cleanup = await Promise.allSettled([
      browser?.close(),
      new Promise((resolve, reject) => {
        if (!server.listening) return resolve();
        server.close(error => error ? reject(error) : resolve());
      }),
    ]);
    for (const result of cleanup) {
      if (result.status === 'rejected') console.error('Catalogue renderer cleanup failed:', result.reason);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
