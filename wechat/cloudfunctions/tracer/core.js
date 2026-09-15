'use strict';
const crypto = require('node:crypto');
const Sync = require('./workspace-sync');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const token = () => crypto.randomBytes(24).toString('hex');
const failure = (status, error) => ({ ok: false, status, error });
const MAX_BYTES = 512 * 1024;

function createService(repo, { now = Date.now } = {}) {
  return async function dispatch(input, identity = {}) {
    if (!input || typeof input !== 'object') return failure(400, '请求格式错误');
    const action = input.action;
    if (action === 'pair') {
      if (!/^[a-f0-9]{48}$/.test(input.code || '')) return failure(401, '配对码无效或已过期');
      const secret = token(), deviceId = hash(secret);
      return repo.transaction(async tx => {
        const pair = await tx.get('tracer_pairs', hash(input.code));
        if (!pair || pair.used || pair.expiresAt <= now()) return failure(401, '配对码无效或已过期');
        const account = await tx.get('tracer_accounts', pair.owner);
        if (!account || account.pairHash !== hash(input.code)) return failure(401, '配对码无效或已过期');
        account.devices = account.devices.filter(d => d.expiresAt > now());
        if (account.devices.length >= 10) return failure(400, '绑定设备已达上限，请先移除旧设备');
        const device = { id: deviceId, name: String(input.name || '我的电脑').slice(0, 60), createdAt: now(), expiresAt: now() + 90 * 86400000 };
        account.devices.push(device); account.pairHash = null;
        await tx.set('tracer_accounts', pair.owner, account);
        await tx.set('tracer_pairs', hash(input.code), { ...pair, used: true });
        await tx.set('tracer_devices', deviceId, { owner: pair.owner, expiresAt: device.expiresAt });
        return { ok: true, token: secret, expiresAt: device.expiresAt, workspace: account.workspace };
      });
    }
    const ownerFromWeChat = identity.openid && identity.appid ? hash(identity.appid + ':' + identity.openid) : null;
    const deviceId = /^[a-f0-9]{48}$/.test(identity.token || '') ? hash(identity.token) : null;
    if (!ownerFromWeChat && !deviceId) return failure(401, '请登录微信或重新绑定电脑');
    let validated;
    if (action === 'write') {
      try {
        if (!Number.isSafeInteger(input.version) || input.version < 0) return failure(400, '缺少同步版本');
        if (Buffer.byteLength(JSON.stringify(input.workspace)) > MAX_BYTES) return failure(413, '任务数据超过 512KB，请精简长备注后重试');
        validated = Sync.validate(input.workspace);
      } catch { return failure(400, '任务数据格式错误'); }
    }
    return repo.transaction(async tx => {
      let owner = ownerFromWeChat;
      if (!owner) {
        const device = await tx.get('tracer_devices', deviceId);
        if (!device || device.expiresAt <= now()) return failure(401, '电脑授权已过期，请重新绑定');
        owner = device.owner;
      }
      let account = await tx.get('tracer_accounts', owner);
      const isNew = !account;
      if (!account) {
        if (!ownerFromWeChat) return failure(401, '电脑已解绑');
        account = { workspace: Sync.empty(), devices: [], lastPairAt: 0 };
        account.workspace.meta.syncAccount = owner;
      }
      if (!ownerFromWeChat && !account.devices.some(d => d.id === deviceId && d.expiresAt > now())) return failure(401, '电脑已解绑');
      if (action === 'read') {
        if (isNew) await tx.set('tracer_accounts', owner, account);
        return { ok: true, workspace: account.workspace };
      }
      if (action === 'write') {
        const current = account.workspace;
        if (input.version !== current.meta.syncVersion) return { ...failure(409, '两端有新的改动，请合并后重试'), workspace: current };
        const next = require('./task-history').preserve(current, Sync.assignSequences(validated, current));
        next.meta.syncVersion = current.meta.syncVersion + 1;
        next.meta.syncAccount = owner;
        next.meta.rev = Math.max(current.meta.rev || 0, next.meta.rev || 0) + 1;
        account.workspace = next;
        await tx.set('tracer_accounts', owner, account);
        return { ok: true, workspace: next };
      }
      if (!ownerFromWeChat) return failure(403, '请在微信小程序中管理设备');
      if (action === 'devices') return { ok: true, devices: account.devices.filter(d => d.expiresAt > now()) };
      if (action === 'revoke') {
        account.devices = account.devices.filter(d => d.id !== input.id);
        await tx.set('tracer_accounts', owner, account);
        return { ok: true };
      }
      if (action === 'pairCode') {
        if (now() - account.lastPairAt < 30000) return failure(429, '请稍等 30 秒再生成新的配对码');
        const code = token(), expiresAt = now() + 5 * 60000;
        account.pairHash = hash(code); account.lastPairAt = now();
        await tx.set('tracer_accounts', owner, account);
        await tx.set('tracer_pairs', hash(code), { owner, expiresAt, used: false });
        return { ok: true, code, expiresAt };
      }
      return failure(400, '不支持的操作');
    });
  };
}
module.exports = { createService, hash };
