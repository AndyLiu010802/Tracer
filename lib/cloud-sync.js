'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const store = require('./store');

function endpointUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.port && url.port !== '443') ||
      !/^[a-z0-9.-]+\.(tcloudbase\.com|tcloudbaseapp\.com)$/i.test(url.hostname)) {
    throw new Error('请填写腾讯云开发控制台生成的 HTTPS 云函数访问地址');
  }
  return url.href;
}
function createBridge(dataDir, { request = fetch } = {}) {
  const secretDir = path.join(dataDir, '.sync');
  const file = path.join(secretDir, 'connection.json');
  let queue = Promise.resolve();
  function serial(fn) { const result = queue.then(fn, fn); queue = result.catch(() => {}); return result; }
  async function connection() {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  }
  async function call(config, input) {
    const response = await request(endpointUrl(config.endpoint), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { 'content-type': 'application/json', ...(config.token ? { authorization: 'Bearer ' + config.token } : {}) },
      body: JSON.stringify(input),
    });
    const text = await response.text();
    if (text.length > 1200000) throw new Error('云端响应过大');
    const result = JSON.parse(text);
    if (!result || typeof result.ok !== 'boolean') throw new Error('云函数响应格式错误，请确认 HTTP 访问配置');
    return result;
  }
  return {
    async status() { const c = await connection(); return { connected: !!c, endpoint: c ? c.endpoint : '', expiresAt: c ? c.expiresAt : null }; },
    connected: async () => !!(await connection()),
    pair: (endpoint, code) => serial(async () => {
      if (await connection()) return { ok: false, status: 409, error: '请先断开当前电脑绑定' };
      const config = { endpoint: endpointUrl(endpoint) };
      // Keep a durable snapshot before enabling cloud mode.
      const local = await store.readStore(dataDir, 'workspace');
      if (local) await store.writeStore(secretDir, 'before-pairing', JSON.stringify(local));
      const result = await call(config, { action: 'pair', code, name: require('node:os').hostname() });
      if (!result.ok) return result;
      if (!/^[a-f0-9]{48}$/.test(result.token || '') || !result.workspace) throw new Error('配对响应不完整');
      await fs.mkdir(secretDir, { recursive: true });
      const temporary = file + '.tmp';
      await fs.writeFile(temporary, JSON.stringify({ ...config, token: result.token, expiresAt: result.expiresAt }), { mode: 0o600 });
      await fs.rename(temporary, file);
      return { ok: true, workspace: result.workspace };
    }),
    disconnect: () => serial(async () => {
      const local = await store.readStore(dataDir, 'workspace');
      if (local && local.meta) {
        delete local.meta.syncAccount; delete local.meta.syncVersion;
        await store.writeStore(dataDir, 'workspace', JSON.stringify(local));
      }
      await fs.rm(file, { force: true }); return { ok: true };
    }),
    workspace: (method, workspace) => serial(async () => {
      const config = await connection();
      if (!config) return null;
      const result = await call(config, method === 'GET' || method === 'HEAD' ? { action: 'read' } : {
        action: 'write', version: workspace && workspace.meta && workspace.meta.syncVersion, workspace,
      });
      if (result.ok && result.workspace) {
        try { await store.writeStore(dataDir, 'workspace', JSON.stringify(result.workspace)); }
        catch { result.backupWarning = true; } // Cloud success must not be retried as a failed write.
      }
      return result;
    }),
  };
}
module.exports = { createBridge, endpointUrl };
