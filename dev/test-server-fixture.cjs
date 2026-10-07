'use strict';

// Execute the real server module with a synthetic source root. Dependencies
// still resolve from the checkout; filesystem operations and handlers are real.
const fs = require('node:fs');
const path = require('node:path');
const { Module, createRequire } = require('node:module');

function loadServerAtRoot(root) {
  if (!path.isAbsolute(root) || !fs.statSync(root).isDirectory()) {
    throw new Error('A synthetic absolute server root is required');
  }
  const sourceFile = path.resolve(__dirname, '..', 'server.js');
  const filename = path.join(root, 'server.js');
  const fixture = new Module(filename, module);
  fixture.filename = filename;
  fixture.paths = Module._nodeModulePaths(path.dirname(sourceFile));
  fixture.require = createRequire(sourceFile);
  fixture._compile(fs.readFileSync(sourceFile, 'utf8'), filename);
  fixture.loaded = true;
  return fixture.exports;
}

module.exports = { loadServerAtRoot };
