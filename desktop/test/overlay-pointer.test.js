'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { attachOverlayPointer } = require('../overlay-pointer');

function fixture() {
  const window = new EventEmitter(), modes = [], intervals = new Set();
  let cursor = { x: -1500, y: 0 }, bounds = { x: -1200, y: 30, width: 300, height: 200 }, visible = false, held = false;
  Object.assign(window, { isDestroyed: () => false, isVisible: () => visible, getBounds: () => bounds });
  const guard = attachOverlayPointer(window, { getCursorScreenPoint: () => cursor }, value => modes.push(value), () => held,
    { setInterval(fn) { intervals.add(fn); return fn; }, clearInterval(fn) { intervals.delete(fn); } });
  return { window, modes, intervals, guard, tick: () => intervals.forEach(fn => fn()), cursor: value => cursor = value,
    bounds: value => bounds = value, held: value => held = value, show() { visible = true; window.emit('show'); }, hide() { visible = false; window.emit('hide'); } };
}

test('native cursor recovers input with no renderer mouse events and rejects stale pass-through requests', () => {
  const f = fixture(); f.guard.update([{ x: .3, y: .1, width: .7, height: .9 }]); f.show();
  assert.equal(f.modes.at(-1), true);
  f.cursor({ x: -1000, y: 100 }); f.tick(); // No mousemove IPC or DOM event.
  assert.equal(f.modes.at(-1), false);
  f.guard.request(true); assert.equal(f.modes.at(-1), false);
  f.cursor({ x: -1180, y: 40 }); f.tick(); assert.equal(f.modes.at(-1), true);
  f.guard.destroy(); assert.equal(f.intervals.size, 0);
});

test('regions follow DIP resize and negative-monitor movement, while menus and gestures retain input', () => {
  const f = fixture(); f.guard.update([{ x: .25, y: .25, width: .5, height: .5 }]); f.show();
  f.bounds({ x: -800, y: -600, width: 600, height: 400 }); f.cursor({ x: -500, y: -400 }); f.tick();
  assert.equal(f.modes.at(-1), false);
  f.cursor({ x: 10, y: 10 }); f.held(true); f.tick(); assert.equal(f.modes.at(-1), false);
  f.held(false); f.tick(); assert.equal(f.modes.at(-1), true);
  f.hide(); assert.equal(f.intervals.size, 0); const count = f.modes.length; f.guard.poll(); assert.equal(f.modes.length, count);
  f.show(); f.show(); assert.equal(f.intervals.size, 1); f.window.emit('closed'); assert.equal(f.intervals.size, 0);
});

test('invalid regions cannot replace the last trusted geometry and reload restores input', () => {
  const f = fixture(); f.guard.update([{ x: .3, y: .1, width: .7, height: .9 }]); f.show(); f.cursor({ x: -1000, y: 100 });
  for (const value of [null, [], [{x:NaN,y:0,width:1,height:1}], [{x:-1,y:0,width:1,height:1}], [{x:0,y:0,width:2,height:1}]]) f.guard.update(value);
  f.tick(); assert.equal(f.modes.at(-1), false);
  f.guard.reset(); assert.equal(f.modes.at(-1), false); f.guard.destroy();
});
