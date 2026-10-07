'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { attachShellMenu, CHANNEL } = require('../desktop/local-vfx-shell-entry');
const M = require('../desktop/local-vfx-shell-model');

function fixture(overrides = {}) {
  const main = new EventEmitter(), handlers = new Map(), calls = [];
  main.isDestroyed = () => !!main.destroyed;
  main.webContents = { mainFrame: { url: 'http://127.0.0.1:12345/' } };
  const ipcMain = { handle: (key, fn) => handlers.set(key, fn), removeHandler: key => handlers.delete(key) };
  let registered = false;
  const menu = { status: () => { calls.push('status'); return { ok: true, registered, entries: M.ACTIONS.map(action => ({ action, registered })) }; },
    install: () => { calls.push('install'); registered = true; return { ok: true, mode: 'install' }; },
    remove: () => { calls.push('remove'); registered = false; return { ok: true, mode: 'remove' }; } };
  const entry = attachShellMenu(main, { app: { isPackaged: false }, profile: { channel: 'local' }, platform: 'win32',
    origin: 'http://127.0.0.1:12345', userData: 'C:\\Synthetic Menu Profile', ipcMain,
    execute: () => { throw Error('no real child process is permitted'); },
    registrationFactory: options => { calls.push(['factory', options]); return menu; }, ...overrides });
  return { main, handlers, calls, menu, entry, event: { sender: main.webContents, senderFrame: main.webContents.mainFrame } };
}

test('entry is lazy and trusted requests reach install/status/remove with a fixed launch and profile', async () => {
  const h = fixture();
  assert.deepEqual(h.calls, []);
  assert(h.handlers.has(CHANNEL));
  let result = await h.entry.request(h.event, { action: 'status' });
  assert.equal(result.registered, false);
  const options = h.calls[0][1];
  assert.deepEqual(options.launch, M.fixedSourceLaunch());
  assert.equal(options.userData, 'C:\\Synthetic Menu Profile');
  result = await h.entry.request(h.event, { action: 'install' });
  assert.equal(result.registered, true);
  assert.equal(result.operation.mode, 'install');
  result = await h.entry.request(h.event, { action: 'remove' });
  assert.equal(result.registered, false);
  assert.deepEqual(h.calls.slice(1), ['status', 'install', 'status', 'remove', 'status']);
  h.main.emit('closed'); h.entry.destroy();
  assert.equal(h.handlers.size, 0);
  assert.equal((await h.entry.request(h.event, { action: 'install' })).error, 'local-menu-forbidden');
});

test('entry rejects child frames, other windows, navigated pages and disallowed profiles without creating a capability', async () => {
  for (const changes of [{ platform: 'darwin' }, { app: { isPackaged: true } }, { profile: { channel: 'commercial' } }]) {
    const h = fixture(changes);
    assert.equal((await h.entry.request(h.event, { action: 'install' })).error, 'local-menu-forbidden');
    assert.deepEqual(h.calls, []);
  }
  const h = fixture();
  for (const event of [null, {}, { sender: {}, senderFrame: h.event.senderFrame },
    { sender: h.event.sender, senderFrame: { url: h.event.senderFrame.url } }]) {
    assert.equal((await h.entry.request(event, { action: 'install' })).error, 'local-menu-forbidden');
  }
  h.event.senderFrame.url += 'r/document';
  assert.equal((await h.entry.request(h.event, { action: 'remove' })).error, 'local-menu-forbidden');
  assert.deepEqual(h.calls, []);
});

test('entry rejects arbitrary keys, commands, getters, inherited actions and arguments before capability creation', async () => {
  const h = fixture(); let getterCalls = 0;
  for (const request of [null, [], { action: 'write' }, { action: 'install', key: 'HKLM\\Anything' },
    { action: 'install', launch: { executable: 'C:\\Other.exe' } }, { action: 'remove', command: 'bad' },
    Object.create({ action: 'install' }), { get action() { getterCalls++; return 'install'; } },
    { action: 'install', [Symbol('hidden')]: true }]) {
    assert.equal((await h.entry.request(h.event, request)).error, 'local-menu-invalid-request');
  }
  assert.equal(getterCalls, 0);
  assert.deepEqual(h.calls, []);
});

test('entry preserves conflict and rollback outcomes and sanitizes unexpected exceptions', async () => {
  const h = fixture();
  h.menu.install = () => ({ ok: false, error: 'local-menu-conflict' });
  assert.equal((await h.entry.request(h.event, { action: 'install' })).error, 'local-menu-conflict');
  h.menu.remove = () => ({ ok: false, error: 'local-menu-rollback-blocked' });
  assert.equal((await h.entry.request(h.event, { action: 'remove' })).error, 'local-menu-rollback-blocked');
  h.menu.status = () => { throw Error('private path or provider diagnostics'); };
  assert.deepEqual(await h.entry.request(h.event, { action: 'status' }), { ok: false, error: 'registry-operation-failed' });
});

function settingsFixture(language = 'en') {
  const controls = new Map(), calls = [], menuCalls = [];
  const settings = { enabled: false, effect: 'haunt', strength: 0.35, atmosphere: true, size: 100, motion: 'normal' };
  const state = { ok: true, allowed: true, settings, effects: [{ id: 'haunt', name: 'Haunt' }], assetsReady: true, active: false, placing: false, notice: '' };
  let registered = false, openHandler, dialog;
  const button = () => ({ hidden: false, disabled: false, checked: false, value: '', textContent: '', listeners: new Map(),
    addEventListener(name, fn) { this.listeners.set(name, fn); }, append() {} });
  const top = { querySelector: () => null, append: value => { top.button = value; } };
  const document = { documentElement: { lang: language }, body: { append(value) { dialog = value; } },
    querySelector: () => top, createElement(kind) {
      if (kind !== 'dialog') return button();
      const value = { open: false, showModal() { this.open = true; }, querySelector(selector) { return controls.get(selector); } };
      Object.defineProperty(value, 'innerHTML', { set(html) { value.html = html; for (const [, id] of html.matchAll(/id="([^"]+)"/g)) controls.set('#' + id, button()); } });
      return value;
    } };
  const bridge = { request: async value => { calls.push({ ...value }); return state; },
    requestMenu: async value => { menuCalls.push({ ...value }); if (value.action === 'install') registered = true; if (value.action === 'remove') registered = false;
      return { ok: true, allowed: true, registered, entries: M.ACTIONS.map(action => ({ action, registered })) }; },
    onOpen: fn => { openHandler = fn; return () => {}; }, onState: () => () => {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../skins/tracer/local-vfx/entry.js'), 'utf8'), {
    window: { TracerLocalVfx: bridge }, document, MutationObserver: class { observe() {} disconnect() {} }, addEventListener() {} });
  return { controls, calls, menuCalls, state, bridge, open: () => openHandler(), dialog: () => dialog };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('settings exposes explicit registration and reversible removal without changing disabled playback', async () => {
  const h = settingsFixture(); await flush();
  assert.deepEqual(h.menuCalls, []);
  h.open(); await flush();
  assert.deepEqual(h.menuCalls, [{ action: 'status' }]);
  assert.equal(h.controls.get('#local-vfx-play').disabled, true);
  assert(!h.dialog().html.includes('position pending'));
  assert(!h.dialog().html.includes('original invocation position is not connected'));
  assert(h.dialog().html.includes('Release, then click to choose a point'));
  h.controls.get('#local-vfx-menu-install').onclick(); await flush();
  assert.equal(h.menuCalls.at(-1).action, 'install');
  assert.equal(h.controls.get('#local-vfx-menu-install').disabled, true);
  assert.equal(h.controls.get('#local-vfx-menu-remove').disabled, false);
  h.controls.get('#local-vfx-menu-remove').onclick(); await flush();
  assert.equal(h.menuCalls.at(-1).action, 'remove');
  assert(h.calls.every(value => value.action === 'status'));
  assert.equal(h.state.settings.enabled, false);
});

test('settings presents the required Chinese point-selection label and keeps failed registration recoverable', async () => {
  const h = settingsFixture('zh-CN'); await flush(); h.open(); await flush();
  assert(h.dialog().html.includes('释放后点击选点'));
  h.bridge.requestMenu = async value => { h.menuCalls.push({ ...value }); return value.action === 'install'
    ? { ok: false, error: 'local-menu-rollback-blocked' } : { ok: true, registered: false, entries: [] }; };
  h.controls.get('#local-vfx-menu-install').onclick(); await flush();
  assert.match(h.controls.get('#local-vfx-menu-status').textContent, /回滚/);
  assert.equal(h.controls.get('#local-vfx-menu-remove').disabled, false);
  assert.equal(h.controls.get('#local-vfx-play').disabled, true);
});

test('settings permits later cleanup when menu removal preserved recorded shared parents', async () => {
  const h = settingsFixture(); await flush();
  h.bridge.requestMenu = async () => ({ ok: true, registered: false, entries: [], parentsPending: true });
  h.open(); await flush();
  assert.equal(h.controls.get('#local-vfx-menu-remove').disabled, false);
  assert.match(h.controls.get('#local-vfx-menu-status').textContent, /shared keys remain/);
  assert.equal(h.state.settings.enabled, false);
});
