'use strict';

// No process launcher is imported. Calling code must explicitly supply its
// trusted executor; this module cannot write a real registry by default.
const path = require('node:path');
const M = require('./local-vfx-shell-model');
const P = require('./local-vfx-shell-parents');
const EXECUTABLE = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const HELPER = path.resolve(__dirname, 'local-vfx-shell-registry.ps1');
const MAX_OUTPUT = 1048576;
const ERRORS = new Set(['registry-read-failed', 'registry-access-denied', 'registry-parent-missing', 'local-menu-conflict', 'local-menu-rollback-blocked', 'registry-operation-failed', 'registry-protocol-invalid']);
const fail = code => { throw new Error(code); };
const own = (object, name) => Object.prototype.hasOwnProperty.call(object, name);
const clone = value => value === null ? null : JSON.parse(JSON.stringify(value));
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

function createRegistration({ app, profile, platform, launch, execute, userData } = {}) {
  // The model mints the only permitted keys and quoted commands. A copied,
  // forged or caller-supplied registry plan never authorizes this adapter.
  const plan = M.buildPlan({ app, profile, platform, launch });
  if (typeof execute !== 'function') fail('registry-executor-required');
  const entries = new Map();
  for (const entry of plan.entries) {
    entries.set(entry.key, { entry, values: entry.parent.values, children: ['command'] });
    entries.set(entry.command.key, { entry, values: entry.command.values, children: [] });
  }
  const observed = new Map();
  let lastFailure = null;

  function decodeNode(key, result) {
    if (result.present === false) {
      if (own(result, 'node') && result.node !== null) fail('registry-protocol-invalid');
      return null;
    }
    if (result.present !== true || !plain(result.node) || !Array.isArray(result.node.values) || !Array.isArray(result.node.children)) fail('registry-protocol-invalid');
    const context = entries.get(key), node = result.node;
    const children = new Set();
    for (const child of node.children) {
      if (typeof child !== 'string' || !child || child.length > 255 || /[\\\x00-\x1f]/.test(child) || children.has(child.toLowerCase())) fail('registry-protocol-invalid');
      children.add(child.toLowerCase());
      if (!context.children.includes(child)) fail('local-menu-conflict');
    }
    const names = new Set();
    const values = {};
    for (const value of node.values) {
      if (!plain(value) || Object.keys(value).sort().join(',') !== 'data,kind,name' || typeof value.name !== 'string') fail('registry-protocol-invalid');
      const name = value.name;
      if (name.length > 16383 || /[\x00-\x1f]/.test(name) || names.has(name.toLowerCase())) fail('registry-protocol-invalid');
      names.add(name.toLowerCase());
      if (!own(context.values, name)) fail('local-menu-conflict');
      if (value.kind !== 'String' || typeof value.data !== 'string' || value.data.length > 30000) fail('local-menu-conflict');
      values[name] = { kind: value.kind, data: value.data };
    }
    if (Object.keys(node).sort().join(',') !== 'children,values') fail('registry-protocol-invalid');
    return { values, children: [...node.children] };
  }

  // Array records preserve the unnamed registry value in Windows PowerShell
  // 5.1, where ConvertFrom-Json cannot reliably represent an empty property.
  function wireNode(node) {
    return node === null ? null : { values: Object.entries(node.values).map(([name, value]) => ({ name, ...value })), children: [...node.children] };
  }

  function invoke(action, key, more = {}) {
    if (!(entries.has(key) && ['read', 'write', 'remove'].includes(action)) && !(P.PARENTS.includes(key) && ['parent-read', 'parent-create', 'parent-remove'].includes(action))) fail('registry-protocol-invalid');
    const request = { version: 1, action, key, launch: plan.launch, ...more };
    let output;
    try {
      output = execute(EXECUTABLE, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', HELPER], {
        shell: false, windowsHide: true, encoding: 'utf8', timeout: 5000, maxBuffer: MAX_OUTPUT,
        input: JSON.stringify(request)
      });
    } catch { fail('registry-operation-failed'); }
    if (!plain(output) || output.error || output.signal || output.status !== 0 || typeof output.stdout !== 'string' || Buffer.byteLength(output.stdout, 'utf8') > MAX_OUTPUT) fail('registry-operation-failed');
    let result;
    try { result = JSON.parse(output.stdout.replace(/^\uFEFF/, '')); } catch { fail('registry-protocol-invalid'); }
    if (!plain(result) || typeof result.ok !== 'boolean') fail('registry-protocol-invalid');
    if (result.ok !== true) {
      lastFailure = ERRORS.has(result.error) ? result.error : 'registry-operation-failed';
      if (action === 'parent-remove' && ERRORS.has(result.error)) {
        // A fixed-helper error is emitted after its transaction is closed.
        // Retain the recorded token for a retry; an unknown executor/protocol
        // outcome still revokes authority in the parent lifecycle.
        const error = Error(lastFailure); error.parentRollback = true; throw error;
      }
      fail(lastFailure);
    }
    return result;
  }
  function call(action, key, more) { return decodeNode(key, invoke(action, key, more)); }
  const parents = userData === undefined ? null : P.createParentLifecycle({
    launch: plan.launch,
    store: P.createReceiptStore(userData, plan.launch),
    parentRegistry: {
      read(key, token) {
        const result = invoke('parent-read', key, token ? { token } : {});
        if (result.present === false && result.node === null) return null;
        if (result.present !== true || !plain(result.node) || Object.keys(result.node).sort().join(',') !== 'childCount,owned,valueCount') fail('registry-protocol-invalid');
        return result.node;
      },
      createEmpty(key, token) {
        const result = invoke('parent-create', key, { token });
        if (Object.keys(result).sort().join(',') !== 'created,disposition,ok') fail('registry-protocol-invalid');
        return { created: result.created, disposition: result.disposition };
      },
      removeEmpty(key, token) {
        const result = invoke('parent-remove', key, { token });
        if (Object.keys(result).sort().join(',') === 'ok,removed') return { removed: result.removed };
        if (Object.keys(result).sort().join(',') === 'ok,reason,removed') return { removed: result.removed, reason: result.reason };
        fail('registry-protocol-invalid');
      }
    }
  });

  function equalNode(a, b) {
    if (a === null || b === null) return a === b;
    const names = Object.keys(a.values).sort(), other = Object.keys(b.values).sort();
    return JSON.stringify(names) === JSON.stringify(other) && names.every(name => a.values[name].kind === b.values[name].kind && a.values[name].data === b.values[name].data) && JSON.stringify([...a.children].sort()) === JSON.stringify([...b.children].sort());
  }

  const registry = {
    read(key) {
      const node = call('read', key);
      observed.set(key, node);
      return node === null ? null : { values: Object.fromEntries(Object.entries(node.values).map(([name, value]) => [name, value.data])), children: [...node.children] };
    },
    write(key, values) {
      const context = entries.get(key);
      if (!context || !observed.has(key) || !plain(values) || JSON.stringify(Object.keys(values).sort()) !== JSON.stringify(Object.keys(context.values).sort()) || Object.keys(values).some(name => values[name] !== context.values[name])) fail('local-menu-conflict');
      const before = observed.get(key);
      const desired = { values: Object.fromEntries(Object.entries(values).map(([name, data]) => [name, { kind: 'String', data }])), children: before?.children || [] };
      const receipt = call('write', key, { expected: wireNode(before), values: wireNode(desired).values });
      const actual = call('read', key);
      if (!equalNode(receipt, desired) || !equalNode(actual, desired)) fail('local-menu-rollback-blocked');
      observed.set(key, actual);
    },
    remove(key) {
      if (!observed.has(key)) fail('local-menu-conflict');
      const before = observed.get(key);
      if (!before || before.children.length) fail('local-menu-conflict');
      const context = entries.get(key);
      const expectedValues = { values: Object.fromEntries(Object.entries(context.values).map(([name, data]) => [name, { kind: 'String', data }])), children: [] };
      if (!equalNode(before, expectedValues)) fail('local-menu-conflict');
      const receipt = call('remove', key, { expected: wireNode(before) });
      const actual = call('read', key);
      if (receipt !== null || actual !== null) fail('local-menu-rollback-blocked');
      observed.set(key, null);
    }
  };

  function status() {
    try {
      const actions = [];
      for (const entry of plan.entries) {
        const parent = call('read', entry.key), child = call('read', entry.command.key);
        const wantedParent = { values: Object.fromEntries(Object.entries(entry.parent.values).map(([name, data]) => [name, { kind: 'String', data }])), children: ['command'] };
        const wantedChild = { values: Object.fromEntries(Object.entries(entry.command.values).map(([name, data]) => [name, { kind: 'String', data }])), children: [] };
        if (parent === null && child === null) actions.push({ action: entry.action, registered: false });
        else if (equalNode(parent, wantedParent) && equalNode(child, wantedChild)) actions.push({ action: entry.action, registered: true });
        else fail('local-menu-conflict');
      }
      return { ok: true, registered: actions.every(entry => entry.registered), entries: actions, ...(parents ? { parents: parents.status(), parentsPending: parents.pending() } : {}) };
    } catch (error) { return { ok: false, error: ERRORS.has(error.message) || error.message.startsWith('parents-') ? error.message : 'registry-operation-failed' }; }
  }

  function apply(mode) {
    lastFailure = null;
    const result = M[mode](plan, registry);
    // The pure model handles cross-key rollback. Preserve its blocked outcome;
    // surface a missing shared parent only when all attempted work was undone.
    if (!result.ok && result.error !== 'local-menu-rollback-blocked' && lastFailure === 'registry-parent-missing') return { ...result, error: lastFailure };
    return result;
  }
  function lifecycleApply(mode) {
    if (!parents) return apply(mode); // Legacy pure mocks have no filesystem.
    try {
      return parents.exclusive(() => {
        // Validate all owned menu keys before creating any shared ancestor.
        const before = status(); if (!before.ok) return before;
        if (mode === 'install') {
          const prepared = parents.prepare(); if (!prepared.ok) return { ...prepared, mode };
          let result;
          try { result = apply(mode); } catch (error) { result = { ok: false, mode, error: ERRORS.has(error.message) ? error.message : 'local-menu-operation-failed' }; }
          if (!result.ok) {
            // Only this invocation's newly created ancestors can be rolled back.
            const rollback = parents.cleanup(prepared.created);
            return { ...result, parents: rollback, ...(rollback.ok && rollback.complete ? {} : { error: 'local-menu-rollback-blocked' }) };
          }
          return { ...result, parents: { created: prepared.created } };
        }
        const result = apply(mode); if (!result.ok) return result;
        const cleanup = parents.cleanup();
        return { ...result, parents: cleanup, ...(cleanup.ok ? {} : { ok: false, error: cleanup.error }) };
      });
    } catch (error) { return { ok: false, mode, error: ERRORS.has(error.message) || error.message.startsWith('parents-') ? error.message : 'registry-operation-failed' }; }
  }
  return Object.freeze({ plan, install: () => lifecycleApply('install'), remove: () => lifecycleApply('remove'), status });
}

module.exports = { createRegistration, EXECUTABLE };
