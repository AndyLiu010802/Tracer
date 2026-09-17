'use strict';
// Isolated recovery QA. All image generation is intercepted and every image is
// drawn locally; no user profile, API credentials or paid AI generation is used.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const Images = require('../lib/pet-image');
const { fixtures } = require('./qa-pet-dense-animation.cjs');
const { fixtures: legacyFixtures } = require('./qa-pet-animation.cjs');
const root = path.resolve(__dirname, '..');
const actions = ['idle','pet','feed','play','sleep','wake','focus','drag','fishing','exercise','farming','mining','reading','writing','crafting','tea'];
const sequence = (start = 0, end = 16) => Array.from({ length: end - start }, (_, i) => i + start);
const entry = '#pet-generation-status';

async function until(predicate, label, timeout = 20000) {
  const started = Date.now();
  while (!await predicate()) {
    if (Date.now() - started > timeout) throw new Error('Timed out: ' + label);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

async function ready(page, origin) {
  await page.goto(origin);
  await page.waitForFunction(() => window.Tracer?.pet && Tracer.store.data && window.TracerPetGenerationDraft);
  await page.selectOption('#language-select', 'en');
}

async function draftAt(page, completed) {
  await until(async()=>{
    const draft=await page.evaluate(()=>TracerPetGenerationDraft.create().load());
    return completed===null?draft===null:draft?.pages?.length===completed;
  },'durable draft reaches '+String(completed)+' pages');
  return page.evaluate(() => TracerPetGenerationDraft.create().load());
}

async function progressAt(page, completed) {
  await page.locator(entry).waitFor({ state: 'visible' });
  await page.waitForFunction(({ selector, completed }) => {
    return Number(document.querySelector(selector + ' progress')?.value) === completed;
  }, { selector: entry, completed });
  const progress = await page.locator(entry + ' progress').evaluate(el => ({ value: el.value, max: el.max }));
  assert.equal(progress.max, 16);
  assert.equal(progress.value / progress.max, completed / 16, 'progress is the number of completed actions, including a genuine 100% at sixteen');
}

async function dismissRestart(page, selector, mock) {
  const before = mock.calls.map(call => call.animationPage);
  const opened = page.waitForEvent('dialog').then(async dialog => {
    try {
      assert.equal(dialog.type(), 'confirm', 'discarding generated actions requires an explicit confirmation');
      assert.match(dialog.message(), /start over|regenerat|completed|discard|重新|已生成|丢弃/i);
    } finally { await dialog.dismiss(); }
  });
  await Promise.all([opened, page.click(selector, { noWaitAfter: true })]);
  assert.deepEqual(mock.calls.map(call => call.animationPage), before, 'cancelled restart makes no image requests');
}

async function acceptDiscard(page) {
  const opened = page.waitForEvent('dialog').then(async dialog => {
    assert.equal(dialog.type(), 'confirm');
    assert.match(dialog.message(), /discard.*draft|放弃.*草稿/i);
    await dialog.accept();
  });
  await Promise.all([opened, page.click('.pet-discard-draft', { noWaitAfter: true })]);
}

async function acceptActionReplacement(page) {
  const opened=page.waitForEvent('dialog').then(async dialog=>{
    assert.equal(dialog.type(),'confirm');
    assert.match(dialog.message(),/action|动作/i);
    await dialog.accept();
  });
  await Promise.all([opened,page.click('.pet-regenerate-action',{noWaitAfter:true})]);
}

async function delayNextDraftDelete(page) {
  await page.evaluate(() => {
    const originalDelete = IDBObjectStore.prototype.delete, originalPut = IDBObjectStore.prototype.put;
    const gate = window.__recoveryDelete = { originalDelete, originalPut, armed: true, committed: false, notified: false, latePuts: 0, release: null };
    const target = store => store.name === 'drafts' && store.transaction.db.name === 'tracer-pet-generation';
    IDBObjectStore.prototype.put = function (...args) {
      if (target(this) && gate.committed) gate.latePuts++;
      return originalPut.apply(this, args);
    };
    IDBObjectStore.prototype.delete = function (...args) {
      const request = originalDelete.apply(this, args);
      if (target(this) && gate.armed) {
        gate.armed = false;
        const transaction = this.transaction;
        let notifyComplete;
        // Keep a real IndexedDB delete/commit; only delay delivery of its
        // completion callback to the app, exposing the clear() await window.
        Object.defineProperty(transaction, 'oncomplete', {
          configurable: true,
          get() { return notifyComplete; },
          set(handler) { notifyComplete = handler; }
        });
        transaction.addEventListener('complete', event => {
          gate.committed = true;
          gate.release = () => {
            gate.notified = true;
            if (notifyComplete) notifyComplete.call(transaction, event);
          };
        });
      }
      return request;
    };
  });
}

async function closeDuringDraftDelete(page, label, profile) {
  await until(() => page.evaluate(() => !!window.__recoveryDelete?.release), label + ' reaches the delayed delete completion');
  assert.equal(await page.locator('.pet-creator').getAttribute('aria-busy'), 'true', label + ' is still awaiting deletion');
  await closeCreator(page, 'escape');
  await page.evaluate(() => Tracer.ui.modal((box, close) => {
    box.id = 'recovery-delete-editor-dialog';
    const input = document.createElement('textarea'); input.id = 'recovery-delete-editor'; input.value = 'Keep the notes I started while the draft was clearing.';
    const button = document.createElement('button'); button.textContent = 'Close editor'; button.onclick = close;
    box.append(input, button);
  }));
  await page.evaluate(() => window.__recoveryDelete.release());
  await page.locator(entry).waitFor({ state: 'hidden' });
  // load shares the persistence queue, so it observes any late write that a
  // modal close incorrectly queued after clear rather than racing that write.
  assert.equal(await page.evaluate(() => TracerPetGenerationDraft.create().load()), null, label + ' stays deleted after closing during clear');
  assert.equal(await page.evaluate(() => window.__recoveryDelete.latePuts), 0, label + ' schedules no late draft writes');
  assert.equal(await page.locator('#recovery-delete-editor-dialog').isVisible(), true, label + ' does not replace the new editor');
  assert.equal(await page.inputValue('#recovery-delete-editor'), 'Keep the notes I started while the draft was clearing.');
  await page.screenshot({ path: path.join(profile, 'delayed-' + label + '-preserves-editor.png'), animations: 'disabled' });
  await page.evaluate(() => {
    IDBObjectStore.prototype.delete = window.__recoveryDelete.originalDelete;
    IDBObjectStore.prototype.put = window.__recoveryDelete.originalPut;
    delete window.__recoveryDelete;
  });
}

async function rawDraft(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const opened = indexedDB.open('tracer-pet-generation', 1);
    opened.onerror = () => reject(opened.error);
    opened.onsuccess = () => {
      const db = opened.result, transaction = db.transaction('drafts', 'readonly');
      const request = transaction.objectStore('drafts').get('draft');
      transaction.oncomplete = () => { const result = request.result; db.close(); resolve(result === undefined ? null : result); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    };
  }));
}

async function openNew(page, portrait, name) {
  await page.click('#pet-open');
  await page.click('[data-tab="collection"]');
  await page.click('[data-act="open-create"]');
  await page.locator('#pet-photo').setInputFiles({ name: 'synthetic-reference.png', mimeType: 'image/png', buffer: portrait });
  await page.fill('#pet-custom-name', name);
  await page.selectOption('#pet-custom-kind', 'humanoid');
  await page.fill('#pet-custom-personality', 'Patient, curious, and fond of quiet reading.');
  await page.fill('#pet-distinctive-features', 'Keep the green shirt and brown hair.');
  await page.locator('.pet-photo-preview').waitFor({ state: 'visible' });
  return page.locator('.pet-photo-preview').getAttribute('src');
}

async function closeCreator(page, method = 'button') {
  if (method === 'escape') await page.keyboard.press('Escape');
  else if (method === 'backdrop') await page.locator('#modal-root').click({ position: { x: 3, y: 3 } });
  else await page.locator('.pet-top [data-act="cancel-create"]').click();
  await page.locator('.pet-create-form').waitFor({ state: 'hidden' });
}

async function assertComplete(page, mock, name, photo, paths) {
  await page.locator('.pet-adopt').waitFor({ state: 'visible' });
  assert.equal(await page.inputValue('#pet-custom-name'), name);
  assert.equal(await page.locator('.pet-photo-preview').getAttribute('src'), photo);
  assert.equal(await page.locator('.pet-animation-progress').getAttribute('value'), '16');
  assert.deepEqual(await page.locator('#pet-preview-action option').evaluateAll(options => options.map(option => ({ value: option.value, disabled: option.disabled }))), actions.map(value => ({ value, disabled: false })));
  const draft = await draftAt(page, 16);
  assert.equal(draft.name, name);
  assert.equal(draft.animationVersion, 2);
  assert.deepEqual(draft.pages, paths);
  assert.equal(draft.photo, photo);
  assert.equal(mock.calls.every(call => call.animationVersion === 2), true);
  for (const call of mock.calls) {
    assert.equal(call.photo, photo);
    if (call.animationPage) assert.equal(call.identityImage, paths[0]);
  }
}

async function mockContext(browser, origin, paths) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  const calls = [], errors = [], unexpected = [], blockedExternal = [], holds = new Set(), held = new Map(), responses = new Map();
  let failOnce = -1;
  // One catch-all interceptor prevents accidental access to a configured local
  // AI account and to every remote endpoint, even if the app adds new routes.
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { blockedExternal.push(url.origin + url.pathname); return route.abort('blockedbyclient'); }
    if (!url.pathname.startsWith('/api/ai/')) return route.continue();
    if (url.pathname === '/api/ai/codex-status') return route.fulfill({ json: { configured: true, account: { type: 'chatgpt', planType: 'pro' }, imageGeneration: true } });
    if (url.pathname === '/api/ai/personal-status') return route.fulfill({ json: { configured: true, tested: true, hasKey: true, url: 'https://mock.invalid/v1' } });
    if (url.pathname !== '/api/ai/codex-pet-image') {
      unexpected.push(url.pathname);
      return route.fulfill({ status: 503, json: { error: 'synthetic-qa-no-ai' } });
    }
    const call = request.postDataJSON();
    calls.push(call);
    assert.equal(request.method(), 'POST');
    assert.equal(call.animationVersion, 2);
    assert.ok(Number.isInteger(call.animationPage) && call.animationPage >= 0 && call.animationPage < 16);
    if (call.animationPage === failOnce) {
      failOnce = -1;
      return route.fulfill({ status: 400, json: { error: 'codex-image-no-result' } });
    }
    if (holds.has(call.animationPage)) {
      holds.delete(call.animationPage);
      await new Promise(resolve => held.set(call.animationPage, resolve));
      held.delete(call.animationPage);
    }
    await route.fulfill({ json: { image: responses.get(call.animationPage)||paths[call.animationPage], animationPage: call.animationPage, animationVersion: 2, model: 'synthetic-recovery-fixture' } });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => { if (dialog.type() === 'beforeunload') void dialog.accept(); });
  return {
    context, page, calls, errors, unexpected, blockedExternal,
    hold(index) { holds.add(index); },
    fail(index) { failOnce = index; },
    respond(index,image) { responses.set(index,image); },
    waiting(index) { return held.has(index); },
    release(index) { assert.ok(held.has(index), 'a request is held for action ' + index); held.get(index)(); },
    async close() { for (const resolve of held.values()) resolve(); await context.close(); }
  };
}

async function backgroundAndComplete(browser, origin, paths, portrait, profile) {
  const mock = await mockContext(browser, origin, paths), { page } = mock;
  try {
    await ready(page, origin);
    assert.equal(await page.locator(entry).isVisible(), false, 'fresh profile has no pending generation');
    const name = 'Juniper Recovery', photo = await openNew(page, portrait, name);
    mock.hold(5); mock.hold(7);
    await page.click('.pet-generate');
    await until(() => mock.waiting(5), 'first background gate');
    await progressAt(page, 5);
    await draftAt(page, 5);
    await closeCreator(page);
    await progressAt(page, 5);
    await page.setViewportSize({ width: 900, height: 1000 });
    const layout = await page.locator(entry).evaluate(el => {
      const bounds = el.getBoundingClientRect(), bar = el.querySelector('progress').getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, barWidth: bar.width, viewport: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    assert.ok(layout.width > 0 && layout.barWidth > 0 && layout.top >= 0 && layout.left >= 0 && layout.right <= layout.viewport + 1, 'the navigation progress remains visible at 900px');
    assert.equal(layout.overflow, false, '900px layout has no horizontal page overflow');
    await page.screenshot({ path: path.join(profile, 'background-progress-900px.png'), animations: 'disabled' });
    // Keep the mocked request held across an ordinary app heartbeat. Elapsed
    // time must never increase a count which represents completed AI actions.
    await page.waitForTimeout(1250);
    await progressAt(page, 5);
    assert.deepEqual(mock.calls.map(call => call.animationPage), sequence(0, 6));
    await page.setViewportSize({ width: 1440, height: 1000 });
    mock.release(5);
    await until(() => mock.waiting(7), 'requests continue while creator is closed');
    await progressAt(page, 7);
    assert.deepEqual(mock.calls.map(call => call.animationPage), sequence(0, 8));
    await page.click(entry);
    await page.locator('.pet-create-form').waitFor();
    assert.equal(await page.inputValue('#pet-custom-name'), name);
    assert.equal(await page.locator('.pet-photo-preview').getAttribute('src'), photo);
    assert.equal(await page.locator('.pet-animation-progress').getAttribute('value'), '7');
    assert.equal(await page.locator('.pet-creator').getAttribute('aria-busy'), 'true');
    await closeCreator(page, 'escape');
    mock.release(7);
    await assertComplete(page, mock, name, photo, paths);
    assert.deepEqual(mock.calls.map(call => call.animationPage), sequence(), 'background completion performs exactly sixteen image requests');
    assert.equal(await page.evaluate(() => Tracer.pet.read().customs.length), 0, 'completion still requires saving the companion');
    await page.screenshot({ path: path.join(profile, 'background-complete.png'), animations: 'disabled' });

    await closeCreator(page);
    await progressAt(page, 16);
    await page.locator('#task-notice').waitFor({ state: 'visible' });
    assert.match(await page.locator('#task-notice').innerText(), /unsaved|not saved|save|未保存|保存/i, 'closing completed artwork shows an unsaved reminder');
    await page.click(entry);
    await assertComplete(page, mock, name, photo, paths);

    // Simulate failure only for the synthetic companion's write. Regular app
    // preferences and autosaves remain functional, making this a real failure
    // of the adoption path rather than an unavailable browser environment.
    await page.evaluate(() => {
      window.__recoverySetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'tracer.pet.v1' && JSON.parse(value).customs?.length) throw new DOMException('Synthetic QA quota failure', 'QuotaExceededError');
        return window.__recoverySetItem.call(this, key, value);
      };
    });
    await page.click('.pet-adopt');
    await page.waitForFunction(() => /save|存储|保存/i.test(document.querySelector('.pet-create-error')?.textContent || ''));
    assert.equal(await page.evaluate(() => Tracer.pet.read().customs.length), 0, 'failed storage does not pretend to adopt');
    await assertComplete(page, mock, name, photo, paths);
    await progressAt(page, 16);
    await page.screenshot({ path: path.join(profile, 'save-failure-keeps-results.png'), animations: 'disabled' });
    await page.evaluate(() => { Storage.prototype.setItem = window.__recoverySetItem; delete window.__recoverySetItem; });

    await closeCreator(page);
    await page.reload();
    await page.waitForFunction(() => window.Tracer?.pet && Tracer.store.data);
    await assertComplete(page, mock, name, photo, paths);
    assert.deepEqual(mock.calls.map(call => call.animationPage), sequence(), 'reloading complete artwork requests no new generation');
    await page.click('.pet-generate');
    assert.deepEqual(mock.calls.map(call => call.animationPage), sequence(), 'the completed preview button never regenerates actions');
    await dismissRestart(page, '.pet-restart-generation', mock);
    await assertComplete(page, mock, name, photo, paths);
    await page.screenshot({ path: path.join(profile, 'completed-draft-restored.png'), animations: 'disabled' });
    await delayNextDraftDelete(page);
    await page.click('.pet-adopt');
    await closeDuringDraftDelete(page, 'save', profile);
    await page.locator('.pet-create-form').waitFor({ state: 'hidden' });
    await page.locator(entry).waitFor({ state: 'hidden' });
    await draftAt(page, null);
    const saved = await page.evaluate(() => Tracer.pet.read().customs);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].name, name);
    assert.deepEqual(saved[0].animation, { version: 2, pages: paths });
    await page.reload();
    await page.waitForFunction(() => window.Tracer?.pet && Tracer.store.data);
    await draftAt(page, null);
    assert.equal(await page.locator(entry).isVisible(), false);
    assert.equal(await page.locator('.pet-create-form').isVisible(), false);
    assert.deepEqual(await page.evaluate(() => Tracer.pet.read().customs), saved);
    assert.deepEqual(mock.calls.map(call => call.animationPage), sequence());
    assert.deepEqual(mock.errors, []);
    assert.deepEqual(mock.unexpected, [], 'no fallback or live AI route is invoked');
    assert.deepEqual(mock.blockedExternal, []);
    console.log('PASS background generation, status return, automatic completion, unsaved reminder, failed save, completed reload, confirmed regeneration and successful draft cleanup');
  } finally { await mock.close(); }
}

async function partialResume(browser, origin, paths, portrait, profile) {
  const mock = await mockContext(browser, origin, paths), { page } = mock;
  try {
    await ready(page, origin);
    const name = 'Rowan Partial', photo = await openNew(page, portrait, name);
    mock.fail(5);
    await page.click('.pet-generate');
    await page.waitForFunction(() => !document.querySelector('.pet-generate').disabled && document.querySelector('.pet-create-error').textContent.includes('returned no image'));
    await draftAt(page, 5);
    await progressAt(page, 5);
    assert.deepEqual(mock.calls.map(call => call.animationPage), sequence(0, 6));
    await dismissRestart(page, '.pet-restart-generation', mock);
    await draftAt(page, 5);
    assert.equal(await page.locator('.pet-animation-progress').getAttribute('value'), '5');

    await page.reload();
    await page.waitForFunction(() => window.Tracer?.pet && Tracer.store.data);
    await progressAt(page, 5);
    await draftAt(page, 5);
    assert.equal(await page.locator('.pet-create-form').isVisible(), false, 'partial drafts wait for the user to resume');
    assert.deepEqual(mock.calls.map(call => call.animationPage), sequence(0, 6), 'reload never automatically resumes generation');
    await page.click(entry);
    assert.equal(await page.inputValue('#pet-custom-name'), name);
    assert.equal(await page.locator('.pet-photo-preview').getAttribute('src'), photo);
    assert.equal(await page.locator('.pet-animation-progress').getAttribute('value'), '5');
    mock.hold(15);
    await page.click('.pet-generate');
    await until(() => mock.waiting(15), 'resumed generation reaches the final action');
    await progressAt(page, 15);
    await closeCreator(page);
    // A separate editor uses the app's shared modal API. Completion must not
    // replace its unsaved text; it can reopen the creator once the editor closes.
    await page.evaluate(() => Tracer.ui.modal((box, close) => {
      box.id = 'recovery-other-dialog';
      const input = document.createElement('textarea'); input.id = 'recovery-other-editor'; input.value = 'Unsaved task notes must stay here.';
      const button = document.createElement('button'); button.id = 'recovery-other-close'; button.textContent = 'Close editor'; button.onclick = close;
      box.append(input, button);
    }));
    mock.release(15);
    await progressAt(page, 16);
    await draftAt(page, 16);
    assert.equal(await page.locator('#recovery-other-dialog').isVisible(), true, 'completion does not replace another open modal');
    assert.equal(await page.inputValue('#recovery-other-editor'), 'Unsaved task notes must stay here.');
    assert.equal(await page.locator('.pet-create-form').isVisible(), false);
    await page.screenshot({ path: path.join(profile, 'completion-preserves-other-editor.png'), animations: 'disabled' });
    await page.click('#recovery-other-close');
    await assertComplete(page, mock, name, photo, paths);
    assert.deepEqual(mock.calls.map(call => call.animationPage), [...sequence(0, 6), ...sequence(5)], 'resume retries only the failed action and remaining actions');
    await page.click('.pet-adopt');
    await page.locator(entry).waitFor({ state: 'hidden' });
    await draftAt(page, null);
    assert.equal(await page.evaluate(() => Tracer.pet.read().customs.length), 1);
    assert.deepEqual(mock.errors, []);
    assert.deepEqual(mock.unexpected, []);
    assert.deepEqual(mock.blockedExternal, []);
    console.log('PASS partial reload without automatic requests, cancelled restart, remaining-action resume and deferred completion without replacing another editor');
  } finally { await mock.close(); }
}

async function checkpointAndDiscard(browser, origin, paths, portrait, profile) {
  const mock = await mockContext(browser, origin, paths), { page } = mock;
  try {
    await ready(page, origin);
    const name = 'Alder Checkpoint', photo = await openNew(page, portrait, name);
    const initial = await draftAt(page, 0);
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      window.__recoveryIDB = { original, mode: 'throw-put', thrown: 0, aborted: 0, successesBeforeAbort: 0 };
      IDBObjectStore.prototype.put = function (value, ...args) {
        const fault = window.__recoveryIDB;
        const target = this.name === 'drafts' && this.transaction.db.name === 'tracer-pet-generation';
        if (target && fault.mode === 'throw-put') {
          fault.thrown++;
          throw new DOMException('Synthetic QA draft write failure', 'QuotaExceededError');
        }
        const request = original.call(this, value, ...args);
        if (target && fault.mode === 'abort-one-page' && value?.draft?.pages?.length >= 1) {
          // Exercise the stronger failure: a put request succeeded, but its
          // transaction never committed. Only the previous durable draft remains.
          const transaction = this.transaction;
          request.addEventListener('success', () => {
            fault.successesBeforeAbort++;
            transaction.abort();
            fault.aborted++;
          });
        }
        return request;
      };
    });
    await page.click('.pet-generate');
    await page.waitForFunction(() => !document.querySelector('.pet-generate').disabled && /recovery draft could not be saved/i.test(document.querySelector('.pet-create-error').textContent));
    assert.deepEqual(mock.calls, [], 'an unsuccessful initial checkpoint prevents every image-generation POST');
    assert.ok(await page.evaluate(() => window.__recoveryIDB.thrown > 0));
    assert.equal(await page.locator('.pet-draft-warning').isVisible(), true);
    assert.equal(await page.locator('.pet-photo-preview').getAttribute('src'), photo);
    await draftAt(page, 0);
    await page.locator('.pet-create-error').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(profile, 'checkpoint-failure-before-generation.png'), animations: 'disabled' });

    await page.evaluate(() => { window.__recoveryIDB.mode = 'abort-one-page'; });
    mock.hold(0);
    await page.click('.pet-generate');
    await until(() => mock.waiting(0), 'storage recovery allows the first generation request');
    await closeCreator(page, 'backdrop');
    await progressAt(page, 0);
    mock.release(0);
    await progressAt(page, 1);
    await until(() => page.evaluate(() => window.__recoveryIDB.aborted > 0), 'the returned first action reaches an aborted draft transaction');
    await page.click(entry);
    await page.waitForFunction(() => !document.querySelector('.pet-generate').disabled && /recovery draft could not be saved/i.test(document.querySelector('.pet-create-error').textContent));
    assert.deepEqual(mock.calls.map(call => call.animationPage), [0], 'a failed post-image checkpoint stops before requesting the next action');
    assert.equal(await page.locator('.pet-animation-progress').getAttribute('value'), '1');
    assert.equal(await page.locator('.pet-result-frame .pet-animated-sprite').getAttribute('data-page'), '0', 'the returned action stays previewable in memory');
    assert.equal(await page.locator('.pet-photo-preview').getAttribute('src'), photo);
    const durable = await draftAt(page, 0);
    assert.equal(durable.generationId, initial.generationId, 'failed transactions retain the previously committed generation identity');
    assert.ok(await page.evaluate(() => window.__recoveryIDB.successesBeforeAbort > 0), 'the test actually aborts after request success');
    await page.locator('.pet-create-error').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(profile, 'checkpoint-failure-keeps-first-action.png'), animations: 'disabled' });

    await page.evaluate(() => { window.__recoveryIDB.mode = 'off'; });
    await page.click('.pet-generate');
    await assertComplete(page, mock, name, photo, paths);
    assert.deepEqual(mock.calls.map(call => call.animationPage), sequence(), 'restoring draft storage continues after the retained action without regenerating it');
    assert.ok(mock.calls.every(call => call.generationId === initial.generationId && call.generationAttempt === 0), 'storage failures keep the same generation identity and attempt');
    await dismissRestart(page, '.pet-discard-draft', mock);
    await assertComplete(page, mock, name, photo, paths);
    await progressAt(page, 16);
    await delayNextDraftDelete(page);
    await acceptDiscard(page);
    await closeDuringDraftDelete(page, 'discard', profile);
    await page.locator('.pet-create-form').waitFor({ state: 'hidden' });
    await page.locator(entry).waitFor({ state: 'hidden' });
    await draftAt(page, null);
    assert.equal(await page.evaluate(() => Tracer.pet.read().customs.length), 0, 'discarding a draft does not save a companion');
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.__recoveryIDB.original; delete window.__recoveryIDB; });
    await page.reload();
    await page.waitForFunction(() => window.Tracer?.pet && Tracer.store.data);
    await draftAt(page, null);
    assert.equal(await page.locator(entry).isVisible(), false, 'a confirmed discarded draft stays removed after reload');
    assert.equal(await page.locator('.pet-create-form').isVisible(), false);
    assert.deepEqual(mock.calls.map(call => call.animationPage), sequence());
    assert.deepEqual(mock.errors, []);
    assert.deepEqual(mock.unexpected, []);
    assert.deepEqual(mock.blockedExternal, []);
    console.log('PASS initial put failure prevents generation, post-image transaction abort retains its action and pauses requests, recovered storage resumes once, backdrop close keeps generation alive and only confirmed discard clears the draft');
  } finally { await mock.close(); }
}

async function emptyAndCorruptDrafts(browser, origin, paths, profile) {
  const empty = await mockContext(browser, origin, paths);
  try {
    const { page } = empty;
    await ready(page, origin);
    await page.click('#pet-open');
    await page.click('[data-tab="collection"]');
    await page.click('[data-act="open-create"]');
    await page.fill('#pet-custom-name', 'Name-only draft');
    assert.equal((await draftAt(page, 0)).name, 'Name-only draft');
    await page.fill('#pet-custom-name', '');
    await draftAt(page, null);
    await page.locator(entry).waitFor({ state: 'hidden' });
    await closeCreator(page);
    await page.reload();
    await page.waitForFunction(() => window.Tracer?.pet && Tracer.store.data);
    await draftAt(page, null);
    assert.equal(await page.locator(entry).isVisible(), false, 'clearing the only edited field removes the empty draft across reload');
    assert.equal(await page.locator('.pet-create-form').isVisible(), false);
    assert.deepEqual(empty.calls, []);
    assert.deepEqual(empty.errors, []);
    assert.deepEqual(empty.unexpected, []);
    assert.deepEqual(empty.blockedExternal, []);
  } finally { await empty.close(); }

  const corrupt = await mockContext(browser, origin, paths);
  try {
    const { page, context } = corrupt;
    // Seed a malformed local-only record before the app's very first load.
    await context.route(origin + '/__qa_draft_seed__', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated draft seed</title>' }));
    await page.goto(origin + '/__qa_draft_seed__');
    const broken = { version: 1, savedAt: 1, draft: { syntheticCorruptRecord: true } };
    await page.evaluate(record => new Promise((resolve, reject) => {
      const opened = indexedDB.open('tracer-pet-generation', 1);
      opened.onupgradeneeded = () => opened.result.createObjectStore('drafts');
      opened.onerror = () => reject(opened.error);
      opened.onsuccess = () => {
        const db = opened.result, transaction = db.transaction('drafts', 'readwrite');
        transaction.objectStore('drafts').put(record, 'draft');
        transaction.oncomplete = () => { db.close(); resolve(); };
        transaction.onabort = () => { db.close(); reject(transaction.error); };
      };
    }), broken);
    await ready(page, origin);
    await page.waitForFunction(selector => document.querySelector(selector)?.dataset.state === 'error', entry);
    await page.locator(entry).waitFor({ state: 'visible' });
    assert.deepEqual(await rawDraft(page), broken, 'initial corruption detection never silently clears the record');
    assert.equal(await page.evaluate(async () => { try { await TracerPetGenerationDraft.create().load(); return ''; } catch (error) { return error.code; } }), 'pet-draft-corrupt');
    await dismissRestart(page, entry, corrupt);
    assert.deepEqual(await rawDraft(page), broken, 'cancelling corruption recovery preserves the exact damaged record');
    assert.equal(await page.locator(entry).isVisible(), true);
    assert.equal(await page.locator('.pet-create-form').isVisible(), false);
    await page.screenshot({ path: path.join(profile, 'corrupt-draft-cancel-keeps-record.png'), animations: 'disabled' });
    const confirmed = page.waitForEvent('dialog').then(async dialog => {
      assert.equal(dialog.type(), 'confirm');
      assert.match(dialog.message(), /draft is damaged.*discard|草稿已损坏.*放弃/i);
      await dialog.accept();
    });
    await Promise.all([confirmed, page.click(entry, { noWaitAfter: true })]);
    await page.locator('.pet-create-form').waitFor({ state: 'visible' });
    await draftAt(page, null);
    assert.equal(await rawDraft(page), null, 'only confirmation clears the corrupted record');
    assert.equal(await page.inputValue('#pet-custom-name'), '');
    await page.fill('#pet-custom-name', 'Fresh after recovery');
    assert.equal((await draftAt(page, 0)).name, 'Fresh after recovery', 'a valid new draft can be created after confirmed recovery');
    await page.fill('#pet-custom-name', '');
    await draftAt(page, null);
    await closeCreator(page);
    await page.reload();
    await page.waitForFunction(() => window.Tracer?.pet && Tracer.store.data);
    await draftAt(page, null);
    assert.equal(await page.locator(entry).isVisible(), false);
    assert.deepEqual(corrupt.calls, []);
    assert.deepEqual(corrupt.errors, []);
    assert.deepEqual(corrupt.unexpected, []);
    assert.deepEqual(corrupt.blockedExternal, []);
    console.log('PASS delayed save/discard cannot revive drafts or replace another editor, empty drafts stay deleted after reload and corrupted drafts require confirmation before clearing');
  } finally { await corrupt.close(); }
}

async function editSavedActions(page,mock,saved,replacementImage,profile) {
  const startCalls=mock.calls.length;
  await page.evaluate(()=>Tracer.pet.action('pet'));
  const bond=await page.evaluate(()=>TracerPetModel.current(Tracer.pet.read()).bond);
  await page.click('#pet-open');await page.click('[data-tab="collection"]');
  await page.click('[data-act="open-edit-actions"]');
  await page.locator('.pet-create-form').waitFor({state:'visible'});
  const editing=await draftAt(page,16);
  assert.equal(editing.editingId,saved.id);
  assert.equal(editing.recordId,saved.id);
  assert.match(editing.editingSignature,/^[a-f0-9]{64}$/);
  assert.deepEqual(editing.pages,saved.animation.pages);
  assert.notEqual(editing.pages[8],replacementImage,'saved editing has a distinct replacement fixture');
  assert.equal(mock.calls.length,startCalls,'opening saved actions never requests AI');
  for(const selector of ['#pet-photo','#pet-custom-kind','#pet-distinctive-features'])assert.equal(await page.locator(selector).isDisabled(),true);
  assert.equal(await page.locator('.pet-restart-generation').isVisible(),false,'saved action editing cannot accidentally regenerate the whole companion');
  mock.respond(8,replacementImage);
  await page.selectOption('#pet-preview-action','fishing');await acceptActionReplacement(page);
  await until(async()=>{const draft=await page.evaluate(()=>TracerPetGenerationDraft.create().load());return draft?.pendingReplacement===null&&draft?.pages?.[8]===replacementImage;},'saved action replacement is durable');
  assert.equal(mock.calls.length,startCalls+1);
  assert.equal(mock.calls.at(-1).animationPage,8);
  assert.deepEqual(await page.evaluate(id=>Tracer.pet.read().customs.find(pet=>pet.id===id),saved.id),saved,'generating a replacement leaves the saved collection record unchanged until Save');
  const changed=saved.animation.pages.slice();changed[8]=replacementImage;
  assert.deepEqual((await draftAt(page,16)).pages,changed);

  await page.evaluate(({id,replacement})=>{
    window.__savedEditSetItem=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      if(key==='tracer.pet.v1'&&JSON.parse(value).customs?.some(pet=>pet.id===id&&pet.animation?.pages?.[8]===replacement))throw new DOMException('Synthetic saved edit failure','QuotaExceededError');
      return window.__savedEditSetItem.call(this,key,value);
    };
  },{id:saved.id,replacement:replacementImage});
  await page.click('.pet-adopt');
  await page.waitForFunction(()=>!document.querySelector('.pet-adopt').disabled&&/save|保存/i.test(document.querySelector('.pet-create-error').textContent));
  assert.deepEqual(await page.evaluate(id=>Tracer.pet.read().customs.find(pet=>pet.id===id),saved.id),saved,'a failed update preserves the original saved profile');
  assert.deepEqual((await draftAt(page,16)).pages,changed);
  await page.evaluate(()=>{Storage.prototype.setItem=window.__savedEditSetItem;delete window.__savedEditSetItem;});
  await page.reload();await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);
  await page.evaluate(()=>Tracer.pet.action('open-create'));await page.locator('.pet-create-form').waitFor({state:'visible'});
  const restored=await draftAt(page,16);
  assert.equal(restored.editingId,saved.id,'an edit draft is not mistaken for an already adopted new companion');
  assert.equal(restored.editingSignature,editing.editingSignature);
  assert.deepEqual(restored.pages,changed);
  assert.deepEqual(await page.evaluate(id=>Tracer.pet.read().customs.find(pet=>pet.id===id),saved.id),saved);
  assert.equal(mock.calls.length,startCalls+1,'restoring a saved-companion edit does not repeat generation');
  await page.selectOption('#pet-preview-action','fishing');
  await page.locator('.pet-create-preview').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(profile,'saved-companion-action-edit-restored.png'),animations:'disabled'});
  await page.click('.pet-adopt');await page.locator(entry).waitFor({state:'hidden'});await draftAt(page,null);
  const updated=await page.evaluate(()=>Tracer.pet.read().customs);
  assert.equal(updated.length,1,'saving an edited companion never creates a duplicate');
  assert.equal(updated[0].id,saved.id);
  assert.deepEqual(updated[0].animation.pages,changed);
  assert.equal(await page.evaluate(()=>TracerPetModel.current(Tracer.pet.read()).bond),bond,'action updates preserve the original care progress');
  await page.reload();await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);
  assert.deepEqual(await page.evaluate(()=>Tracer.pet.read().customs),updated);

  await page.click('#pet-open');await page.click('[data-tab="collection"]');await page.click('[data-act="open-edit-actions"]');
  await page.locator('.pet-create-form').waitFor({state:'visible'});await draftAt(page,16);
  // Model a second window changing the profile while this editor is open.
  // Storage events are the application's normal cross-window update channel.
  await page.evaluate(id=>{
    const key='tracer.pet.v1',oldValue=localStorage.getItem(key),state=JSON.parse(oldValue);
    state.customs.find(pet=>pet.id===id).personality='Changed in another isolated window';
    const newValue=JSON.stringify(state);localStorage.setItem(key,newValue);
    window.dispatchEvent(new StorageEvent('storage',{key,oldValue,newValue,storageArea:localStorage}));
  },saved.id);
  await page.click('.pet-adopt');
  await page.waitForFunction(()=>!document.querySelector('.pet-adopt').disabled&&/changed|conflict|变化|修改|冲突/i.test(document.querySelector('.pet-create-error').textContent));
  assert.equal(await page.evaluate(id=>Tracer.pet.read().customs.find(pet=>pet.id===id).personality,saved.id),'Changed in another isolated window','a stale editor never overwrites another window’s saved changes');
  assert.equal((await draftAt(page,16)).editingId,saved.id);

  await closeCreator(page);await page.click('#pet-open');await page.click('[data-tab="collection"]');
  await page.click('[data-act="open-remove"]');await page.locator('.modal-actions .btn-danger').click();
  await page.waitForFunction(()=>Tracer.pet.read().customs.length===0);
  await page.keyboard.press('Escape');await page.click(entry);await page.locator('.pet-create-form').waitFor({state:'visible'});
  await page.click('.pet-adopt');
  await page.waitForFunction(()=>!document.querySelector('.pet-adopt').disabled&&/removed|missing|no longer|不存在|删除|移除/i.test(document.querySelector('.pet-create-error').textContent));
  assert.equal(await page.evaluate(()=>Tracer.pet.read().customs.length),0,'saving an edit never recreates a deleted companion');
  assert.equal((await draftAt(page,16)).editingId,saved.id,'the failed edit remains recoverable for review');
  await acceptDiscard(page);await draftAt(page,null);await page.locator(entry).waitFor({state:'hidden'});
  assert.equal(mock.calls.length,startCalls+1,'saved editor success, failures and conflicts consume only its one selected action');
  console.log('PASS saved companion action editing, deferred same-ID update, failed-save reload, care preservation and explicit conflict/deleted-original protection');
}

async function actionReplacementRecovery(browser,origin,paths,portrait,replacementImage,savedReplacementImage,profile) {
  const mock=await mockContext(browser,origin,paths),{page}=mock;
  try {
    await ready(page,origin);
    const name='Maple Single Action',photo=await openNew(page,portrait,name);
    await page.click('.pet-generate');
    await assertComplete(page,mock,name,photo,paths);
    const original=await draftAt(page,16);
    assert.deepEqual(mock.calls.map(call=>call.animationPage),sequence());
    await page.selectOption('#pet-preview-action','fishing');
    await dismissRestart(page,'.pet-regenerate-action',mock);
    assert.deepEqual((await draftAt(page,16)).pages,paths);
    assert.equal(mock.calls.length,16);

    mock.fail(8);mock.respond(8,replacementImage);
    await acceptActionReplacement(page);
    await page.waitForFunction(()=>!document.querySelector('.pet-generate').disabled&&document.querySelector('.pet-create-error').textContent.includes('returned no image'));
    await until(async()=>{const draft=await page.evaluate(()=>TracerPetGenerationDraft.create().load());return draft?.pendingReplacement?.pageIndex===8;},'failed replacement checkpoint is durable');
    const failed=await draftAt(page,16);
    assert.deepEqual(failed.pages,paths,'a failed single action leaves all saved draft images intact');
    assert.deepEqual(failed.pendingReplacement,{pageIndex:8,attempt:1,identityImage:paths[0]});
    assert.equal(failed.generationId,original.generationId);
    assert.equal(failed.generationIdentity,paths[0]);
    assert.deepEqual(mock.calls.slice(16).map(call=>[call.animationPage,call.generationAttempt]),[[8,1]]);
    await page.reload();
    await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);
    await page.evaluate(()=>Tracer.pet.action('open-create'));
    await page.locator('.pet-create-form').waitFor({state:'visible'});
    const restored=await draftAt(page,16);
    assert.deepEqual(restored.pendingReplacement,failed.pendingReplacement,'reload retains the exact selected action retry');
    assert.deepEqual(restored.pages,paths);
    assert.equal(mock.calls.length,17,'restoring pending replacement does not request AI automatically');
    await page.selectOption('#pet-preview-action','fishing');
    mock.hold(8);
    // Retrying the pending action needs no second confirmation and must reuse
    // the same attempt, allowing the backend to recover an already paid result.
    await page.click('.pet-regenerate-action');
    await until(()=>mock.waiting(8),'restored action replacement request');
    assert.equal(await page.locator('.pet-adopt').isDisabled(),true);
    assert.deepEqual((await draftAt(page,16)).pages,paths);
    assert.equal(await page.locator('.pet-result-frame .pet-animation-sheet').getAttribute('src'),paths[8],'old fishing frames remain visible during replacement');
    assert.equal(mock.calls.length,18);
    assert.equal(mock.calls.at(-1).generationAttempt,1);
    assert.equal(mock.calls.at(-1).generationId,original.generationId);
    assert.equal(mock.calls.at(-1).identityImage,paths[0]);
    await closeCreator(page,'backdrop');mock.release(8);
    await page.locator('.pet-adopt').waitFor({state:'visible'});
    const replaced=paths.slice();replaced[8]=replacementImage;
    await until(async()=>{const draft=await page.evaluate(()=>TracerPetGenerationDraft.create().load());return draft?.pendingReplacement===null&&draft?.pages?.[8]===replacementImage;},'replacement result is durable');
    await assertComplete(page,mock,name,photo,replaced);
    const finalDraft=await draftAt(page,16);
    assert.deepEqual(finalDraft.pageAttempts,Array.from({length:16},(_,index)=>index===8?1:0));
    assert.equal(finalDraft.recordId,original.recordId);
    assert.equal(finalDraft.generationIdentity,paths[0]);
    assert.deepEqual(mock.calls.slice(16).map(call=>[call.animationPage,call.generationAttempt]),[[8,1],[8,1]],'no other action is regenerated');
    await page.selectOption('#pet-preview-action','fishing');
    assert.equal(await page.locator('.pet-result-frame .pet-animation-sheet').getAttribute('src'),replacementImage);
    await page.locator('.pet-create-preview').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(profile,'single-action-replaced.png'),animations:'disabled'});
    await page.click('.pet-adopt');await page.locator(entry).waitFor({state:'hidden'});await draftAt(page,null);
    const saved=await page.evaluate(()=>Tracer.pet.read().customs[0]);
    assert.equal(saved.id,original.recordId);assert.deepEqual(saved.animation.pages,replaced);
    await page.reload();await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);
    assert.deepEqual(await page.evaluate(()=>Tracer.pet.read().customs[0].animation.pages),replaced);
    await editSavedActions(page,mock,saved,savedReplacementImage,profile);
    assert.deepEqual(mock.errors,[]);assert.deepEqual(mock.unexpected,[]);assert.deepEqual(mock.blockedExternal,[]);
    console.log('PASS isolated single-action replacement, old-page retention, exact pending retry after reload, background completion and saving only the chosen page');
  } finally {await mock.close();}
}

async function savedDraftCleanupRecovery(browser,origin,paths,portrait,replacementImage,savedReplacementImage,profile) {
  const mock=await mockContext(browser,origin,paths),{page}=mock;
  try {
    await ready(page,origin);
    const seed={name:'Saved cleanup recovery',kind:'humanoid',personality:'A synthetic recovery fixture.',distinctiveFeatures:'Green shirt',imageSource:'codex',imageModel:'gpt-image-2.5-flare',photo:'data:image/png;base64,'+portrait.toString('base64'),pages:paths,pageAttempts:Array(16).fill(0),animationVersion:2,recordId:'custom_'+'e'.repeat(32),generationId:'e'.repeat(32),wasBusy:false,generationIdentity:paths[0],pendingReplacement:null,editingId:'',editingSignature:'',retainedFrames:Array(16).fill(16)};
    await page.evaluate(draft=>TracerPetGenerationDraft.create().save(draft),seed);
    await page.reload();await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);
    await page.locator('.pet-create-form').waitFor({state:'visible'});await draftAt(page,16);
    await page.evaluate(()=>{
      window.__cleanupOriginalDelete=IDBObjectStore.prototype.delete;
      IDBObjectStore.prototype.delete=function(...args){
        if(this.name==='drafts'&&this.transaction.db.name==='tracer-pet-generation')throw new DOMException('Synthetic draft cleanup failure','QuotaExceededError');
        return window.__cleanupOriginalDelete.apply(this,args);
      };
    });
    await page.click('.pet-adopt');
    await page.waitForFunction(()=>!document.querySelector('.pet-adopt').disabled&&/companion is saved.*draft could not be removed/.test(document.querySelector('.pet-create-error').textContent));
    const firstSaved=await page.evaluate(()=>Tracer.pet.read().customs);
    assert.equal(firstSaved.length,1);assert.equal(firstSaved[0].id,seed.recordId);assert.deepEqual(firstSaved[0].animation.pages,paths);
    await until(async()=>{const draft=await page.evaluate(()=>TracerPetGenerationDraft.create().load());return draft?.editingId===seed.recordId;},'cleanup failure persists the newly saved editing identity');
    const firstDraft=await draftAt(page,16);
    const firstSignature=await page.evaluate(record=>TracerPetEditDraft.signature(record),firstSaved[0]);
    assert.equal(firstDraft.editingSignature,firstSignature,'the retained draft now refers to the profile that really reached collection storage');
    assert.equal(await page.locator('.pet-restart-generation').isVisible(),false);
    assert.equal(mock.calls.length,0,'recovering failed cleanup makes no AI requests');

    // The creator remains open after a partial save. New edits must update that
    // saved record, rather than take the duplicate-adoption shortcut.
    mock.respond(8,replacementImage);
    await page.selectOption('#pet-preview-action','fishing');await acceptActionReplacement(page);
    await until(async()=>{const draft=await page.evaluate(()=>TracerPetGenerationDraft.create().load());return draft?.pages?.[8]===replacementImage&&!draft.pendingReplacement;},'live post-save action change is durable');
    assert.deepEqual(await page.evaluate(()=>Tracer.pet.read().customs),firstSaved,'redrawing after failed cleanup still waits for Save');
    await page.click('.pet-adopt');
    await page.waitForFunction(()=>!document.querySelector('.pet-adopt').disabled&&/companion is saved.*draft could not be removed/.test(document.querySelector('.pet-create-error').textContent));
    const liveSaved=await page.evaluate(()=>Tracer.pet.read().customs),livePages=paths.slice();livePages[8]=replacementImage;
    assert.equal(liveSaved.length,1);assert.equal(liveSaved[0].id,seed.recordId);assert.deepEqual(liveSaved[0].animation.pages,livePages,'saving a new action after failed cleanup actually replaces that action');
    const liveSignature=await page.evaluate(record=>TracerPetEditDraft.signature(record),liveSaved[0]);
    await until(async()=>{const draft=await page.evaluate(()=>TracerPetGenerationDraft.create().load());return draft?.editingSignature===liveSignature;},'second partial save checkpoints its current signature');
    assert.notEqual(liveSignature,firstSignature);
    await page.evaluate(()=>{IDBObjectStore.prototype.delete=window.__cleanupOriginalDelete;delete window.__cleanupOriginalDelete;});
    await page.reload();await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);
    await page.locator('.pet-create-form').waitFor({state:'visible'});
    const restored=await draftAt(page,16);
    assert.equal(restored.editingId,seed.recordId);assert.equal(restored.editingSignature,liveSignature);assert.deepEqual(restored.pages,livePages,'reload retains the editing draft even when its current candidate is already saved');
    assert.equal(mock.calls.length,1);
    mock.respond(8,savedReplacementImage);
    await page.selectOption('#pet-preview-action','fishing');await acceptActionReplacement(page);
    await until(async()=>{const draft=await page.evaluate(()=>TracerPetGenerationDraft.create().load());return draft?.pages?.[8]===savedReplacementImage&&!draft.pendingReplacement;},'restored post-save action change is durable');
    await page.screenshot({path:path.join(profile,'saved-draft-cleanup-recovered.png'),animations:'disabled'});
    await page.click('.pet-adopt');await page.locator(entry).waitFor({state:'hidden'});await draftAt(page,null);
    const finalSaved=await page.evaluate(()=>Tracer.pet.read().customs),finalPages=paths.slice();finalPages[8]=savedReplacementImage;
    assert.equal(finalSaved.length,1);assert.equal(finalSaved[0].id,seed.recordId);assert.deepEqual(finalSaved[0].animation.pages,finalPages);
    assert.deepEqual(mock.calls.map(call=>[call.animationPage,call.generationAttempt]),[[8,1],[8,2]]);

    // A stale pre-editing draft with the same ID is safe to clear only if its
    // complete candidate matches the collection record. Different artwork must
    // remain reviewable, and must never silently overwrite the saved profile.
    await page.evaluate(draft=>TracerPetGenerationDraft.create().save(draft),{...seed,pages:livePages});
    await page.reload();await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);
    await page.locator('.pet-create-form').waitFor({state:'visible'});
    const conflicted=await draftAt(page,16);assert.equal(conflicted.editingId,'');assert.deepEqual(conflicted.pages,livePages);
    await page.click('.pet-adopt');
    await page.waitForFunction(()=>!document.querySelector('.pet-adopt').disabled&&/changed|conflict/i.test(document.querySelector('.pet-create-error').textContent));
    assert.deepEqual(await page.evaluate(()=>Tracer.pet.read().customs),finalSaved,'a same-ID draft with different artwork cannot overwrite saved actions');
    assert.deepEqual((await draftAt(page,16)).pages,livePages);
    await acceptDiscard(page);await draftAt(page,null);await page.locator(entry).waitFor({state:'hidden'});
    await page.evaluate(draft=>TracerPetGenerationDraft.create().save(draft),{...seed,pages:finalPages});
    await page.reload();await page.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);
    await draftAt(page,null);assert.equal(await page.locator(entry).isVisible(),false,'an exactly matching non-editing draft is safely cleared after reload');
    assert.deepEqual(await page.evaluate(()=>Tracer.pet.read().customs),finalSaved);
    assert.equal(mock.calls.length,2);assert.deepEqual(mock.errors,[]);assert.deepEqual(mock.unexpected,[]);assert.deepEqual(mock.blockedExternal,[]);
    console.log('PASS collection save with failed draft cleanup, live and restored same-ID action updates, exact candidate cleanup and conflicting same-ID draft preservation');
  } finally {await mock.close();}
}

async function legacyReplacementRoundTrips(browser,origin,paths,staticImage,legacyPages,replacementImage,profile) {
  for(const kind of ['static','legacy']) {
    const sender=await mockContext(browser,origin,paths),{page}=sender;
    let recipient;
    try {
      await ready(page,origin);
      const retained=kind==='static'?1:4;
      const original={id:'custom_'+(kind==='static'?'c':'d').repeat(32),name:'Retained '+kind,kind:'humanoid',personality:'A locally drawn compatibility fixture.',image:kind==='static'?staticImage:legacyPages[0],...(kind==='legacy'?{animation:{version:1,pages:legacyPages}}:{})};
      await page.evaluate(record=>{
        const state=Tracer.pet.read();TracerPetModel.addCustom(state,record);state.pets[record.id].bond=41;
        const value=JSON.stringify(state);localStorage.setItem('tracer.pet.v1',value);dispatchEvent(new StorageEvent('storage',{key:'tracer.pet.v1',newValue:value}));Tracer.pet.refresh(true);
      },original);
      await page.click('#pet-open');await page.click('[data-tab="collection"]');await page.click('[data-act="open-edit-actions"]');
      await page.locator('.pet-create-form').waitFor({state:'visible'});
      const prepared=await draftAt(page,16);
      assert.equal(prepared.editingId,original.id);
      assert.deepEqual(prepared.retainedFrames,Array(16).fill(retained),kind+' preparation retains the old number of actual poses');
      assert.equal(sender.calls.length,0,'compatibility preparation uses local artwork without AI');
      assert.deepEqual(await page.evaluate(()=>Tracer.pet.read().customs[0]),original,'preparing compatibility artwork does not replace the saved profile');
      sender.respond(8,replacementImage);
      await page.selectOption('#pet-preview-action','fishing');await acceptActionReplacement(page);
      await until(async()=>{const draft=await page.evaluate(()=>TracerPetGenerationDraft.create().load());return draft?.pendingReplacement===null&&draft?.pages?.[8]===replacementImage;},kind+' replacement becomes durable');
      const changed=prepared.pages.slice();changed[8]=replacementImage;
      const expectedFrames=Array.from({length:16},(_,index)=>index===8?16:retained);
      const draft=await draftAt(page,16);
      assert.deepEqual(draft.pages,changed,kind+' replacement preserves all fifteen converted pages');
      assert.deepEqual(draft.retainedFrames,expectedFrames);
      assert.deepEqual(sender.calls.map(call=>call.animationPage),[8]);
      assert.equal(sender.calls[0].identityImage,prepared.generationIdentity);
      await page.click('.pet-adopt');await page.locator(entry).waitFor({state:'hidden'});await draftAt(page,null);
      const saved=await page.evaluate(()=>Tracer.pet.read().customs[0]);
      assert.equal(saved.id,original.id);assert.equal(saved.animation.version,2);
      assert.deepEqual(saved.animation.pages,changed);assert.deepEqual(saved.animation.retainedFrames,expectedFrames);
      assert.equal(await page.evaluate(()=>TracerPetModel.current(Tracer.pet.read()).bond),41);
      await page.evaluate(()=>Tracer.pet.open());await page.click('[data-tab="collection"]');await page.click('[data-act="open-export"]');
      const downloading=page.waitForEvent('download');await page.click('.pet-transfer-submit');
      const download=await downloading,file=path.join(profile,kind+'-one-action.tracer-pet');await download.saveAs(file);
      const pack=JSON.parse(fs.readFileSync(file,'utf8'));
      assert.equal(pack.version,2);assert.equal(pack.artwork.images.length,16);assert.deepEqual(pack.artwork.retainedFrames,expectedFrames);
      recipient=await mockContext(browser,origin,paths);const receiver=recipient.page;
      await ready(receiver,origin);await receiver.click('#pet-open');await receiver.click('[data-tab="collection"]');await receiver.click('[data-act="open-import"]');
      await receiver.locator('#pet-package-file').setInputFiles(file);
      await receiver.locator('.pet-transfer-submit:not([disabled])').waitFor();await receiver.click('.pet-transfer-submit');
      await receiver.locator('.pet-character .pet-animated-sprite').waitFor();
      const imported=await receiver.evaluate(()=>Tracer.pet.read().customs[0]);
      assert.equal(imported.animation.version,2);assert.equal(imported.animation.pages.length,16);assert.deepEqual(imported.animation.retainedFrames,expectedFrames);
      await receiver.evaluate(record=>{
        const host=document.createElement('div');host.id='compatibility-action-preview';document.body.appendChild(host);
        window.__compatibilityPlayer=TracerPetAnimation.create(record);host.appendChild(window.__compatibilityPlayer.element);window.__compatibilityPlayer.setAction('fishing');
      },imported);
      await receiver.waitForFunction(()=>document.querySelector('#compatibility-action-preview .pet-animated-sprite')?.dataset.playback==='playing');
      const frame=await receiver.locator('#compatibility-action-preview .pet-animated-sprite').getAttribute('data-frame');
      await receiver.waitForFunction(frame=>document.querySelector('#compatibility-action-preview .pet-animated-sprite').dataset.frame!==frame,frame);
      await receiver.evaluate(()=>window.__compatibilityPlayer.setAction('reading'));
      await receiver.waitForFunction(expected=>document.querySelector('#compatibility-action-preview .pet-animated-sprite')?.dataset.playback===expected,retained===1?'static':'playing');
      await receiver.evaluate(()=>window.__compatibilityPlayer.destroy());
      await receiver.reload();await receiver.waitForFunction(()=>window.Tracer?.pet&&Tracer.store.data);
      assert.deepEqual(await receiver.evaluate(()=>Tracer.pet.read().customs[0].animation.retainedFrames),expectedFrames);
      assert.deepEqual(sender.calls.map(call=>call.animationPage),[8]);assert.deepEqual(recipient.calls,[]);
      for(const mock of [sender,recipient]){assert.deepEqual(mock.errors,[]);assert.deepEqual(mock.unexpected,[]);assert.deepEqual(mock.blockedExternal,[]);}
      console.log('PASS '+kind+' saved artwork: local conversion, one-action update, same-ID care preservation and real mixed-frame export/import');
    } finally {await recipient?.close();await sender.close();}
  }
}

async function main() {
  fs.mkdirSync(path.join(root, '.cache'), { recursive: true });
  const profile = fs.mkdtempSync(path.join(root, '.cache/pet-generation-recovery-'));
  console.log('Artifacts: ' + profile);
  const data = path.join(profile, 'data');
  Object.assign(process.env, {
    DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer',
    DOCS_PORTAL_DATA_DIR: data, DOCS_PORTAL_STATE_FILE: path.join(profile, 'bookmarks.json')
  });
  const { server } = require('../server');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.TRACER_QA_BROWSER || 'msedge', headless: true });
    const page = await browser.newPage(), art = await fixtures(page), legacy=await legacyFixtures(page), paths = [],legacyPages=[];
    const replacementBytes=Buffer.from(await page.evaluate(async base64=>{
      const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const context=canvas.getContext('2d');context.drawImage(image,0,0);
      const pixels=context.getImageData(0,0,canvas.width,canvas.height);
      for(let index=0;index<pixels.data.length;index+=4)if(pixels.data[index]===107&&pixels.data[index+1]===160&&pixels.data[index+2]===141){pixels.data[index]=95;pixels.data[index+1]=132;pixels.data[index+2]=200;}
      context.putImageData(pixels,0,0);return canvas.toDataURL('image/png').split(',')[1];
    },art.sheets[8].toString('base64')),'base64');
    assert.equal(replacementBytes.equals(art.sheets[8]),false,'replacement fixture contains genuinely different pixels');
    await page.close();
    for (const sheet of art.sheets) paths.push(await Images.storeGenerated(data, sheet));
    const replacementImage=await Images.storeGenerated(data,replacementBytes);
    const savedReplacementImage=await Images.storeGenerated(data,art.sheets[8]);
    const staticImage=await Images.storeGenerated(data,art.portrait);
    for(const sheet of legacy.sheets.slice(0,3))legacyPages.push(await Images.storeGenerated(data,sheet));
    const origin = 'http://127.0.0.1:' + server.address().port;
    if(!process.argv.includes('--single-action')) {
      await backgroundAndComplete(browser, origin, paths, art.portrait, profile);
      await partialResume(browser, origin, paths, art.portrait, profile);
      await checkpointAndDiscard(browser, origin, paths, art.portrait, profile);
      await emptyAndCorruptDrafts(browser, origin, paths, profile);
    }
    await actionReplacementRecovery(browser,origin,paths,art.portrait,replacementImage,savedReplacementImage,profile);
    await savedDraftCleanupRecovery(browser,origin,paths,art.portrait,replacementImage,savedReplacementImage,profile);
    await legacyReplacementRoundTrips(browser,origin,paths,staticImage,legacyPages,replacementImage,profile);
    console.log('Artifacts: ' + profile);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
