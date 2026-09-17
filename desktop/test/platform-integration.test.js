'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { installApplicationMenu, canStartInputHook } = require('../platform-integration');

test('Mac menu supplies native editing, quitting and a working show-window action', () => {
  let menu, shown = 0, prompted = 0;
  const Menu = { buildFromTemplate: value => value, setApplicationMenu: value => { menu = value; } };
  installApplicationMenu({ platform: 'darwin', Menu, showWindow: () => shown++, enableInput: () => prompted++ });
  const entries = menu.flatMap(item => [item, ...(item.submenu || [])]);
  for (const role of ['editMenu', 'quit', 'togglefullscreen', 'close', 'minimize']) assert.ok(entries.some(item => item.role === role));
  entries.find(item => item.label?.includes('Show Tracer')).click();
  entries.find(item => item.label?.includes('Enable background')).click();
  assert.equal(shown, 1); assert.equal(prompted, 1);
  installApplicationMenu({ platform: 'win32', Menu });
  assert.equal(menu, null, 'Windows keeps its existing frameless menu behavior');
});

test('Mac input hook never starts without permission; prompting is explicit', () => {
  const prompts = [];
  const denied = { isTrustedAccessibilityClient: prompt => { prompts.push(prompt); return false; } };
  assert.equal(canStartInputHook('darwin', denied), false);
  assert.equal(canStartInputHook('darwin', denied, true), false);
  assert.deepEqual(prompts, [false, true]);
  assert.equal(canStartInputHook('darwin', { isTrustedAccessibilityClient: () => true }), true);
  assert.equal(canStartInputHook('win32', {}), true);
});
