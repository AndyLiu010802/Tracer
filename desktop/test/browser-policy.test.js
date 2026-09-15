'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { webURL, bounds } = require('../browser-policy');

test('browser accepts direct HTTP(S) URLs and rejects executable/local schemes and credentials', () => {
  assert.equal(webURL('example.com/path'), 'https://example.com/path');
  assert.equal(webURL('https://southdevelopments.com.au/projects/napa'), 'https://southdevelopments.com.au/projects/napa');
  for (const value of ['', 'javascript:alert(1)', 'file:///C:/secret', 'data:text/html,hi', 'https://user:password@example.com', {}, null]) assert.equal(webURL(value), '');
});
test('browser view bounds scale with zoom and stay inside the application content area', () => {
  assert.deepEqual(bounds({x: 100, y: 80, width: 300, height: 500}, 1.5, [1000, 700]), {x: 150, y: 120, width: 450, height: 580});
  assert.deepEqual(bounds({x: -20, y: -10, width: 40, height: 40}, 1, [1000, 700]), {x: 0, y: 0, width: 20, height: 30});
  assert.equal(bounds({x: NaN}, 1, [1000, 700]), null);
});
