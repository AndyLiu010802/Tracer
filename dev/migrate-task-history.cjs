'use strict';
// Run with the workspace service stopped. Adds history only; keeps all task fields.
const fs = require('node:fs/promises');
const path = require('node:path');
const H = require('../public/task-history');
const store = require('../lib/store');
(async () => {
  const root = path.resolve(__dirname, '..'), dir = path.resolve(process.argv[2] || path.join(root, 'data'));
  if (!dir.startsWith(root + path.sep)) throw new Error('Migration must target this project workspace');
  const ws = await store.readStore(dir, 'workspace');
  if (!ws || !Array.isArray(ws.tasks)) { console.log('No task workspace to migrate'); return; }
  const before = JSON.stringify(ws), historyBefore = (ws.completionHistory || []).length;
  // An existing timestamp in the current saved workspace is the only basis for migration.
  H.ensure(ws);
  if (JSON.stringify(ws) === before) { console.log('History already up to date'); return; }
  const backup = path.join(root, '.cache', 'history-migration-' + Date.now() + '-' + path.basename(dir) + '.json');
  await fs.writeFile(backup, before, { flag: 'wx' });
  await store.writeStore(dir, 'workspace', JSON.stringify(ws), H.preserve);
  const after = await store.readStore(dir, 'workspace');
  const original = JSON.parse(before), comparable = { ...after }; delete comparable.completionHistory; delete original.completionHistory;
  if (JSON.stringify(comparable) !== JSON.stringify(original)) throw new Error('Unexpected change outside history');
  console.log(JSON.stringify({ added: after.completionHistory.length - historyBefore, tasks: after.tasks.length, taskDataUnchanged: true, backup }));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
