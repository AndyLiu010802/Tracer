'use strict';
// Read-only audit: never follows symlinks/junctions or opens file contents.
const fs = require('node:fs/promises');
const path = require('node:path');
const categories = { '.cache': 'cache-and-review-artifacts', '.worktrees': 'registered-worktrees', dist: 'build-output', '.git': 'git-history', node_modules: 'dependencies', skins: 'current-and-source-assets', music: 'audio-assets', data: 'user-data', design: 'design-sources', docs: 'documentation-and-previews', output: 'generated-output' };
async function audit(root) {
  root = path.resolve(root);
  const totals = new Map(), largest = [], skipped = [], errors = [];
  async function walk(folder, group) {
    let entries;
    try { entries = await fs.readdir(folder, { withFileTypes: true }); }
    catch (error) { errors.push({ path: path.relative(root, folder), code: error.code }); return; }
    for (const entry of entries) {
      const file = path.join(folder, entry.name), relative = path.relative(root, file);
      const bucket = group || (entry.isDirectory() ? entry.name : '(root-files)');
      if (entry.isSymbolicLink()) { skipped.push(relative); continue; }
      if (entry.isDirectory()) { await walk(file, bucket); continue; }
      if (!entry.isFile()) { skipped.push(relative); continue; }
      try {
        const stat = await fs.lstat(file);
        if (!stat.isFile() || stat.isSymbolicLink()) { skipped.push(relative); continue; }
        const total = totals.get(bucket) || { path: bucket, category: categories[bucket] || 'source-or-project-files', bytes: 0, files: 0 };
        total.bytes += stat.size; total.files++; totals.set(bucket, total);
        largest.push({ path: relative, bytes: stat.size });
        largest.sort((a, b) => b.bytes - a.bytes); if (largest.length > 25) largest.pop();
      } catch (error) { errors.push({ path: relative, code: error.code }); }
    }
  }
  await walk(root, null);
  const directories = [...totals.values()].sort((a, b) => b.bytes - a.bytes);
  return { root, measuredAt: new Date().toISOString(), measurement: 'logical-file-bytes; not disk allocation; hard links may be counted more than once', totalBytes: directories.reduce((sum, row) => sum + row.bytes, 0), directories, largestFiles: largest, skippedLinksOrSpecialFiles: skipped, errors, complete: errors.length === 0, deletionPerformed: false };
}
if (require.main === module) audit(path.resolve(__dirname, '..')).then(result => { process.stdout.write(JSON.stringify(result, null, 2) + '\n'); if (!result.complete) process.exitCode = 1; }).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { audit };
