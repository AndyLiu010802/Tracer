(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TaskGarden = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var KINDS = ['wildflower', 'sunflower', 'lavender', 'apple', 'peach', 'cherry', 'neon_orchid', 'volt_berry', 'crystal_tree'];
  // Market version 1 prices are immutable: saved receipts never change value after a reload.
  var CATALOG = KINDS.map(function (kind, i) {
    return { plantKind: kind, farmId: i < 6 ? 'meadow' : 'cyber', unitPrice: [12, 18, 20, 25, 30, 28, 32, 36, 40][i] };
  });
  var FARMS = [
    { id: 'meadow', price: 0, plantKinds: KINDS.slice(0, 6) },
    { id: 'cyber', price: 240, plantKinds: KINDS.slice(6) }
  ];
  var STATES = ['growing', 'mature', 'destroyed', 'harvested'];
  var MAX_TIME = 8640000000000000;
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function emptyMarket() { return { version: 1, sales: [], purchases: [], equipped: { farmId: 'meadow', updatedAt: 0 } }; }
  function empty() { return { version: 1, seeds: [], planets: [], deletedPlanets: [], market: emptyMarket() }; }
  function plantInfo(kind) { return CATALOG.find(function (p) { return p.plantKind === kind; }); }
  function farmInfo(id) { return FARMS.find(function (f) { return f.id === id; }); }
  function owns(market, id) { return id === 'meadow' || market.purchases.some(function (p) { return p.farmId === id; }); }
  function validId(x) { return typeof x === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(x); }
  function time(x) { return Number.isSafeInteger(x) && x > 0 && x <= MAX_TIME; }
  function timestamp(x) { return time(x) ? x : Date.now(); }
  function variant(ticket) { return ticket === 0 ? 'shiny' : ticket < 100 ? 'rare' : 'normal'; }
  function fail() { throw new Error('Invalid task garden'); }
  function seedRecord(row) {
    if (!row || typeof row.taskId !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(row.taskId) || typeof row.title !== 'string' || row.title.length > 100000 ||
        !(row.projectId === null || validId(row.projectId)) || KINDS.indexOf(row.plantKind) < 0 ||
        !Number.isInteger(row.ticket) || row.ticket < 0 || row.ticket >= 10000 ||
        row.variant !== variant(row.ticket) || STATES.indexOf(row.state) < 0 ||
        !time(row.plantedAt) || !time(row.updatedAt) || row.updatedAt < row.plantedAt) fail();
    var farmId = plantInfo(row.plantKind).farmId;
    if (row.farmId !== undefined && row.farmId !== farmId) fail();
    var out = { taskId: row.taskId, title: row.title, projectId: row.projectId, plantKind: row.plantKind, farmId: farmId,
      ticket: row.ticket, variant: row.variant, plantedAt: row.plantedAt, updatedAt: row.updatedAt, state: row.state };
    ['completedAt', 'harvestedAt', 'destroyedAt', 'retiredAt', 'forgottenAt'].forEach(function (key) {
      var v = row[key] === undefined ? null : row[key];
      if (v !== null && (!time(v) || v < row.plantedAt)) fail();
      out[key] = v;
    });
    if (out.state === 'harvested' !== !!out.harvestedAt || out.state === 'mature' && !out.completedAt ||
        out.harvestedAt && (!out.completedAt || out.harvestedAt < out.completedAt) ||
        out.state === 'destroyed' && !out.destroyedAt || out.retiredAt && !['destroyed', 'harvested'].includes(out.state)) fail();
    if (out.forgottenAt) { out.title = ''; out.projectId = null; }
    return out;
  }
  function totals(garden) {
    var seeds = new Map(garden.seeds.map(function (s) { return [s.taskId, s]; }));
    var earned = garden.market.sales.reduce(function (n, sale) { return n + plantInfo(seeds.get(sale.taskId).plantKind).unitPrice; }, 0);
    var spent = garden.market.purchases.reduce(function (n, purchase) { return n + farmInfo(purchase.farmId).price; }, 0);
    return { balance: earned - spent, earned: earned, spent: spent, equippedFarmId: garden.market.equipped.farmId,
      ownedFarmIds: FARMS.filter(function (f) { return owns(garden.market, f.id); }).map(function (f) { return f.id; }) };
  }
  function marketRecord(raw, seeds) {
    if (raw === undefined) return emptyMarket();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1 ||
        !Array.isArray(raw.sales) || raw.sales.length > 50000 || !Array.isArray(raw.purchases) || raw.purchases.length >= FARMS.length ||
        !raw.equipped || !farmInfo(raw.equipped.farmId) ||
        !(time(raw.equipped.updatedAt) || raw.equipped.farmId === 'meadow' && raw.equipped.updatedAt === 0)) fail();
    var out = emptyMarket(), seen = new Set(), byId = new Map(seeds.map(function (s) { return [s.taskId, s]; }));
    out.sales = raw.sales.map(function (sale) {
      var seed = sale && byId.get(sale.taskId);
      if (!seed || !seed.harvestedAt || !time(sale.soldAt) || sale.soldAt < seed.harvestedAt || seen.has(sale.taskId)) fail();
      seen.add(sale.taskId); return { taskId: sale.taskId, soldAt: sale.soldAt };
    });
    seen = new Set();
    out.purchases = raw.purchases.map(function (purchase) {
      var farm = purchase && farmInfo(purchase.farmId);
      if (!farm || !farm.price || !time(purchase.purchasedAt) || seen.has(farm.id)) fail();
      seen.add(farm.id); return { farmId: farm.id, purchasedAt: purchase.purchasedAt };
    });
    if (!owns(out, raw.equipped.farmId) || totals({ seeds: seeds, market: out }).balance < 0) fail();
    out.equipped = { farmId: raw.equipped.farmId, updatedAt: raw.equipped.updatedAt };
    return out;
  }
  function validate(raw) {
    if (raw === undefined || raw === null) return empty();
    if (typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1 ||
        !Array.isArray(raw.seeds) || raw.seeds.length > 50000 || !Array.isArray(raw.planets) || raw.planets.length > 10000 ||
        !Array.isArray(raw.deletedPlanets) || raw.deletedPlanets.length > 10000) fail();
    var out = empty(), ids = new Set();
    out.seeds = raw.seeds.map(function (row) { var seed = seedRecord(row); if (ids.has(seed.taskId)) fail(); ids.add(seed.taskId); return seed; });
    ids = new Set();
    out.planets = raw.planets.map(function (row) {
      if (!row || !validId(row.id) || row.projectId !== row.id || ids.has(row.id) || typeof row.name !== 'string' ||
          row.name.length > 100000 || !/^#[0-9a-fA-F]{6}$/.test(row.color) || !time(row.completedAt) ||
          !Number.isSafeInteger(row.taskCount) || row.taskCount < 0 || row.taskCount > 50000 ||
          !Array.isArray(row.flowers) || row.flowers.length > 50000) fail();
      ids.add(row.id); var flowerIds = new Set();
      var flowers = row.flowers.map(function (f) {
        var s = seedRecord(f);
        if (s.state !== 'harvested' || s.projectId !== row.projectId || flowerIds.has(s.taskId)) fail();
        flowerIds.add(s.taskId); return s;
      });
      if (flowers.length > row.taskCount) fail();
      return { id: row.id, projectId: row.id, name: row.name, color: row.color, completedAt: row.completedAt, taskCount: row.taskCount, flowers: flowers };
    });
    ids = new Set();
    out.deletedPlanets = raw.deletedPlanets.map(function (r) {
      if (!r || !validId(r.projectId) || !time(r.deletedAt) || ids.has(r.projectId)) fail();
      ids.add(r.projectId); return { projectId: r.projectId, deletedAt: r.deletedAt };
    });
    out.planets = out.planets.filter(function (p) { return !ids.has(p.projectId); });
    out.market = marketRecord(raw.market, out.seeds);
    return out;
  }
  function read(ws) { return validate(ws && ws.taskGarden); }
  function ensure(ws) { var garden = read(ws); ws.taskGarden = garden; return garden; }
  // Rejection sampling avoids modulo bias for both species and the 1 / 10,000 shiny draw.
  function draw(limit) {
    var c = typeof globalThis !== 'undefined' && globalThis.crypto;
    if (!c && typeof require === 'function') c = require('node:crypto').webcrypto;
    if (!c || typeof c.getRandomValues !== 'function') throw new Error('Secure random seeds unavailable');
    var values = new Uint32Array(1), ceiling = 4294967296 - (4294967296 % limit);
    do { c.getRandomValues(values); } while (values[0] >= ceiling);
    return values[0] % limit;
  }
  function find(garden, id) { return garden.seeds.find(function (s) { return s.taskId === id; }); }
  function nextTime(seed, now) { return Math.max(timestamp(now), seed ? seed.updatedAt + 1 : 1); }
  function taskChanged(ws, task, now, random) {
    if (!task) return null;
    var existing = ws.taskGarden && find(ws.taskGarden, task.id);
    if (!existing && !['doing', 'review'].includes(task.status)) return null;
    var wanted = task.status === 'todo' ? 'destroyed' : task.status === 'done' ? 'mature' : 'growing';
    if (existing && (existing.harvestedAt || existing.retiredAt || existing.state === wanted && existing.title === (task.title || '') && existing.projectId === (task.projectId || null))) return existing;
    var garden = ensure(ws), seed = find(garden, task.id);
    var eventAt = timestamp(now || task.updatedAt || task.createdAt);
    if (!seed) {
      var farm = farmInfo(garden.market.equipped.farmId), pool = farm.plantKinds;
      var rand = random || draw, kind = rand(pool.length), ticket = rand(10000);
      if (!Number.isInteger(kind) || kind < 0 || kind >= pool.length || !Number.isInteger(ticket) || ticket < 0 || ticket >= 10000) throw new Error('Invalid seed draw');
      seed = { taskId: task.id, title: task.title || '', projectId: task.projectId || null,
        plantKind: pool[kind], farmId: farm.id, ticket: ticket, variant: variant(ticket), plantedAt: eventAt, updatedAt: eventAt,
        state: 'growing', completedAt: null, harvestedAt: null, destroyedAt: null, retiredAt: null, forgottenAt: null };
      garden.seeds.push(seed);
    }
    if (seed.harvestedAt || seed.retiredAt || eventAt < seed.updatedAt) return seed;
    var state = task.status === 'todo' ? 'destroyed' : task.status === 'done' ? 'mature' : 'growing';
    var changed = seed.state !== state || seed.title !== (task.title || '') || seed.projectId !== (task.projectId || null);
    if (changed) {
      seed.updatedAt = Math.max(seed.updatedAt, eventAt);
      seed.state = state; seed.title = task.title || ''; seed.projectId = task.projectId || null;
      if (state === 'destroyed') seed.destroyedAt = eventAt;
      if (state === 'mature') seed.completedAt = Math.max(seed.plantedAt, task.doneAt || eventAt);
    }
    return seed;
  }
  function reconcile(ws, now, random) {
    var before = JSON.stringify(ws.taskGarden);
    applyDeletions(ws);
    (ws.tasks || []).forEach(function (task) { taskChanged(ws, task, now, random); });
    return before !== JSON.stringify(ws.taskGarden);
  }
  function active(ws) { return read(ws).seeds.filter(function (s) { return s.state === 'growing' || s.state === 'mature'; }); }
  function harvest(ws, taskId, now) {
    var existing = ws.taskGarden && find(ws.taskGarden, taskId);
    if (!existing || existing.state !== 'mature' && existing.state !== 'harvested') return null;
    var seed = find(ensure(ws), taskId);
    if (!seed.harvestedAt) {
      seed.harvestedAt = Math.max(nextTime(seed, now), seed.completedAt);
      seed.updatedAt = seed.harvestedAt; seed.state = 'harvested';
    }
    return seed;
  }
  function willDestroy(ws, taskId, fields) {
    var seed = ws.taskGarden && find(ws.taskGarden, taskId);
    return !!(seed && (seed.state === 'growing' || seed.state === 'mature') && fields && (fields.delete || fields.status === 'todo'));
  }
  function withdrawal(ws, id, status) { return willDestroy(ws, id, { status: status }); }
  function retireTask(ws, taskId, now) {
    var existing = ws.taskGarden && find(ws.taskGarden, taskId);
    if (!existing) return false;
    var seed = find(ensure(ws), taskId), at = nextTime(seed, now);
    if (seed.retiredAt) return false;
    seed.retiredAt = at; seed.updatedAt = at;
    if (!seed.harvestedAt) { seed.state = 'destroyed'; seed.destroyedAt = at; }
    return true;
  }
  function collection(ws) {
    var rows = KINDS.map(function (kind) { return { plantKind: kind, total: 0, normal: 0, rare: 0, shiny: 0, unlocked: false }; });
    read(ws).seeds.forEach(function (seed) { if (seed.harvestedAt) { var row = rows[KINDS.indexOf(seed.plantKind)]; row.total++; row[seed.variant]++; row.unlocked = true; } });
    return rows;
  }
  function inventory(ws) {
    var garden = read(ws), sold = new Set(garden.market.sales.map(function (s) { return s.taskId; }));
    var rows = CATALOG.map(function (p) { return { plantKind: p.plantKind, farmId: p.farmId, unitPrice: p.unitPrice,
      available: 0, harvested: 0, sold: 0, normal: 0, rare: 0, shiny: 0 }; });
    garden.seeds.forEach(function (seed) {
      if (!seed.harvestedAt) return;
      var row = rows[KINDS.indexOf(seed.plantKind)]; row.harvested++;
      if (sold.has(seed.taskId)) row.sold++;
      else { row.available++; row[seed.variant]++; }
    });
    return rows;
  }
  function economy(ws) { return totals(read(ws)); }
  function farms(ws) {
    var market = read(ws).market;
    return FARMS.map(function (f) { return { id: f.id, price: f.price, plantKinds: f.plantKinds.slice(),
      owned: owns(market, f.id), equipped: market.equipped.farmId === f.id }; });
  }
  function sell(ws, plantKind, quantity, now) {
    var info = plantInfo(plantKind);
    if (!info) return { ok: false, reason: 'unknown-plant' };
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 50000) return { ok: false, reason: 'invalid-quantity' };
    var garden = read(ws), sold = new Set(garden.market.sales.map(function (s) { return s.taskId; }));
    var rank = { normal: 0, rare: 1, shiny: 2 };
    var stock = garden.seeds.filter(function (s) { return s.plantKind === plantKind && s.harvestedAt && !sold.has(s.taskId); });
    if (stock.length < quantity) return { ok: false, reason: 'insufficient-stock', available: stock.length };
    stock.sort(function (a, b) { return rank[a.variant] - rank[b.variant] || a.harvestedAt - b.harvestedAt || a.taskId.localeCompare(b.taskId); });
    var at = timestamp(now), selected = stock.slice(0, quantity);
    selected.forEach(function (s) { garden.market.sales.push({ taskId: s.taskId, soldAt: Math.max(at, s.harvestedAt) }); });
    ws.taskGarden = garden;
    return { ok: true, changed: true, plantKind: plantKind, quantity: quantity, earned: quantity * info.unitPrice,
      balance: totals(garden).balance, taskIds: selected.map(function (s) { return s.taskId; }) };
  }
  function buyFarm(ws, farmId, now) {
    var farm = farmInfo(farmId);
    if (!farm) return { ok: false, reason: 'unknown-farm' };
    var garden = read(ws), money = totals(garden);
    if (owns(garden.market, farmId)) return { ok: true, changed: false, alreadyOwned: true, farmId: farmId, spent: 0, balance: money.balance };
    if (money.balance < farm.price) return { ok: false, reason: 'insufficient-coins', balance: money.balance, price: farm.price };
    garden.market.purchases.push({ farmId: farmId, purchasedAt: timestamp(now) });
    ws.taskGarden = garden;
    return { ok: true, changed: true, alreadyOwned: false, farmId: farmId, spent: farm.price, balance: money.balance - farm.price };
  }
  function equipFarm(ws, farmId, now) {
    if (!farmInfo(farmId)) return { ok: false, reason: 'unknown-farm' };
    var garden = read(ws);
    if (!owns(garden.market, farmId)) return { ok: false, reason: 'not-owned' };
    if (garden.market.equipped.farmId === farmId) return { ok: true, changed: false, farmId: farmId };
    garden.market.equipped = { farmId: farmId, updatedAt: Math.max(timestamp(now), garden.market.equipped.updatedAt + 1) };
    ws.taskGarden = garden;
    return { ok: true, changed: true, farmId: farmId };
  }
  function archiveProject(ws, projectId, now) {
    var project = (ws.projects || []).find(function (p) { return p.id === projectId; });
    if (!project) return { ok: false, reason: 'not-found' };
    var current = (ws.tasks || []).filter(function (t) { return t.projectId === projectId; });
    if (current.some(function (t) { return t.status !== 'done'; })) return { ok: false, reason: 'unfinished' };
    var prior = read(ws), at = timestamp(now), existing = prior.planets.find(function (p) { return p.projectId === projectId; });
    if (project.status === 'completed') return { ok: true, planet: existing || null, count: existing ? existing.flowers.length : 0 };
    // Task completion and collection use the same receipts, including tasks already cleared from the board.
    prior.seeds.filter(function (s) { return s.projectId === projectId && s.state === 'mature'; }).forEach(function (s) { harvest(ws, s.taskId, at); });
    var garden = ensure(ws), flowers = garden.seeds.filter(function (s) { return s.projectId === projectId && s.harvestedAt; }).map(clone);
    var ids = new Set(current.map(function (t) { return t.id; }));
    var voids = new Set((ws.completionHistory || []).filter(function (h) { return h.kind === 'void'; }).map(function (h) { return h.target; }));
    (ws.completionHistory || []).forEach(function (h) { if (h.kind === 'completed' && h.projectId === projectId && !voids.has(h.id)) ids.add(h.taskId); });
    flowers.forEach(function (s) { ids.add(s.taskId); });
    var planet = { id: projectId, projectId: projectId, name: project.name, color: /^#[0-9a-fA-F]{6}$/.test(project.color) ? project.color : '#7c8fe8',
      completedAt: at, taskCount: ids.size, flowers: flowers };
    project.status = 'completed'; project.completedAt = at; project.updatedAt = at;
    if (!garden.deletedPlanets.some(function (p) { return p.projectId === projectId; })) garden.planets.push(planet);
    return { ok: true, planet: planet, count: flowers.length };
  }
  function removePlanet(ws, projectId, now) {
    if (!ws.taskGarden || !ws.taskGarden.planets.some(function (p) { return p.projectId === projectId; })) return false;
    var garden = ensure(ws);
    if (!garden.planets.some(function (p) { return p.projectId === projectId; })) return false;
    garden.deletedPlanets.push({ projectId: projectId, deletedAt: timestamp(now) });
    garden.planets = garden.planets.filter(function (p) { return p.projectId !== projectId; });
    return true;
  }
  function importLegacy(ws, records) {
    if (!Array.isArray(records)) throw new Error('Invalid legacy garden');
    var garden = read(ws), added = 0;
    records.forEach(function (r) {
      if (!r || !validId(r.projectId) || KINDS.indexOf(r.plantKind) < 0 || !time(r.maturedAt) ||
          !Number.isInteger(r.ticket) || r.ticket < 0 || r.ticket >= 10000 ||
          !(r.harvestedAt === null || time(r.harvestedAt) && r.harvestedAt >= r.maturedAt)) throw new Error('Invalid legacy garden');
      var id = 'legacy-plot-' + r.projectId;
      if (find(garden, id)) return;
      var project = (ws.projects || []).find(function (p) { return p.id === r.projectId; });
      garden.seeds.push({ taskId: id, title: project ? project.name : 'Garden keepsake', projectId: r.projectId,
        plantKind: r.plantKind, farmId: plantInfo(r.plantKind).farmId, ticket: r.ticket, variant: variant(r.ticket), plantedAt: r.maturedAt,
        updatedAt: r.harvestedAt || r.maturedAt, state: r.harvestedAt ? 'harvested' : 'mature', completedAt: r.maturedAt,
        harvestedAt: r.harvestedAt, destroyedAt: null, retiredAt: null, forgottenAt: null });
      added++;
    });
    if (added) ws.taskGarden = garden;
    return { changed: added > 0, imported: added };
  }
  function applyDeletions(ws) {
    if (!ws.taskGarden) return ws;
    var projects = new Set((ws.projectDeletions || []).map(function (p) { return p.id; }));
    var deletedTasks = new Set();
    (ws.projectDeletions || []).forEach(function (p) { (p.taskIds || []).forEach(function (id) { deletedTasks.add(id); }); });
    var tasks = new Map((ws.tasks || []).map(function (task) { return [task.id, task]; }));
    var ids = ws.taskGarden.seeds.filter(function (s) { return projects.has(s.projectId) || deletedTasks.has(s.taskId); }).map(function (s) { return s.taskId; });
    ids.forEach(function (id) {
      // A harvested keepsake stays with its original project, but the live task may have moved elsewhere.
      var task = tasks.get(id);
      if (!task || projects.has(task.projectId) || deletedTasks.has(id)) retireTask(ws, id);
      var seed = find(ws.taskGarden, id);
      seed.forgottenAt = seed.forgottenAt || nextTime(seed);
      seed.updatedAt = Math.max(seed.updatedAt, seed.forgottenAt);
      seed.title = ''; seed.projectId = null;
    });
    ws.taskGarden.seeds.forEach(function (seed) { if (seed.forgottenAt) { seed.title = ''; seed.projectId = null; } });
    projects.forEach(function (id) { removePlanet(ws, id); });
    var retired = new Set(ws.taskGarden.seeds.filter(function (s) { return s.retiredAt; }).map(function (s) { return s.taskId; }));
    if (retired.size && Array.isArray(ws.tasks)) {
      ws.tasks = ws.tasks.filter(function (task) { return !retired.has(task.id); });
      ws.tasks.forEach(function (task) { if (task.dependsOn) task.dependsOn = task.dependsOn.filter(function (id) { return !retired.has(id); }); });
    }
    return ws;
  }
  function mergeSeed(a, b, authority) {
    if (!a) return clone(b); if (!b) return clone(a);
    var identity = authority || (a.plantedAt < b.plantedAt ? a : b.plantedAt < a.plantedAt ? b : JSON.stringify([a.plantKind, a.ticket]) < JSON.stringify([b.plantKind, b.ticket]) ? a : b);
    var rank = { growing: 0, mature: 1, destroyed: 2, harvested: 3 };
    var current = a.updatedAt > b.updatedAt ? a : b.updatedAt > a.updatedAt ? b : rank[a.state] > rank[b.state] ? a : b;
    var out = clone(current);
    ['plantKind', 'farmId', 'ticket', 'variant', 'plantedAt'].forEach(function (k) { out[k] = identity[k]; });
    var receipts = [a, b].filter(function (s) { return s.harvestedAt; }).sort(function (x, y) { return x.harvestedAt - y.harvestedAt; });
    if (receipts.length) {
      var receipt = authority && authority.harvestedAt ? authority : receipts[0];
      ['title', 'projectId', 'completedAt', 'harvestedAt'].forEach(function (k) { out[k] = receipt[k]; });
      out.state = 'harvested';
    }
    out.retiredAt = a.retiredAt || b.retiredAt || null;
    out.forgottenAt = a.forgottenAt || b.forgottenAt || null;
    out.destroyedAt = Math.max(a.destroyedAt || 0, b.destroyedAt || 0) || null;
    if (out.retiredAt && !out.harvestedAt) { out.state = 'destroyed'; out.destroyedAt = out.destroyedAt || out.retiredAt; }
    out.updatedAt = Math.max(a.updatedAt, b.updatedAt, out.plantedAt);
    ['completedAt', 'harvestedAt', 'destroyedAt', 'retiredAt', 'forgottenAt'].forEach(function (key) { if (out[key]) out[key] = Math.max(out[key], out.plantedAt); });
    if (out.harvestedAt) out.harvestedAt = Math.max(out.harvestedAt, out.completedAt);
    if (out.forgottenAt) { out.title = ''; out.projectId = null; }
    return out;
  }
  function combineMarket(sources, out, authoritative) {
    var sales = new Map(), purchases = new Map(), equipped = sources[0].market.equipped;
    sources.forEach(function (g) {
      g.market.sales.forEach(function (s) {
        var old = sales.get(s.taskId);
        if (!old || !authoritative && s.soldAt < old.soldAt) sales.set(s.taskId, clone(s));
      });
      g.market.purchases.forEach(function (p) {
        var old = purchases.get(p.farmId);
        if (!old || !authoritative && p.purchasedAt < old.purchasedAt) purchases.set(p.farmId, clone(p));
      });
      var selected = g.market.equipped;
      if (selected.updatedAt > equipped.updatedAt || selected.updatedAt === equipped.updatedAt && selected.farmId > equipped.farmId) equipped = selected;
    });
    var seeds = new Map(out.seeds.map(function (s) { return [s.taskId, s]; }));
    out.market.sales = Array.from(sales.values()).map(function (s) { s.soldAt = Math.max(s.soldAt, seeds.get(s.taskId).harvestedAt); return s; })
      .sort(function (a, b) { return a.soldAt - b.soldAt || a.taskId.localeCompare(b.taskId); });
    // A purchase consumes currency only once per permanent farm, including concurrent purchases.
    // Preserve already accepted purchases first; validate remaining spending against accepted seed identities.
    var accepted = new Set(sources[0].market.purchases.map(function (p) { return p.farmId; }));
    var ordered = Array.from(purchases.values()).sort(function (a, b) {
      return Number(accepted.has(b.farmId)) - Number(accepted.has(a.farmId)) || a.purchasedAt - b.purchasedAt || a.farmId.localeCompare(b.farmId);
    });
    ordered.forEach(function (p) {
      if (totals(out).balance >= farmInfo(p.farmId).price) out.market.purchases.push(p);
      else if (authoritative) throw Object.assign(new Error('workspace-stale'), { code: 'workspace-stale' });
    });
    out.market.equipped = clone(owns(out.market, equipped.farmId) ? equipped : sources[0].market.equipped);
  }
  function combine(base, local, remote, authoritative) {
    var sources = [validate(base), validate(local), validate(remote)], out = empty(), seeds = new Map(), fixed = new Map(sources[0].seeds.map(function (s) { return [s.taskId, s]; }));
    sources.forEach(function (g) { g.seeds.forEach(function (s) { seeds.set(s.taskId, mergeSeed(seeds.get(s.taskId), s, fixed.get(s.taskId))); }); });
    out.seeds = Array.from(seeds.values()).sort(function (a, b) { return a.plantedAt - b.plantedAt || a.taskId.localeCompare(b.taskId); });
    var deleted = new Map(), planets = new Map(), fixedPlanets = new Set(sources[0].planets.map(function (p) { return p.id; }));
    sources.forEach(function (g) {
      g.deletedPlanets.forEach(function (r) { var old = deleted.get(r.projectId); if (!old || old.deletedAt < r.deletedAt) deleted.set(r.projectId, r); });
      g.planets.forEach(function (p) {
        var old = planets.get(p.id);
        if (!old || !authoritative && !fixedPlanets.has(p.id) && (p.completedAt < old.completedAt || p.completedAt === old.completedAt && JSON.stringify(p) < JSON.stringify(old))) planets.set(p.id, clone(p));
      });
    });
    out.deletedPlanets = Array.from(deleted.values());
    out.planets = Array.from(planets.values()).filter(function (p) { return !deleted.has(p.id); });
    out.planets.forEach(function (planet) {
      planet.flowers = planet.flowers.map(function (flower) {
        var accepted = seeds.get(flower.taskId);
        return accepted ? mergeSeed(flower, accepted, accepted) : flower;
      }).filter(function (flower) { return flower.projectId === planet.projectId; });
    });
    combineMarket(sources, out, authoritative);
    return validate(out);
  }
  function merge(base, local, remote) { return combine(base, local, remote, false); }
  function equal(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    var ak = Object.keys(a).sort(), bk = Object.keys(b).sort();
    return ak.length === bk.length && ak.every(function (key, i) { return key === bk[i] && equal(a[key], b[key]); });
  }
  function protectArchived(previous, next) {
    var removed = new Set((next.projectDeletions || []).map(function (p) { return p.id; }));
    var archived = new Set((previous && previous.projects || []).filter(function (p) { return p.status === 'completed' && !removed.has(p.id); }).map(function (p) { return p.id; }));
    if (!archived.size) return;
    var before = new Map((previous.tasks || []).map(function (task) { return [task.id, task]; }));
    var after = new Map(next.tasks.map(function (task) { return [task.id, task]; }));
    var stale = Array.from(archived).some(function (id) { return !(next.projects || []).some(function (p) { return p.id === id; }); });
    before.forEach(function (task) { if (archived.has(task.projectId) && !equal(task, after.get(task.id))) stale = true; });
    after.forEach(function (task) { if (archived.has(task.projectId) && !equal(task, before.get(task.id))) stale = true; });
    if (stale) throw Object.assign(new Error('workspace-stale'), { code: 'workspace-stale' });
  }
  // Called inside the serialized server write. Accepted seed identities and harvest receipts cannot be overwritten by stale clients.
  function preserve(previous, next, options) {
    if (!next || !Array.isArray(next.tasks)) return next;
    if (!(options && options.merge)) protectArchived(previous, next);
    if (!(previous && previous.taskGarden) && next.taskGarden === undefined) return next;
    next.taskGarden = combine(previous && previous.taskGarden, next.taskGarden, undefined, true);
    applyDeletions(next);
    var currentTasks = new Set(next.tasks.map(function (task) { return task.id; }));
    (previous && previous.tasks || []).forEach(function (task) { if (!currentTasks.has(task.id)) retireTask(next, task.id); });
    next.tasks.forEach(function (task) { if (find(next.taskGarden, task.id)) taskChanged(next, task); });
    var known = new Map((previous && previous.projects || []).filter(function (p) { return p.status === 'completed'; }).map(function (p) { return [p.id, p]; }));
    (next.projects || []).forEach(function (p) {
      var completed = known.get(p.id) || next.taskGarden.planets.find(function (planet) { return planet.id === p.id; });
      if (completed) { p.status = 'completed'; p.completedAt = completed.completedAt; }
    });
    return next;
  }
  return { KINDS: KINDS.slice(), CATALOG: clone(CATALOG), FARMS: clone(FARMS), empty: empty, validate: validate, read: read, draw: draw, variant: variant,
    inventory: inventory, economy: economy, farms: farms, sell: sell, buyFarm: buyFarm, equipFarm: equipFarm,
    taskChanged: taskChanged, reconcile: reconcile, active: active, harvest: harvest, willDestroy: willDestroy, withdrawal: withdrawal,
    retireTask: retireTask, collection: collection, archiveProject: archiveProject, removePlanet: removePlanet, importLegacy: importLegacy, applyDeletions: applyDeletions, merge: merge, preserve: preserve };
});
