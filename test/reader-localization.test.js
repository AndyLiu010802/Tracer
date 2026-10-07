'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../public/reader.js'), 'utf8');

function reader(options = {}) {
  const storage = new Map(), created = [], sent = [], writes = [], intervals = [];
  let receive, subscriptions = 0;
  if (options.language) storage.set('tracer.language', options.language);
  function element(tag) {
    const children = new Map(), attrs = new Map(), listeners = new Map(), classes = new Set();
    const el = { tagName: tag, dataset: {}, style: {}, value: '', hidden: false, textContent: '', innerHTML: '',
      classList: { add: value => classes.add(value), contains: value => classes.has(value), toggle() {} },
      getAttribute: key => attrs.get(key) ?? null, setAttribute: (key, value) => attrs.set(key, value),
      appendChild(child) { child.parentElement = el; }, insertBefore(child) { child.parentElement = el; },
      addEventListener(event, callback) { if (!listeners.has(event)) listeners.set(event, []); listeners.get(event).push(callback); },
      emit(event) { for (const fn of listeners.get(event) || []) fn({ target: el }); },
      focus() {}, select() {}, getBoundingClientRect: () => ({ x: 0, y: 0, width: 400, height: 600 }),
      querySelector(selector) {
        if (!children.has(selector)) {
          const child = element(selector); child.parentElement = el;
          if (selector === '.fx-src') {
            const input = el.innerHTML.match(/<input\b[^>]*>/)?.[0] || '';
            child.placeholder = input.match(/placeholder="([^"]*)"/)?.[1] || '';
            child.setAttribute('aria-label', input.match(/aria-label="([^"]*)"/)?.[1] || '');
          }
          if (selector === '.fx-frame') child.parentElement = el.querySelector('.fx-body');
          children.set(selector, child);
        }
        return children.get(selector);
      }
    };
    created.push(el); return el;
  }
  const slot = element('slot'), picker = element('select'), body = element('body');
  if (options.panelSource) slot.setAttribute('data-panel-source', options.panelSource);
  const observer = class { observe() {} };
  const window = { addEventListener() {}, ResizeObserver: observer };
  if (options.native !== false) window.TracerBrowser = {
    send: command => sent.push(command), onState(callback) { receive = callback; subscriptions++; }
  };
  const context = { window, location: { origin: 'http://localhost' }, ResizeObserver: observer, MutationObserver: observer,
    ConcealPolicy: require('../public/conceal-policy'),
    document: { readyState: 'complete', hidden: false, body, createElement: element,
      getElementById: id => id === 'aside-slot' ? slot : id === 'language-select' ? picker : null,
      querySelector: () => null, addEventListener() {} },
    localStorage: { getItem(key) { if (options.storageBlocked) throw new Error('unavailable'); return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, value); writes.push(key); } },
    clearTimeout() {}, setTimeout() { return 1; }, setInterval(fn) { intervals.push(fn); }, fetch() { throw new Error('No network expected'); } };
  vm.runInNewContext(source, context, { filename: 'reader.js' });
  const panel = created.find(el => el.className === 'fx-panel'), message = created.find(el => el.className === 'fx-browser-message');
  const external = created.find(el => el.dataset.act === 'external');
  return { panel, message, external, sent, writes, created, receive: data => receive(data),
    subscriptions: () => subscriptions, language(value) { storage.set('tracer.language', value); picker.emit('change'); } };
}

test('native reader defaults to English without saved language or readable storage', () => {
  for (const options of [{}, { storageBlocked: true }, { language: 'fr' }]) {
    const r = reader(options);
    assert.equal(r.panel.querySelector('.fx-title').textContent, 'Browser');
    assert.equal(r.panel.querySelector('.fx-src').placeholder, 'Enter a website address');
    assert.equal(r.message.querySelector('strong').textContent, 'Browse alongside your work');
    assert.equal(r.message.querySelector('button').textContent, 'Retry');
    assert.equal(r.message.querySelector('button').hidden, true);
  }
});

test('native labels follow language changes while preserving address, history and error state', () => {
  const r = reader(), src = r.panel.querySelector('.fx-src');
  r.receive({ url: 'https://example.test/reference', loading: true, error: '', back: true, forward: false });
  r.language('zh');
  assert.equal(r.panel.querySelector('.fx-title').textContent, '内置浏览器');
  assert.equal(src.placeholder, '输入网址'); assert.equal(src.getAttribute('aria-label'), '输入网址');
  assert.equal(r.panel.querySelector('[data-act="go"]').textContent, '打开');
  assert.equal(r.external.title, '用系统浏览器打开');
  assert.equal(r.panel.querySelector('.fx-meta').textContent, '正在加载…');
  r.receive({ error: 'ERR_CONNECTION_REFUSED (-102)', loading: false });
  const before = { sent: r.sent.length, writes: r.writes.length, nodes: r.created.length };
  r.language('en');
  assert.equal(r.message.querySelector('strong').textContent, 'This page could not load');
  assert.equal(r.message.querySelector('p').textContent, 'ERR_CONNECTION_REFUSED (-102)');
  assert.equal(r.message.querySelector('button').textContent, 'Retry');
  assert.equal(r.message.hidden, false); assert.equal(r.message.querySelector('button').hidden, false);
  assert.match(r.panel.querySelector('.fx-meta').textContent, /^Retry, or use/);
  assert.equal(src.value, 'https://example.test/reference');
  assert.equal(r.panel.querySelector('[data-act="back"]').disabled, false);
  assert.equal(r.panel.querySelector('[data-act="fwd"]').disabled, true);
  assert.deepEqual({ sent: r.sent.length, writes: r.writes.length, nodes: r.created.length }, before);
  assert.equal(r.subscriptions(), 1);
});

test('loaded and download status survive relabeling without navigation', () => {
  const r = reader({ language: 'zh' });
  r.receive({ error: '', title: 'Reference title', loading: false }); r.language('en');
  assert.equal(r.panel.querySelector('.fx-meta').textContent, 'Direct · Reference title');
  assert.equal(r.message.hidden, true);
  r.receive({ download: 'Download status from native browser', error: '' }); r.language('zh');
  assert.equal(r.panel.querySelector('.fx-meta').textContent, 'Download status from native browser');
  assert.equal(r.sent.length, 0);
});

test('reference URL override is opt-in and leaves other reader skins unchanged', () => {
  const regular = reader({ native: false }), tracer = reader({ native: false, panelSource: 'Reference URL' });
  assert.equal(regular.panel.querySelector('.fx-src').placeholder, 'fixture source');
  assert.equal(regular.panel.querySelector('.fx-src').getAttribute('aria-label'), 'fixture source');
  assert.equal(tracer.panel.querySelector('.fx-src').placeholder, 'Reference URL');
  assert.equal(tracer.panel.querySelector('.fx-src').getAttribute('aria-label'), 'Reference URL');
});
