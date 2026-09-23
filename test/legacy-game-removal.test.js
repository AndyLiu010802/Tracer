'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-game-removal-'));
process.env.DOCS_PORTAL_SKIN = 'db-console';
process.env.DOCS_PORTAL_STATE_FILE = path.join(tmp, 'bookmarks.json');
process.env.DOCS_PORTAL_DATA_DIR = path.join(tmp, 'data');
// Even an old environment override must not re-enable the retired fallback.
process.env.DOCS_PORTAL_GAME_DIR = path.join(tmp, 'legacy');
const assets = ['farm.js', 'farm-data.js', 'farm.css', 'fishing.js', 'combat.js',
  'equip.js', 'mining.js', 'magic.js', 'hero.webp', 'arena.webp',
  'fish/carp.webp', 'scenes/temp_lake.webp', 'mobs/deadlock.webp',
  'mats/lock_fang.webp', 'equip/wpn1.webp'];
for (const asset of assets) {
  const file = path.join(process.env.DOCS_PORTAL_GAME_DIR, asset);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'retired-game-fixture');
}

const { server } = require('../server');
let origin;
test.before(() => new Promise(resolve => server.listen(0, '127.0.0.1', () => {
  origin = 'http://127.0.0.1:' + server.address().port;
  resolve();
})));
test.after(() => new Promise(resolve => server.close(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  resolve();
})));

test('db-console serves its console without retired game entry points', async () => {
  const response = await fetch(origin);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.doesNotMatch(html, /data-sec="queues"|\/(?:farm(?:-data)?|fishing|combat|equip|mining|magic)\.(?:js|css)/);
  assert.match(html, /data-sec="tables"/);
  for (const file of ['content.js', 'skin.css']) {
    const response = await fetch(origin + '/' + file);
    assert.equal(response.status, 200, file);
    assert.doesNotMatch(await response.text(), /DBFarm|farm\.js|farm\.css/);
  }
});

test('retired assets are absent and cannot be restored by the old fallback setting', async () => {
  for (const asset of assets) {
    assert.equal(fs.existsSync(path.join(__dirname, '../skins/db-console', asset)), false, asset);
    assert.equal((await fetch(origin + '/' + asset)).status, 404, asset);
  }
});
