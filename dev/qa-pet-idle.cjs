'use strict';
// Isolated browser QA. A controlled clock exercises the real view scheduler;
// the compact page uses the shipped pet.html with a mock desktop transport.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(root, '.cache/pet-idle-'));
Object.assign(process.env, {
  DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer',
  DOCS_PORTAL_DATA_DIR: path.join(profile, 'data'),
  DOCS_PORTAL_STATE_FILE: path.join(profile, 'bookmarks.json')
});
const { server } = require('../server');
const activities = ['fishing','exercise','farming','mining'];
const completeActivities = activities.concat(['reading','writing','crafting','tea']);
const humanoidId = 'custom_' + 'a'.repeat(32);
const portraitPath = '/api/pet-art/' + 'a'.repeat(32) + '.png';

async function tick(page, seconds = 1, desktop = false) {
  return page.evaluate(({ seconds, desktop }) => {
    for (let i = 0; i < seconds; i++) {
      window.__idleClock += 1000;
      if (desktop) window.__nativeState(window.__nativeSnapshot);
      else Tracer.pet.refresh();
    }
    return document.querySelector('.pet-home').dataset.idle;
  }, { seconds, desktop });
}

async function layout(page, caption, desktop = false) {
  const issues = await page.locator('.pet-home').evaluate((home, desktop) => {
    const issues = [], container = desktop ? home : home.closest('.modal'), bounds = container.getBoundingClientRect();
    if (container.scrollWidth > container.clientWidth + 1) issues.push('horizontal overflow');
    for (const el of home.querySelectorAll('button,.pet-name,.pet-idle-vignette')) {
      if (!el.checkVisibility()) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1) issues.push((el.className.baseVal || el.className) + ' outside container');
      if (desktop && (rect.top < -1 || rect.bottom > innerHeight + 1)) issues.push((el.className.baseVal || el.className) + ' outside compact window');
    }
    return issues;
  }, desktop);
  assert.deepEqual(issues, [], caption);
}

async function inspectActivity(page, kind, activity, desktop = false) {
  assert.equal(await page.locator('.pet-home').getAttribute('data-kind'), kind);
  assert.equal(await page.locator('.pet-home').getAttribute('data-idle'), activity);
  const builtin = await page.locator('.pet-character .pet-builtin-sprite').count() > 0;
  const garden = await page.locator('.pet-home').evaluate(el=>el.classList.contains('has-garden-animation'));
  if(builtin&&!garden) {
    const player=page.locator('.pet-character .pet-builtin-sprite');
    assert.equal(await player.getAttribute('data-action'),activity);
    assert.ok(Number(await player.getAttribute('data-frames'))>=16);
    assert.equal(await player.getAttribute('data-playback'),'playing');
    const before=await player.innerHTML();
    // Calm clips deliberately hold their resting pose before the gesture.
    await page.waitForFunction(before=>document.querySelector('.pet-character .pet-builtin-sprite').innerHTML!==before,before,{timeout:10000});
    assert.equal(await page.locator('.pet-idle-scene').isVisible(),false,'authored snapshots contain their own props without duplicate legacy scenes');
    assert.equal(await player.evaluate(el=>getComputedStyle(el).animationName),'none','no whole-character CSS animation is added to pose playback');
  } else {
    assert.ok(await page.locator('.pet-character>.pet-sprite').isVisible(), 'companion stays visible without legacy props');
  }
  assert.equal(await page.locator('.pet-idle-scene,.pet-food-prop,.pet-ball-prop').count(),0,'legacy pixel overlays are removed');
  if (desktop) await layout(page, 'compact/' + kind + '/' + activity, true);
  else {
    for (const width of [360,1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await layout(page, 'main/' + width + '/' + kind + '/' + activity);
    }
  }
  await page.locator('.pet-stage').screenshot({ path: path.join(profile, (desktop ? 'compact-' : 'main-') + kind + '-' + activity + '.png'), omitBackground: desktop });
  return page.locator('.pet-character>.pet-sprite').innerHTML();
}

async function collectCycle(page, kind, desktop = false) {
  const seen = new Map(), timeline = [];
  const expected=await page.locator('.pet-home').evaluate(el=>el.classList.contains('has-builtin-animation')&&!el.classList.contains('has-garden-animation'))?completeActivities:activities;
  for (let second = 1; second <= 740; second++) {
    const activity = await tick(page, 1, desktop); timeline.push(activity);
    if (activity && !seen.has(activity)) seen.set(activity, await inspectActivity(page, kind, activity, desktop));
    if (seen.size === expected.length) break;
  }
  assert.deepEqual([...seen.keys()].sort(), [...expected].sort(), kind + ' cycles through all supported idle activities');
  assert.equal(timeline[18], '', 'activity waits through the first nineteen quiet seconds');
  assert.ok(timeline[19], 'activity starts after twenty quiet seconds');
  assert.equal(timeline[88], timeline[19], 'activity remains active for its seventy-second slot');
  assert.equal(timeline[89], '', 'activity ends after its seventy-second slot');
  assert.equal(timeline[108], '', 'a twenty-second gap separates activities');
  assert.ok(timeline[109] && timeline[109] !== timeline[19], 'the next activity starts after the quiet gap');
  return seen;
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__idleClock = Date.now(); Date.now = () => window.__idleClock;
      window.TracerPet = { send(message) { if (message.type === 'snapshot') window.__qaSnapshot = message.value; }, onAction() {} };
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.Tracer?.pet && Tracer.store.data);
    const portrait = Buffer.from(await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
      const ctx = canvas.getContext('2d'), rect = (color,x,y,w,h) => { ctx.fillStyle = color; ctx.fillRect(x,y,w,h); };
      rect('#e9bc93',11,4,10,12); rect('#654530',10,3,12,5); rect('#654530',10,7,3,4);
      rect('#24302c',13,9,1,2); rect('#24302c',18,9,1,2); rect('#a96d60',14,13,4,1);
      rect('#6ba08d',9,16,14,10); rect('#e9bc93',7,17,3,8); rect('#e9bc93',22,17,3,8);
      rect('#394b5b',11,26,4,4); rect('#394b5b',17,26,4,4);
      return canvas.toDataURL('image/png').split(',')[1];
    }), 'base64');
    await page.route('**' + portraitPath, route => route.fulfill({ contentType: 'image/png', body: portrait }));
    await page.evaluate(({ id, image }) => {
      const state = Tracer.pet.read();
      TracerPetModel.addCustom(state, { id, image, name: 'Rowan', kind: 'humanoid', personality: 'Quiet and curious.' });
      state.selected = 'sprout'; state.lastAction = ''; state.lastActionAt = 0;
      TracerPetModel.current(state);
      const raw = JSON.stringify(state); localStorage.setItem('tracer.pet.v1', raw);
      dispatchEvent(new StorageEvent('storage', { key: 'tracer.pet.v1', newValue: raw })); Tracer.pet.refresh(true);
    }, { id: humanoidId, image: portraitPath });
    await page.click('#pet-open');
    const markup = {}, snapshots = {};
    for (const [kind,id] of [['creature','sprout'],['humanoid',humanoidId]]) {
      if (kind === 'humanoid') await page.evaluate(id => Tracer.pet.action('select',id), id);
      const baseline = await page.evaluate(() => ({
        state: Tracer.pet.read(),
        garden: TaskGarden.read(Tracer.store.base || Tracer.store.data),
        harvests: TracerGardenHarvest.read(JSON.parse(localStorage.getItem(TracerGardenHarvest.key)) || TracerGardenHarvest.fresh())
      }));
      markup[kind] = await collectCycle(page, kind);
      const unchanged = await page.evaluate(baseline => {
        const expected = TracerPetModel.read(baseline.state); TracerPetModel.advance(expected, Date.now());
        const actual = Tracer.pet.read(), keys = ['food','energy','joy','bond'];
        const garden=TaskGarden.read(Tracer.store.base || Tracer.store.data);
        const harvests=TracerGardenHarvest.read(JSON.parse(localStorage.getItem(TracerGardenHarvest.key)) || TracerGardenHarvest.fresh());
        return { needs: keys.every(key => Math.abs(actual.pets[actual.selected][key] - expected.pets[actual.selected][key]) < 1e-8),
          garden: JSON.stringify(garden) === JSON.stringify(baseline.garden), harvests: JSON.stringify(harvests) === JSON.stringify(baseline.harvests),
          unlocks: JSON.stringify(actual.unlocked) === JSON.stringify(baseline.state.unlocked) };
      }, baseline);
      assert.deepEqual(unchanged, { needs: true, garden: true, harvests: true, unlocks: true }, 'idle visuals only apply normal elapsed-time needs; no garden growth, harvest reward or unlock changes');
      snapshots[kind] = await page.evaluate(() => structuredClone(window.__qaSnapshot));
    }
    for (const activity of activities) assert.notEqual(markup.humanoid.get(activity), markup.creature.get(activity), activity + ' has different humanoid and creature artwork');
    // Botanical sheets render their authored movements without legacy props.
    await page.evaluate(()=>{
      const state=Tracer.pet.read();state.unlocked.push('garden_wildflower');state.selected='garden_wildflower';
      state.lastAction='';state.lastActionAt=0;TracerPetModel.current(state);
      const raw=JSON.stringify(state);localStorage.setItem('tracer.pet.v1',raw);
      dispatchEvent(new StorageEvent('storage',{key:'tracer.pet.v1',newValue:raw}));Tracer.pet.refresh(true);
    });
    await collectCycle(page,'creature');
    snapshots.garden=await page.evaluate(()=>structuredClone(window.__qaSnapshot));
    await page.screenshot({path:path.join(profile,'garden-ambient.png')});
    await page.evaluate(id=>Tracer.pet.action('select',id),humanoidId);
    // Actual care buttons interrupt the real scheduler, then it resumes naturally.
    await page.click('[data-act="feed"]');
    assert.equal(await page.locator('.pet-home').getAttribute('data-idle'), '');
    assert.equal(await page.locator('.pet-home').getAttribute('data-action'), 'feed');
    await tick(page, 7); assert.equal(await page.locator('.pet-home').getAttribute('data-idle'), '');
    await tick(page, 19); assert.equal(await page.locator('.pet-home').getAttribute('data-idle'), '', 'care feedback is followed by a fresh quiet interval');
    assert.ok(await tick(page), 'idle behavior resumes after care feedback and quiet time');
    await page.click('[data-act="focus-toggle"]');
    await page.waitForFunction(() => Tracer.focus.read().running);
    assert.equal(await tick(page, 40), '', 'idle stays suppressed while focusing');
    await page.click('[data-act="focus-toggle"]');
    await page.waitForFunction(() => !Tracer.focus.read().running);
    await page.click('[data-act="sleep"]');
    assert.equal(await tick(page, 40), '', 'idle stays suppressed while asleep');
    await page.click('[data-act="sleep"]');
    await tick(page, 28); assert.ok(await page.locator('.pet-home').getAttribute('data-idle'));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.pet-idle-scene').count(),0,'reduced motion does not restore removed pixel scenes');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // Use the real compact HTML/CSS/view; the transport is mocked, not Electron.
    const compact = await browser.newPage({ viewport: { width: 220, height: 284 } });
    compact.on('pageerror', error => errors.push(error.message));
    await compact.addInitScript(() => {
      window.__idleClock = Date.now(); Date.now = () => window.__idleClock;
      window.PetDesktop = { send(message) { (window.__desktopCommands ||= []).push(message); }, onState(callback) { window.__nativeState = callback; } };
    });
    await compact.route('**' + portraitPath, route => route.fulfill({ contentType: 'image/png', body: portrait }));
    await compact.goto('http://127.0.0.1:' + server.address().port + '/pet.html');
    await compact.waitForFunction(() => typeof window.__nativeState === 'function');
    for (const kind of ['creature','garden','humanoid']) {
      await compact.evaluate(snapshot => { window.__nativeSnapshot = snapshot; window.__nativeState(snapshot); }, snapshots[kind]);
      await collectCycle(compact, kind==='garden'?'creature':kind, true);
    }
    await compact.locator('.pet-character').hover(); await compact.click('.pet-panel-toggle'); await compact.setViewportSize({ width: 380, height: 700 });
    assert.ok(await tick(compact, 20, true));
    assert.ok(await compact.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'expanded desktop view does not overflow horizontally');
    await compact.screenshot({ path: path.join(profile, 'expanded-humanoid.png') });
    await compact.click('[data-tab="chat"]');
    assert.equal(await tick(compact, 20, true), '', 'an open desktop chat panel suppresses idle behavior');
    await compact.click('.pet-panel-toggle'); await compact.setViewportSize({ width: 220, height: 284 });
    assert.equal(await tick(compact, 19, true), '');
    assert.ok(await tick(compact, 1, true), 'collapsing a selected chat panel allows idle behavior to resume');
    const character = await compact.locator('.pet-character').boundingBox();
    await compact.mouse.move(character.x + character.width / 2, character.y + character.height / 2); await compact.mouse.down();
    assert.equal(await tick(compact, 12, true), '', 'holding the desktop character suppresses idle behavior');
    await compact.mouse.up();
    assert.equal(await tick(compact, 19, true), '');
    assert.ok(await tick(compact, 1, true), 'idle resumes after releasing the desktop character and waiting');
    await compact.evaluate(() => { window.__nativeSnapshot.focus.running = true; window.__nativeSnapshot.focus.completed = false; window.__nativeState(window.__nativeSnapshot); });
    assert.equal(await tick(compact, 12, true), '', 'an active focus round suppresses desktop idle behavior');
    await compact.evaluate(() => { window.__nativeSnapshot.focus.running = false; window.__nativeSnapshot.focus.completed = true; window.__nativeState(window.__nativeSnapshot); });
    assert.equal(await tick(compact, 19, true), '');
    assert.ok(await tick(compact, 1, true), 'a completed focus round permits idle to resume after its quiet interval');
    assert.deepEqual(errors, [], 'no renderer errors');
    console.log('PASS eight built-in work actions and four legacy humanoid activities, timing, authored poses without pixel overlays, live motion/reduced motion, care/focus/sleep interruptions, no rewards, responsive main and minimal 220×284 compact layouts');
    console.log('Artifacts: ' + profile);
  } finally {
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
