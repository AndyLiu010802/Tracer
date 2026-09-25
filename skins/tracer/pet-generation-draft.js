(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerPetGenerationDraft = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const databaseName = 'tracer-pet-generation', storeName = 'drafts', recordKey = 'draft';
  const photoLimit = 6 * 1024 * 1024;
  const legacyFields = ['name', 'kind', 'personality', 'distinctiveFeatures', 'imageSource', 'imageModel', 'photo', 'pages', 'pageAttempts', 'animationVersion', 'recordId', 'generationId', 'wasBusy'];
  const fields = [...legacyFields, 'generationIdentity', 'pendingReplacement', 'editingId', 'editingSignature', 'retainedFrames'];
  const safeImage = value => typeof value === 'string' && /^\/api\/pet-art\/[a-f0-9]{32}\.png$/.test(value);
  const queues = new WeakMap();
  let defaultStorage;
  function failure(code, cause) {
    const error = new Error(code); error.code = code;
    if (cause !== undefined) error.cause = cause;
    return error;
  }
  function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
  function normalize(raw) {
    if (!object(raw)) throw failure('pet-draft-invalid');
    const text = (key, limit, multiline = false) => {
      const value = raw[key] === undefined ? '' : raw[key];
      if (typeof value !== 'string' || value.length > limit || (multiline ? /[\x00-\x08\x0b\x0c\x0e-\x1f]/ : /[\x00-\x1f]/).test(value)) throw failure('pet-draft-invalid');
      return value;
    };
    const name = text('name', 40), personality = text('personality', 600, true), distinctiveFeatures = text('distinctiveFeatures', 400, true), imageModel = text('imageModel', 200);
    const notes = raw.actionDescriptions;
    if (notes !== undefined && (!Array.isArray(notes) || notes.length !== 16 || !Array.from({length:16},(_,i)=>i).every(i=>typeof notes[i]==='string'&&notes[i].length<=600&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(notes[i])))) throw failure('pet-draft-invalid');
    const kind = raw.kind === undefined ? 'creature' : raw.kind, imageSource = raw.imageSource === undefined ? 'codex' : raw.imageSource;
    const animationVersion = raw.animationVersion === undefined ? 2 : raw.animationVersion, wasBusy = raw.wasBusy === undefined ? false : raw.wasBusy;
    if (!['creature', 'humanoid'].includes(kind) || !['codex', 'personal'].includes(imageSource) || ![2,3].includes(animationVersion) || typeof wasBusy !== 'boolean') throw failure('pet-draft-invalid');
    const recordId = text('recordId', 39), generationId = text('generationId', 32);
    if ((recordId && !/^custom_[a-f0-9]{32}$/.test(recordId)) || (generationId && !/^[a-f0-9]{32}$/.test(generationId))) throw failure('pet-draft-invalid');
    const editingId = text('editingId', 39), editingSignature = text('editingSignature', 64);
    if (editingId ? !/^custom_[a-f0-9]{32}$/.test(editingId) || editingId !== recordId || !/^[a-f0-9]{64}$/.test(editingSignature) : editingSignature !== '') throw failure('pet-draft-invalid');
    const pages = raw.pages === undefined ? [] : raw.pages;
    if (!Array.isArray(pages) || pages.length > 16 || !Array.from({ length: pages.length }, (_, i) => i).every(i => safeImage(pages[i]))) throw failure('pet-draft-invalid');
    const pageAttempts = raw.pageAttempts === undefined ? Array(16).fill(0) : raw.pageAttempts;
    if (!Array.isArray(pageAttempts) || pageAttempts.length !== 16 || !Array.from({ length: 16 }, (_, i) => i).every(i => Number.isInteger(pageAttempts[i]) && pageAttempts[i] >= 0 && pageAttempts[i] <= 1000)) throw failure('pet-draft-invalid');
    const retainedFrames = raw.retainedFrames === undefined ? Array(16).fill(animationVersion===3?32:16) : raw.retainedFrames;
    if (!Array.isArray(retainedFrames) || retainedFrames.length !== 16 || !Array.from({ length: 16 }, (_, i) => i).every(i => (animationVersion===3?[32]:[1,4,16]).includes(retainedFrames[i]) && (i < pages.length || retainedFrames[i] === (animationVersion===3?32:16)))) throw failure('pet-draft-invalid');
    // Keep the first accepted idle sheet as a stable reference even after idle is
    // replaced. Older drafts acquire that reference from their original first page.
    const generationIdentity = raw.generationIdentity === undefined ? pages[0] || '' : raw.generationIdentity;
    if (pages.length ? !safeImage(generationIdentity) : generationIdentity !== '') throw failure('pet-draft-invalid');
    let pendingReplacement = null;
    if (raw.pendingReplacement !== undefined && raw.pendingReplacement !== null) {
      const pending = raw.pendingReplacement;
      if (!object(pending) || Object.keys(pending).length !== 3 || !['pageIndex', 'attempt', 'identityImage'].every(key => Object.prototype.hasOwnProperty.call(pending, key)) ||
          !Number.isInteger(pending.pageIndex) || pending.pageIndex < 0 || pending.pageIndex >= pages.length ||
          !Number.isInteger(pending.attempt) || pending.attempt < 1 || pending.attempt > 1000 || pending.attempt !== pageAttempts[pending.pageIndex] ||
          pending.identityImage !== generationIdentity || !safeImage(pending.identityImage) || !generationId) throw failure('pet-draft-invalid');
      pendingReplacement = { pageIndex: pending.pageIndex, attempt: pending.attempt, identityImage: pending.identityImage };
    }
    const photo = raw.photo === undefined ? '' : raw.photo;
    if (typeof photo !== 'string' || photo.length > photoLimit) throw failure('pet-draft-invalid');
    if (photo) {
      const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo);
      if (!match || match[2].length % 4 !== 0) throw failure('pet-draft-invalid');
      let header;
      try { header = root.atob(match[2].slice(0, 32)); } catch { throw failure('pet-draft-invalid'); }
      if (match[1] === 'png' ? !header.startsWith('\x89PNG\r\n\x1a\n') : match[1] === 'jpeg' ? !header.startsWith('\xff\xd8\xff') : !(header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP')) throw failure('pet-draft-invalid');
    }
    // Whitelist only recovery data. File objects, account settings and API keys never enter storage.
    return { name, kind, personality, distinctiveFeatures, imageSource, imageModel, photo, pages: pages.slice(), pageAttempts: pageAttempts.slice(), animationVersion, recordId, generationId, wasBusy, generationIdentity, pendingReplacement, editingId, editingSignature, retainedFrames: retainedFrames.slice(), ...(notes ? { actionDescriptions: notes.slice() } : {}) };
  }
  function inspect(record) {
    try {
      if (!object(record) || Object.keys(record).length !== 3 || !['version', 'savedAt', 'draft'].every(key => Object.prototype.hasOwnProperty.call(record, key)) || ![1, 2].includes(record.version) || !Number.isSafeInteger(record.savedAt) || record.savedAt < 0 || !object(record.draft)) throw failure('pet-draft-corrupt');
      const expectedFields = record.version === 1 ? legacyFields : [...fields, ...(Object.hasOwn(record.draft,'actionDescriptions') ? ['actionDescriptions'] : [])];
      if (Object.keys(record.draft).length !== expectedFields.length || !expectedFields.every(key => Object.prototype.hasOwnProperty.call(record.draft, key)) ||
          (record.version === 2 && (typeof record.draft.generationIdentity !== 'string' || record.draft.pendingReplacement === undefined ||
            typeof record.draft.editingId !== 'string' || typeof record.draft.editingSignature !== 'string' || !Array.isArray(record.draft.retainedFrames)))) throw failure('pet-draft-corrupt');
      return normalize(record.draft);
    } catch (error) { throw failure('pet-draft-corrupt', error); }
  }
  function indexedStorage() {
    let pendingDatabase;
    function database() {
      if (pendingDatabase) return pendingDatabase;
      pendingDatabase = new Promise((resolve, reject) => {
        let request, settled = false;
        const failed = cause => { if (!settled) { settled = true; reject(failure('pet-draft-unavailable', cause)); } };
        try {
          if (!root.indexedDB || typeof root.indexedDB.open !== 'function') throw failure('pet-draft-unavailable');
          request = root.indexedDB.open(root.TracerAccount ? root.TracerAccount.storageName(databaseName) : databaseName, 1);
          request.onupgradeneeded = () => {
            try { if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName); }
            catch (error) { failed(error); try { request.transaction?.abort(); } catch {} }
          };
          request.onerror = () => failed(request.error);
          request.onblocked = () => failed(new Error('database-blocked'));
          request.onsuccess = () => {
            const db = request.result;
            if (settled) { db.close(); return; }
            settled = true;
            db.onversionchange = () => { pendingDatabase = null; db.close(); };
            db.onclose = () => { pendingDatabase = null; };
            resolve(db);
          };
        } catch (error) { failed(error); }
      }).catch(error => { pendingDatabase = null; throw error; });
      return pendingDatabase;
    }
    async function transact(method, record) {
      await root.TracerAccount?.ready;
      if(root.TracerAccount?.locked)throw failure('pet-draft-unavailable');
      const db = await database();
      if(root.TracerAccount?.locked)throw failure('pet-draft-unavailable');
      return new Promise((resolve, reject) => {
        let transaction, request, result;
        try {
          transaction = db.transaction(storeName, method === 'get' ? 'readonly' : 'readwrite');
          const store = transaction.objectStore(storeName);
          request = method === 'put' ? store.put(record, recordKey) : store[method](recordKey);
          request.onsuccess = () => { result = request.result; };
          // Request success is not durable until the entire transaction commits.
          transaction.oncomplete = () => resolve(result);
          transaction.onabort = () => reject(transaction.error || request.error || new Error('transaction-aborted'));
        } catch (error) { reject(error); }
      });
    }
    return { get: () => transact('get'), put: record => transact('put', record), delete: () => transact('delete') };
  }
  function create(options = {}) {
    const storage = options.storage || (defaultStorage || (defaultStorage = indexedStorage()));
    if (!object(storage) || !['get', 'put', 'delete'].every(method => typeof storage[method] === 'function')) throw failure('pet-draft-unavailable');
    if (!queues.has(storage)) queues.set(storage, { tail: Promise.resolve(), last: Promise.resolve() });
    const queue = queues.get(storage);
    function enqueue(task, code) {
      const operation = queue.tail.then(task).catch(error => {
        if (error?.code === 'pet-draft-unavailable' || error?.code === 'pet-draft-corrupt') throw error;
        throw failure(code, error);
      });
      // Keep each caller's rejected promise intact, while allowing a later retry or clear.
      queue.last = operation;
      queue.tail = operation.then(() => undefined, () => undefined);
      return operation;
    }
    return {
      load() { return enqueue(async () => { const record = await storage.get(); return record == null ? null : inspect(record); }, 'pet-draft-read-failed'); },
      async save(raw) {
        const draft = normalize(raw), record = { version: 2, savedAt: Date.now(), draft };
        return enqueue(async () => { await storage.put(record); return normalize(draft); }, 'pet-draft-save-failed');
      },
      clear() { return enqueue(async () => { await storage.delete(); }, 'pet-draft-clear-failed'); },
      flush() { return queue.last; }
    };
  }
  return { create };
});
