'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const Idle = require('../skins/tracer/pet-idle');
const Personalities = require('../skins/tracer/pet-personalities');
const pet = Object.freeze({ petId: 'sprout', kind: 'creature', blocked: false });
const actions = ['fishing', 'exercise', 'farming', 'mining'];

test('expanded packs alternate quiet work with the four original activities; legacy packs keep their own artwork', () => {
  const input = Object.freeze({ ...pet, petId: 'custom_sample', workActivities: true });
  const idle = Idle.create(), seen = [], cycle = Idle.quietTime + Idle.activeTime;
  for (let now = 0; now < 9 * cycle; now += 1000) {
    const value = idle.update(input, now);
    if (now % cycle === Idle.quietTime) seen.push(value);
  }
  assert.equal(new Set(seen.slice(0, 8)).size, 8);
  assert.equal(seen[8], seen[0]);
  const work = ['reading', 'writing', 'crafting', 'tea'];
  for (let i = 1; i < seen.length; i++) assert.notEqual(work.includes(seen[i]), work.includes(seen[i - 1]));
  const legacy = Idle.create(), legacySeen = new Set();
  for (let now = 0; now < 4 * cycle; now += 1000) {
    const value = legacy.update({ ...input, workActivities: false }, now);
    if (value) legacySeen.add(value);
  }
  assert.deepEqual([...legacySeen].sort(), [...actions].sort());
});

test('idle activities start after twenty seconds, run for seventy, and rotate through all four', () => {
  const idle = Idle.create(), observed = [];
  for (let now = 0; now <= 5 * 90000; now += 2500) {
    const value = idle.update(pet, now), cycle = Math.floor(now / 90000);
    if (now % 90000 < 20000) assert.equal(value, '', 'quiet at ' + now);
    else {
      assert.ok(actions.includes(value));
      if (!observed[cycle]) observed[cycle] = value;
      assert.equal(value, observed[cycle], 'activity stays stable at ' + now);
    }
  }
  assert.equal(new Set(observed.slice(0, 4)).size, 4);
  assert.equal(observed[4], observed[0]);
  assert.deepEqual(observed.slice(0,4), Personalities.get('sprout').activityOrder, 'the sheep starts with gardening and follows its own preferred routine');
});

test('pet offsets are deterministic and independent between views without mutating input', () => {
  const starts = new Set();
  for (const id of ['sprout', 'miso', 'brook', 'ember', 'luna', 'nova']) {
    const input = Object.freeze({ ...pet, petId: id }), one = Idle.create(), two = Idle.create();
    one.update(input, 0); two.update(input, 12500);
    const first = one.update(input, 20000);
    assert.equal(first, Personalities.get(id).activityOrder[0], id + ' starts with its own favorite activity');
    assert.equal(two.update(input, 32500), first);
    starts.add(first); assert.deepEqual(input, { ...pet, petId: id });
  }
  assert.ok(starts.size > 1);
});

test('manual reset preserves its explicit anchor on the next update and stops the previous activity', () => {
  const idle = Idle.create();
  idle.update(pet, 0); assert.ok(idle.update(pet, 20000));
  idle.reset(25000);
  assert.equal(idle.update(pet, 44997.5), '');
  assert.ok(idle.update(pet, 45000));
  idle.reset(50000);
  assert.ok(idle.update(pet, 112500)); // No sample between reset and this first update.
  const fresh = Idle.create(); fresh.reset(150000);
  assert.ok(fresh.update(pet, 170000));
});

test('repeated blocked samples and the first unblocked sample each preserve a full quiet wait', () => {
  const idle = Idle.create(), blocked = Object.freeze({ ...pet, blocked: true });
  idle.update(pet, 0); assert.ok(idle.update(pet, 20000));
  assert.equal(idle.update(blocked, 22500), '');
  assert.equal(idle.update(blocked, 125000), '');
  assert.equal(idle.update(pet, 250000), '');
  assert.equal(idle.update(pet, 269997.5), '');
  assert.ok(idle.update(pet, 270000));
});

test('pet changes, form changes, reversed clocks, and suspended updates restart the quiet interval', () => {
  const idle = Idle.create();
  idle.update(pet, 0); assert.ok(idle.update(pet, 20000));
  const other = { ...pet, petId: 'miso' };
  assert.equal(idle.update(other, 22500), ''); assert.ok(idle.update(other, 42500));
  const humanoid = { ...other, kind: 'humanoid' };
  assert.equal(idle.update(humanoid, 45000), ''); assert.ok(idle.update(humanoid, 65000));
  assert.equal(idle.update(humanoid, 2500), ''); assert.ok(idle.update(humanoid, 22500));
  assert.equal(idle.update(humanoid, 300000), '');
  assert.equal(idle.update(humanoid, 319997.5), ''); assert.ok(idle.update(humanoid, 320000));
  assert.equal(idle.update(humanoid, 340002.5), ''); // More than twenty seconds without an update.
  assert.ok(idle.update(humanoid, 360002.5));
});

test('invalid input or nonfinite times remain quiet and recover without timer or state side effects', () => {
  const idle = Idle.create();
  for (const input of [undefined, null, {}, { ...pet, petId: '' }, { ...pet, kind: 'invalid' }]) assert.equal(idle.update(input, 0), '');
  assert.equal(idle.update(pet, 2500), ''); assert.ok(idle.update(pet, 22500));
  for (const value of [NaN, Infinity, -Infinity, '25000']) {
    assert.equal(idle.update(pet, value), '');
    assert.equal(idle.update(pet, 25000), ''); assert.ok(idle.update(pet, 45000));
  }
  idle.reset(Number.MAX_VALUE); assert.equal(idle.update(pet, -Number.MAX_VALUE), '');
});

test('browser export is usable without DOM, storage, or timer APIs', () => {
  const context = vm.createContext({ self: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../skins/tracer/pet-idle.js'), 'utf8'), context);
  assert.equal(typeof context.self.TracerPetIdle.create, 'function');
  const idle = context.self.TracerPetIdle.create();
  assert.equal(idle.update(pet, 0), ''); assert.ok(idle.update(pet, 20000));
});

test('interactions, explicit pauses, and suspension cannot starve later idle actions', () => {
  for (const petId of ['sprout', 'miso', 'custom_sample']) {
    for (const workActivities of [false, true]) {
      for (const interruption of ['blocked', 'reset', 'suspended']) {
        const idle = Idle.create(), input = { ...pet, petId, workActivities }, seen = [];
        const count = workActivities ? 8 : 4;
        let now = 0;
        idle.update(input, now);
        for (let index = 0; index <= count; index++) {
          now += Idle.quietTime;
          const action = idle.update(input, now);
          assert.ok(action);
          seen.push(action);
          now += 1000;
          assert.equal(idle.update(input, now), action, 'ordinary updates keep the current action');
          if (interruption === 'blocked') {
            assert.equal(idle.update({ ...input, blocked: true }, ++now), '');
            now += 1000;
            assert.equal(idle.update({ ...input, blocked: true }, now), '');
            assert.equal(idle.update(input, ++now), '');
          } else if (interruption === 'reset') {
            idle.reset(++now);
            idle.reset(++now);
            assert.equal(idle.update(input, now), '');
          } else {
            now += Idle.quietTime + 1;
            assert.equal(idle.update(input, now), '');
          }
        }
        assert.equal(new Set(seen.slice(0, count)).size, count, `${petId}/${workActivities}/${interruption}`);
        assert.equal(seen[count], seen[0], 'wrap only after every eligible action has appeared');
      }
    }
  }
});

test('interruptions during the quiet interval do not consume unseen activities', () => {
  const idle = Idle.create(), input = { ...pet, workActivities: true };
  idle.update(input, 0);
  idle.reset(5000);
  assert.equal(idle.update({ ...input, blocked: true }, 10000), '');
  assert.equal(idle.update(input, 15000), '');
  assert.equal(idle.update(input, 35000), 'farming');
  for (let now = 45000; now <= 105000; now += 10000) assert.equal(idle.update(input, now), now === 105000 ? '' : 'farming');
  idle.reset(110000);
  assert.equal(idle.update(input, 130000), 'reading');
});
