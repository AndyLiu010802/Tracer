'use strict';
const S = require('../../public/workspace-sync');
module.exports = function memoryRepository() {
  const map = new Map(); let queue = Promise.resolve();
  return { transaction(fn) {
    const run = queue.then(async () => {
      const staged = new Map(map);
      const result = await fn({ get: async (c, id) => S.clone(staged.get(c + '/' + id)) || null, set: async (c, id, v) => staged.set(c + '/' + id, S.clone(v)) });
      map.clear(); for (const [k, v] of staged) map.set(k, v); return S.clone(result);
    }); queue = run.catch(() => {}); return run;
  } };
};
