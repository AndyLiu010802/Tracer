'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
for (const [source, target] of [
  ['public/project-deletion.js', 'skins/tracer/project-deletion.js'],
  ['public/project-deletion.js', 'wechat/miniprogram/lib/project-deletion.js'],
  ['public/project-deletion.js', 'wechat/cloudfunctions/tracer/project-deletion.js'],
  ['public/task-history.js', 'skins/tracer/task-history.js'],
  ['public/task-history.js', 'wechat/miniprogram/lib/task-history.js'],
  ['public/task-history.js', 'wechat/cloudfunctions/tracer/task-history.js'],
  ['public/task-i18n.js', 'wechat/miniprogram/lib/task-i18n.js'],
  ['public/task-i18n.js', 'skins/tracer/task-i18n.js'],
  ['public/workspace-sync.js', 'wechat/miniprogram/lib/workspace-sync.js'],
  ['public/workspace-sync.js', 'wechat/cloudfunctions/tracer/workspace-sync.js'],
  ['skins/tracer/model.js', 'wechat/miniprogram/lib/model.js'],
]) {
  const destination = path.join(root, target);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, source), destination);
}
console.log('WeChat shared modules updated.');
