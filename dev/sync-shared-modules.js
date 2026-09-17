'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

// public/ is the source of truth for modules also served by the Tracer skin.
for (const name of ['project-deletion.js', 'task-history.js', 'task-i18n.js']) {
  fs.copyFileSync(path.join(root, 'public', name), path.join(root, 'skins', 'tracer', name));
}
console.log('Desktop shared modules updated.');
