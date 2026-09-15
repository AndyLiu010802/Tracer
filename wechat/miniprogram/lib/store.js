const config = require('../config');
const S = require('./workspace-sync');
const M = require('./model');
let data = null, base = null, conflict = null, dirty = false, saving = null;
const demo = !config.envId;
const key = 'tracer-draft-' + (config.envId || 'demo');
function snapshot() { return { data: S.clone(data), dirty, conflict: !!conflict, demo }; }
function persist() {
  if (demo || dirty) wx.setStorageSync(key, { data, base });
  else wx.removeStorageSync(key);
}
async function api(action, fields) {
  if (demo) throw new Error('当前为离线演示，请先配置云开发环境');
  const response = await wx.cloud.callFunction({ name: config.functionName, data: Object.assign({ action }, fields) });
  const result = response.result;
  if (!result || typeof result.ok !== 'boolean') throw new Error('云函数响应格式错误');
  return result;
}
function fail(result) { const error = new Error(result.error || '同步失败'); error.status = result.status; return error; }
async function load() {
  if (saving || dirty) return snapshot();
  if (demo) {
    if (!data) {
      const saved = wx.getStorageSync(key);
      data = saved && saved.data || S.empty();
      base = S.clone(data);
    }
    return snapshot();
  }
  const response = await api('read');
  if (!response.ok) throw fail(response);
  if (saving || dirty) return snapshot();
  const remote = response.workspace;
  if (data && remote.meta.syncVersion < data.meta.syncVersion) return snapshot();
  if (!data) {
    const saved = wx.getStorageSync(key);
    if (saved && saved.base && saved.data && saved.base.meta.syncAccount === remote.meta.syncAccount) {
      const merged = S.merge(saved.base, saved.data, remote);
      base = merged.conflicts.length ? saved.base : S.clone(remote);
      data = merged.workspace; conflict = merged.conflicts.length ? remote : null; dirty = true;
      return snapshot();
    }
  }
  data = remote; base = S.clone(remote); return snapshot();
}
async function flush() {
  if (saving) return saving;
  if (!dirty) return snapshot();
  if (conflict) throw new Error('存在同步冲突，请在「同步与设备」中处理');
  saving = (async () => {
    if (demo) { dirty = false; base = S.clone(data); persist(); return snapshot(); }
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await api('write', { workspace: data, version: base.meta.syncVersion });
      if (response.ok) { data = response.workspace; base = S.clone(data); dirty = false; persist(); return snapshot(); }
      if (response.status !== 409 || !response.workspace) throw fail(response);
      const merged = S.merge(base, data, response.workspace);
      data = merged.workspace;
      if (merged.conflicts.length) { conflict = response.workspace; persist(); throw new Error('两端修改了相同内容，请在「同步与设备」中选择保留哪一版'); }
      base = S.clone(response.workspace); persist();
    }
    throw new Error('云端仍有新改动，请稍后重试');
  })();
  try { return await saving; } finally { saving = null; }
}
async function mutate(fn) {
  if (saving) throw new Error('正在保存，请稍等');
  if (!data) await load();
  if (!data) throw new Error('任务尚未加载');
  const next = S.clone(data);
  fn(next); data = next; dirty = true; persist(); return flush();
}
function getConflicts() { return conflict ? S.merge(base, data, conflict).conflicts : []; }
async function resolve(choices) {
  if (!conflict) return;
  const merged = S.merge(base, data, conflict, choices);
  if (merged.conflicts.length) throw new Error('请为每项冲突选择一个版本');
  base = S.clone(conflict); data = merged.workspace; conflict = null; dirty = true; persist(); return flush();
}
module.exports = { snapshot, load, mutate, flush, getConflicts, resolve, api, model: M };
