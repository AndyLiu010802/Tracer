(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerCompanionWork = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const maximumReceipts = 2000;
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  function failure(code) { return Object.assign(new Error(code), { code }); }
  function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function keys(value, names) { return object(value) && Object.keys(value).length === names.length && names.every(name => Object.prototype.hasOwnProperty.call(value, name)); }
  function validRequestId(value) { return typeof value === 'string' && uuid.test(value); }
  function date(value) {
    if (value === null) return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01') throw failure('invalid-companion-work');
    const parsed = new Date(value + 'T12:00:00Z');
    if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== value) throw failure('invalid-companion-work');
    return value;
  }
  function text(value, limit, required, multiline) {
    if (typeof value !== 'string' || value.length > limit || (required && !value.trim()) ||
        (multiline ? /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/ : /[\x00-\x1f\x7f]/).test(value)) throw failure('invalid-companion-work');
    return value.trim();
  }
  function normalize(raw) {
    if (!keys(raw, ['type', 'project', 'tasks']) || !['tasks', 'project'].includes(raw.type) || !Array.isArray(raw.tasks) || raw.tasks.length > 20 ||
        (raw.type === 'tasks' && (raw.project !== null || !raw.tasks.length))) throw failure('invalid-companion-work');
    let project = null;
    if (raw.type === 'project') {
      if (!keys(raw.project, ['name', 'notes', 'start', 'end'])) throw failure('invalid-companion-work');
      project = { name: text(raw.project.name, 120, true, false), notes: text(raw.project.notes, 8000, false, true), start: date(raw.project.start), end: date(raw.project.end) };
      if (project.start && project.end && project.start > project.end) throw failure('invalid-companion-work');
    }
    const tasks = Array.from(raw.tasks, task => {
      if (!keys(task, ['title', 'notes', 'due', 'scheduled', 'priority', 'estimate', 'checklist']) || !['low', 'medium', 'high', 'urgent'].includes(task.priority) ||
          !(task.estimate === null || typeof task.estimate === 'number' && Number.isFinite(task.estimate) && task.estimate >= 0 && task.estimate <= 1000) ||
          !Array.isArray(task.checklist) || task.checklist.length > 20) throw failure('invalid-companion-work');
      const due = date(task.due), scheduled = date(task.scheduled);
      if (due && scheduled && scheduled > due) throw failure('invalid-companion-work');
      if (project && [due, scheduled].some(value => value && (project.start && value < project.start || project.end && value > project.end))) throw failure('invalid-companion-work');
      return { title: text(task.title, 200, true, false), notes: text(task.notes, 4000, false, true), due, scheduled, priority: task.priority,
        estimate: task.estimate === 0 ? 0 : task.estimate, checklist: Array.from(task.checklist, item => text(item, 200, true, false)) };
    });
    return { type: raw.type, project, tasks };
  }
  const dateSchema = { anyOf: [{ type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, { type: 'null' }] };
  const taskSchema = { type: 'object', additionalProperties: false,
    properties: { title: { type: 'string', minLength: 1, maxLength: 200 }, notes: { type: 'string', maxLength: 4000 }, due: dateSchema, scheduled: dateSchema,
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] }, estimate: { anyOf: [{ type: 'number', minimum: 0, maximum: 1000 }, { type: 'null' }] },
      checklist: { type: 'array', maxItems: 20, items: { type: 'string', minLength: 1, maxLength: 200 } } },
    required: ['title', 'notes', 'due', 'scheduled', 'priority', 'estimate', 'checklist'] };
  const schema = { type: 'object', additionalProperties: false, properties: {
    type: { type: 'string', enum: ['tasks', 'project'] },
    project: { anyOf: [{ type: 'object', additionalProperties: false,
      properties: { name: { type: 'string', minLength: 1, maxLength: 120 }, notes: { type: 'string', maxLength: 8000 }, start: dateSchema, end: dateSchema },
      required: ['name', 'notes', 'start', 'end'] }, { type: 'null' }] },
    tasks: { type: 'array', maxItems: 20, items: taskSchema }
  }, required: ['type', 'project', 'tasks'] };

  // Synchronous SHA-256 keeps receipt identities identical in browsers, Node and
  // Electron without turning the workspace mutation itself into an async operation.
  const roundConstants = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,
    0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,
    0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const rotate = (value, count) => value >>> count | value << (32 - count);
  function sha256(value) {
    if (typeof value !== 'string') throw failure('invalid-companion-work');
    const bytes = new root.TextEncoder().encode(value), length = Math.ceil((bytes.length + 9) / 64) * 64;
    const padded = new Uint8Array(length); padded.set(bytes); padded[bytes.length] = 128;
    const data = new DataView(padded.buffer), bitLength = bytes.length * 8;
    data.setUint32(length - 8, Math.floor(bitLength / 0x100000000)); data.setUint32(length - 4, bitLength >>> 0);
    const state = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], words = new Uint32Array(64);
    for (let offset = 0; offset < length; offset += 64) {
      for (let i = 0; i < 16; i++) words[i] = data.getUint32(offset + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = words[i - 15], b = words[i - 2];
        words[i] = (words[i - 16] + (rotate(a, 7) ^ rotate(a, 18) ^ a >>> 3) + words[i - 7] + (rotate(b, 17) ^ rotate(b, 19) ^ b >>> 10)) >>> 0;
      }
      let [a,b,c,d,e,f,g,h] = state;
      for (let i = 0; i < 64; i++) {
        const first = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + (e & f ^ ~e & g) + roundConstants[i] + words[i]) >>> 0;
        const second = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + (a & b ^ a & c ^ b & c)) >>> 0;
        h=g;g=f;f=e;e=(d+first)>>>0;d=c;c=b;b=a;a=(first+second)>>>0;
      }
      [a,b,c,d,e,f,g,h].forEach((value, index) => { state[index] = (state[index] + value) >>> 0; });
    }
    return state.map(value => value.toString(16).padStart(8, '0')).join('');
  }
  function signature(proposal) { return sha256(JSON.stringify(normalize(proposal))); }
  function ids(requestId, project, count) {
    return { projectId: project ? 'cw_p_' + requestId : null, taskIds: Array.from({ length: count }, (_, index) => 'cw_t_' + requestId + '_' + index), noteId: project ? 'cw_n_' + requestId : null };
  }
  function validateReceipts(value) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > maximumReceipts) throw failure('invalid-companion-receipts');
    const seen = new Set();
    return Array.from(value, row => {
      if (!keys(row, ['requestId', 'signature', 'projectId', 'taskIds', 'noteId']) || !validRequestId(row.requestId) || seen.has(row.requestId) ||
          typeof row.signature !== 'string' || !/^[a-f0-9]{64}$/.test(row.signature) || !Array.isArray(row.taskIds) || row.taskIds.length > 20 ||
          (row.projectId === null && !row.taskIds.length)) throw failure('invalid-companion-receipts');
      const expected = ids(row.requestId, row.projectId !== null, row.taskIds.length);
      if (row.projectId !== expected.projectId || row.noteId !== expected.noteId || !Array.from({ length: row.taskIds.length }, (_, index) => index).every(index => row.taskIds[index] === expected.taskIds[index])) throw failure('invalid-companion-receipts');
      seen.add(row.requestId);
      return { requestId: row.requestId, signature: row.signature, ...expected };
    });
  }
  function mergeReceipts(...values) {
    const merged = new Map();
    for (const value of values) for (const row of validateReceipts(value)) {
      const old = merged.get(row.requestId);
      if (old && JSON.stringify(old) !== JSON.stringify(row)) throw failure('companion-work-conflict');
      merged.set(row.requestId, row);
      if (merged.size > maximumReceipts) throw failure('companion-work-limit');
    }
    return Array.from(merged.values()).sort((a, b) => a.requestId.localeCompare(b.requestId));
  }
  function apply(workspace, raw, requestId, M) {
    if (!validRequestId(requestId)) throw failure('invalid-companion-request-id');
    const proposal = normalize(raw), hash = signature(proposal), target = ids(requestId, proposal.type === 'project', proposal.tasks.length);
    if (!object(workspace) || !object(workspace.meta) || !Number.isSafeInteger(workspace.meta.seqCounter) || workspace.meta.seqCounter < 0 ||
        !['tasks', 'projects', 'notes', 'inbox'].every(name => Array.isArray(workspace[name]) && workspace[name].length <= 2000) ||
        ['completionHistory', 'projectDeletions'].some(name => workspace[name] !== undefined && !Array.isArray(workspace[name])) ||
        (workspace.projectDeletions || []).some(row => !object(row) || !Array.isArray(row.taskIds)) ||
        !M || !['addTask', 'addProject', 'addNote'].every(name => typeof M[name] === 'function')) throw failure('invalid-companion-work');
    const receipts = validateReceipts(workspace.meta.companionReceipts), receipt = receipts.find(row => row.requestId === requestId);
    if (receipt && (receipt.signature !== hash || JSON.stringify(ids(requestId, receipt.projectId !== null, receipt.taskIds.length)) !== JSON.stringify(target))) throw failure('companion-work-conflict');
    const next = JSON.parse(JSON.stringify(workspace));
    if (receipt) return { workspace: next, duplicate: true, ...target };
    if (receipts.length >= maximumReceipts || workspace.tasks.length + proposal.tasks.length > 2000 ||
        !Number.isSafeInteger(workspace.meta.seqCounter + proposal.tasks.length) ||
        workspace.projects.length + (target.projectId ? 1 : 0) > 2000 || workspace.notes.length + (target.noteId ? 1 : 0) > 2000) throw failure('companion-work-limit');
    const taskPrefix = 'cw_t_' + requestId + '_';
    const reserved = id => typeof id === 'string' && (id === 'cw_p_' + requestId || id === 'cw_n_' + requestId || id.startsWith(taskPrefix));
    // A receipt is the commit marker. Existing records or tombstones without it
    // are a partial/conflicting write and must not be completed by guesswork.
    if (['tasks', 'projects', 'notes', 'inbox'].some(name => workspace[name].some(row => row && reserved(row.id))) ||
        (workspace.completionHistory || []).some(row => row && (reserved(row.taskId) || reserved(row.projectId))) ||
        (workspace.projectDeletions || []).some(row => reserved(row.id) || row.taskIds.some(reserved))) throw failure('companion-work-conflict');
    if (target.projectId) {
      const project = M.addProject(next, { name: proposal.project.name });
      if (!project) throw failure('invalid-companion-work');
      project.id = target.projectId; project.start = proposal.project.start; project.end = proposal.project.end;
      const note = M.addNote(next, { title: proposal.project.name, body: proposal.project.notes, projectId: target.projectId });
      if (!note) throw failure('invalid-companion-work');
      note.id = target.noteId;
    }
    proposal.tasks.forEach((task, index) => {
      const record = M.addTask(next, { ...task, projectId: target.projectId, status: 'todo', spent: 0, type: 'task',
        checklist: task.checklist.map((text, checkIndex) => ({ id: 'cw_c_' + requestId + '_' + index + '_' + checkIndex, text, done: false })) });
      if (!record) throw failure('invalid-companion-work');
      record.id = target.taskIds[index];
    });
    next.meta.companionReceipts = receipts.concat({ requestId, signature: hash, ...target });
    return { workspace: next, duplicate: false, ...target };
  }
  return { normalize, schema, validRequestId, apply, validateReceipts, mergeReceipts, signature, sha256 };
});
