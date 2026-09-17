(function (root, factory) {
  var api = factory(typeof module === 'object' && module.exports ? require('./task-history') : root.TaskHistory,
    typeof module === 'object' && module.exports ? require('./project-deletion') : root.ProjectDeletion,
    typeof module === 'object' && module.exports ? require('./companion-work') : root.TracerCompanionWork);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WorkspaceSync = api;
})(typeof self !== 'undefined' ? self : this, function (History, Deletion, CompanionWork) {
  'use strict';
  var collections = ['tasks', 'projects', 'notes', 'inbox'];
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function empty() { return { tasks: [], projects: [], notes: [], inbox: [], meta: { seqCounter: 0, rev: 0, syncVersion: 0 } }; }
  function equal(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    var ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every(function (k, i) { return k === kb[i] && equal(a[k], b[k]); });
  }
  function safeKey(k) { return k !== '__proto__' && k !== 'prototype' && k !== 'constructor'; }
  function merge(base, local, remote, choices) {
    base = base || empty(); local = local || empty(); remote = remote || empty();
    var deletions = Deletion.merge(base, local, remote);
    if (deletions.length) {
      base = Deletion.apply(Object.assign(clone(base), { projectDeletions: deletions }));
      local = Deletion.apply(Object.assign(clone(local), { projectDeletions: deletions }));
      remote = Deletion.apply(Object.assign(clone(remote), { projectDeletions: deletions }));
    }
    var out = empty(), conflicts = [];
    collections.forEach(function (name) {
      var bm = Object.create(null), lm = Object.create(null), rm = Object.create(null);
      (base[name] || []).forEach(function (x) { bm[x.id] = x; });
      (local[name] || []).forEach(function (x) { lm[x.id] = x; });
      (remote[name] || []).forEach(function (x) { rm[x.id] = x; });
      var ids = Object.keys(rm).concat(Object.keys(lm).filter(function (id) { return !rm[id]; }));
      function choose(id, field, b, l, r) {
        if (equal(l, r)) return clone(l);
        if (equal(l, b)) return clone(r);
        if (equal(r, b)) return clone(l);
        var key = name + '/' + id + '/' + field;
        var choice = choices && choices[key];
        if (!choice) conflicts.push({ key: key, collection: name, id: id, field: field,
          title: (lm[id] || rm[id] || bm[id]).title || (lm[id] || rm[id] || bm[id]).name || id,
          local: clone(l), remote: clone(r) });
        return clone(choice === 'remote' ? r : l);
      }
      ids.forEach(function (id) {
        var b = bm[id], l = lm[id], r = rm[id], value;
        if (!l || !r || !b) value = choose(id, 'record', b, l, r);
        else {
          value = { id: id };
          var fields = Object.keys(b).concat(Object.keys(l), Object.keys(r));
          fields.filter(function (k, i) { return safeKey(k) && k !== 'id' && fields.indexOf(k) === i; }).forEach(function (k) {
            if (name === 'tasks' && (k === 'status' || k === 'doneAt')) return;
            if (name === 'tasks' && k === 'updatedAt') { value[k] = Math.max(l[k] || 0, r[k] || 0); return; }
            var v = choose(id, k, b[k], l[k], r[k]);
            if (v !== undefined) value[k] = v;
          });
          if (name === 'tasks') {
            var pair = choose(id, 'status', { status: b.status, doneAt: b.doneAt }, { status: l.status, doneAt: l.doneAt }, { status: r.status, doneAt: r.doneAt });
            value.status = pair.status; value.doneAt = pair.doneAt;
          }
        }
        if (value) out[name].push(value);
      });
    });
    out.meta = Object.assign({}, remote.meta, {
      seqCounter: Math.max((local.meta || {}).seqCounter || 0, (remote.meta || {}).seqCounter || 0),
      rev: Math.max((local.meta || {}).rev || 0, (remote.meta || {}).rev || 0),
    });
    var receipts = CompanionWork.mergeReceipts((base.meta || {}).companionReceipts, (local.meta || {}).companionReceipts, (remote.meta || {}).companionReceipts);
    if (receipts.length) out.meta.companionReceipts = receipts;
    var history = History.union(History.all(base), History.all(remote), History.all(local));
    if (history.length) out.completionHistory = history;
    if (deletions.length) out.projectDeletions = Deletion.merge(base, local, remote);
    Deletion.apply(out);
    return { workspace: out, conflicts: conflicts };
  }
  // Normalize only known fields before workspace persistence; never accept arbitrary object keys.
  function validate(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid workspace');
    var output = empty();
    if (input.projectDeletions !== undefined) output.projectDeletions = Deletion.validate(input.projectDeletions);
    if (input.completionHistory !== undefined) output.completionHistory = History.validate(input.completionHistory);
    var textFields = { tasks: ['seq', 'title', 'notes', 'projectId', 'priority', 'scheduled', 'due', 'status', 'assignee', 'acceptance', 'type'],
      projects: ['name', 'color', 'status', 'start', 'end'], notes: ['title', 'body', 'projectId'], inbox: ['text'] };
    collections.forEach(function (name) {
      if (!Array.isArray(input[name]) || input[name].length > 2000) throw new Error('Invalid ' + name);
      var seen = Object.create(null);
      output[name] = input[name].map(function (item) {
        if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id) || seen[item.id]) throw new Error('Invalid record ID');
        seen[item.id] = true;
        var record = { id: item.id };
        textFields[name].forEach(function (key) {
          if (item[key] === undefined) return;
          if (item[key] !== null && (typeof item[key] !== 'string' || item[key].length > 100000)) throw new Error('Invalid ' + key);
          record[key] = item[key];
        });
        ['createdAt', 'updatedAt', 'doneAt', 'order'].forEach(function (key) {
          if (item[key] === undefined) return;
          if (item[key] !== null && (typeof item[key] !== 'number' || !Number.isFinite(item[key]))) throw new Error('Invalid ' + key);
          record[key] = item[key];
        });
        if (name === 'tasks') {
          if (!record.title || !record.title.trim() || ['todo', 'doing', 'review', 'done'].indexOf(record.status) < 0) throw new Error('Invalid task');
          if (record.status !== 'done') record.doneAt = null;
          ['scheduled', 'due'].forEach(function (key) { if (record[key] && !validDate(record[key])) throw new Error('Invalid date'); });
          if (record.priority && ['low', 'medium', 'high', 'urgent'].indexOf(record.priority) < 0) throw new Error('Invalid priority');
          if (record.type && ['task', 'bug', 'feature', 'research'].indexOf(record.type) < 0) throw new Error('Invalid task type');
          ['estimate', 'spent'].forEach(function (key) {
            if (item[key] === undefined) return;
            if (item[key] !== null && (typeof item[key] !== 'number' || !Number.isFinite(item[key]) || item[key] < 0 || item[key] > 100000)) throw new Error('Invalid hours');
            record[key] = item[key];
          });
          ['labels', 'links', 'dependsOn'].forEach(function (key) {
            if (item[key] === undefined) return;
            if (!Array.isArray(item[key]) || item[key].length > 100 || item[key].some(function (v) { return typeof v !== 'string' || !v.trim() || v.length > (key === 'links' ? 2048 : 100); })) throw new Error('Invalid ' + key);
            if (key === 'links' && item[key].some(function (v) { return !/^https?:\/\/[^\s]+$/i.test(v); })) throw new Error('Invalid resource link');
            record[key] = item[key].filter(function (v, i, a) { return a.indexOf(v) === i; });
          });
          if (item.checklist !== undefined) {
            var checkIds = Object.create(null);
            if (!Array.isArray(item.checklist) || item.checklist.length > 100) throw new Error('Invalid checklist');
            record.checklist = item.checklist.map(function (c) {
              if (!c || typeof c.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(c.id) || checkIds[c.id] || typeof c.text !== 'string' || !c.text.trim() || c.text.length > 1000 || typeof c.done !== 'boolean') throw new Error('Invalid checklist');
              checkIds[c.id] = true; return { id: c.id, text: c.text, done: c.done };
            });
          }
        }
        if (name === 'projects' && !/^#[0-9a-fA-F]{6}$/.test(record.color || '')) record.color = '#7c8fe8';
        if (name === 'notes') record.pinned = !!item.pinned;
        return record;
      });
    });
    var tasks = Object.create(null), visited = Object.create(null), active = Object.create(null);
    output.tasks.forEach(function (t) { tasks[t.id] = t; });
    function visit(id) {
      if (!tasks[id] || active[id]) throw new Error('Invalid dependency');
      if (visited[id]) return;
      active[id] = true;
      (tasks[id].dependsOn || []).forEach(visit);
      active[id] = false; visited[id] = true;
    }
    output.tasks.forEach(function (t) { visit(t.id); });
    ['rev', 'seqCounter', 'syncVersion'].forEach(function (key) {
      var n = input.meta && input.meta[key];
      output.meta[key] = Number.isSafeInteger(n) && n >= 0 ? n : 0;
    });
    var receipts = CompanionWork.validateReceipts(input.meta && input.meta.companionReceipts);
    if (receipts.length) output.meta.companionReceipts = receipts;
    return Deletion.apply(output);
  }
  function validDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + 'T12:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }
  // Accepted sequence numbers win; concurrent new tasks get unique numbers.
  function assignSequences(workspace, previous) {
    var used = Object.create(null), known = Object.create(null), counter = workspace.meta.seqCounter || 0;
    (previous.tasks || []).forEach(function (t) { known[t.id] = t.seq; var n = /^TRC-(\d+)$/.exec(t.seq || ''); if (n) counter = Math.max(counter, +n[1]); });
    workspace.tasks.forEach(function (t) { if (known[t.id]) { t.seq = known[t.id]; used[t.seq] = true; } });
    workspace.tasks.forEach(function (t) {
      if (known[t.id]) return;
      var n = /^TRC-(\d+)$/.exec(t.seq || '');
      if (!n || used[t.seq]) t.seq = 'TRC-' + (++counter);
      else counter = Math.max(counter, +n[1]);
      used[t.seq] = true;
    });
    workspace.meta.seqCounter = counter;
    return workspace;
  }
  return { empty: empty, clone: clone, equal: equal, merge: merge, validate: validate, assignSequences: assignSequences };
});
