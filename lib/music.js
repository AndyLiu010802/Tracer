'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const TYPES = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.flac': 'audio/flac' };

function byteRange(value, size) {
  if (!value) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!m || (!m[1] && !m[2]) || !size) return false;
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start <= end && start < size ? { start, end } : false;
}

function createMusic(root) {
  root = path.resolve(root);
  let tracks = [], checked = 0, scanning;
  async function scan(force = false) {
    if (scanning) return scanning;
    if (!force && Date.now() - checked < 5000) return tracks;
    scanning = (async () => {
      const found = [];
      async function walk(dir) {
        const entries = await fsp.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isSymbolicLink()) continue;
          const file = path.join(dir, entry.name);
          if (entry.isDirectory()) { await walk(file); continue; }
          const type = TYPES[path.extname(entry.name).toLowerCase()];
          if (!entry.isFile() || !type) continue;
          const relative = path.relative(root, file).split(path.sep).join('/');
          const id = createHash('sha256').update(relative).digest('hex').slice(0, 24);
          found.push({ id, name: relative.replace(/\.[^.]+$/, ''), url: '/api/music/' + id, file, type });
        }
      }
      try { await walk(root); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      tracks = found.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')); checked = Date.now(); return tracks;
    })();
    try { return await scanning; } finally { scanning = null; }
  }
  return async function handle(req, res, pathname) {
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('cross-origin-resource-policy', 'same-origin');
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { allow: 'GET, HEAD' }).end(); return; }
    try {
      const list = await scan(pathname === '/api/music');
      if (pathname === '/api/music') {
        const body = JSON.stringify({ tracks: list.map(({ id, name, url }) => ({ id, name, url })) });
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
        res.end(req.method === 'HEAD' ? undefined : body); return;
      }
      const item = list.find(t => pathname === '/api/music/' + t.id);
      if (!item) { res.writeHead(404).end(); return; }
      // Resolve again at playback time, so a replaced file cannot redirect outside music.
      const realRoot = await fsp.realpath(root), realFile = await fsp.realpath(item.file);
      if (!realFile.startsWith(realRoot + path.sep)) { res.writeHead(404).end(); return; }
      const stat = await fsp.stat(realFile);
      if (!stat.isFile()) { res.writeHead(404).end(); return; }
      const range = byteRange(req.headers.range, stat.size);
      if (range === false) { res.writeHead(416, { 'content-range': 'bytes */' + stat.size }).end(); return; }
      const headers = { 'content-type': item.type, 'accept-ranges': 'bytes', 'content-length': range ? range.end - range.start + 1 : stat.size };
      if (range) headers['content-range'] = 'bytes ' + range.start + '-' + range.end + '/' + stat.size;
      res.writeHead(range ? 206 : 200, headers);
      if (req.method === 'HEAD') { res.end(); return; }
      const stream = fs.createReadStream(realFile, range || {});
      stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
    } catch (e) { if (!res.headersSent) res.writeHead(e.code === 'ENOENT' ? 404 : 500).end(); else res.destroy(); }
  };
}
module.exports = { createMusic, byteRange };
