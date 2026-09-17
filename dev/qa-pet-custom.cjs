'use strict';
// Browser QA with an isolated profile and mock image/chat services only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const { fixtures } = require('./qa-pet-dense-animation.cjs');
const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(root, '.cache/pet-custom-'));
Object.assign(process.env, {
  DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer',
  DOCS_PORTAL_DATA_DIR: path.join(profile, 'data'),
  DOCS_PORTAL_STATE_FILE: path.join(profile, 'bookmarks.json')
});
const { server } = require('../server');

async function inspectForm(page, caption) {
  const issues = await page.locator('.pet-create-form').evaluate(form => {
    const issues = [], modal = form.closest('.modal'), bounds = modal.getBoundingClientRect();
    if (modal.scrollWidth > modal.clientWidth + 1) issues.push('dialog overflows horizontally');
    if (bounds.left < -1 || bounds.right > innerWidth + 1) issues.push('dialog outside viewport');
    for (const label of form.querySelectorAll('label')) {
      const input = label.control;
      if (!input || !input.checkVisibility() || ['checkbox','radio'].includes(input.type)) continue;
      const range = document.createRange();
      if (label.contains(input)) { range.setStart(label, 0); range.setEndBefore(input); }
      else range.selectNodeContents(label);
      const text = range.getBoundingClientRect(), control = input.getBoundingClientRect();
      const sharesColumn = Math.min(text.right,control.right) - Math.max(text.left,control.left) > 1;
      if (sharesColumn && control.top - text.bottom < 4) issues.push(input.id + ': label/control gap ' + (control.top - text.bottom));
    }
    for (const el of form.querySelectorAll('input,select,textarea,button,img,.pet-animated-sprite')) {
      if (!el.checkVisibility()) continue;
      if (el.classList.contains('pet-animation-sheet')) continue; // Its 4x atlas is intentionally cropped by the checked sprite wrapper.
      const rect = el.getBoundingClientRect();
      if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1) issues.push((el.id || el.className) + ': outside dialog');
    }
    return issues;
  });
  assert.deepEqual(issues, [], caption);
}

async function openCreator(page, source = 'personal') {
  await page.click('[data-tab="collection"]');
  await page.click('[data-act="open-create"]');
  await page.locator('.pet-create-form').waitFor();
  if (source) await page.selectOption('#pet-image-source', source);
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], calls = [], chats = [], codexCalls = [];
    let failNext = false, codexError = '', png, generatedSheets, holdNextChat = false, heldChat, onChatHeld;
    const generatedAssets = new Map();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/ai/personal-status', route => route.fulfill({ json: {
      configured: true, tested: true, hasKey: true, protocol: 'responses', model: 'mock-chat', url: 'https://mock.invalid/v1'
    } }));
    await page.route('**/api/ai/codex-status', route => route.fulfill({ json: { configured: true, account: { type: 'chatgpt', planType: 'pro' }, imageGeneration: true } }));
    await page.route('**/api/ai/personal-pet-image', route => {
      calls.push(route.request().postDataJSON());
      if (failNext) { failNext = false; return route.fulfill({ status: 400, json: { error: 'provider-unavailable' } }); }
      const image = '/api/pet-art/' + String(calls.length).padStart(32, '0') + '.png', animationPage = calls.at(-1).animationPage;
      generatedAssets.set(image, generatedSheets[animationPage]);
      return route.fulfill({ json: { image, animationPage, animationVersion:2, model: 'mock-animation-model' } });
    });
    await page.route('**/api/ai/codex-pet-image', route => {
      codexCalls.push(route.request().postDataJSON());
      if (codexError) return route.fulfill({ status: 400, json: { error: codexError } });
      const image = '/api/pet-art/' + codexCalls.length.toString(16).padStart(32, 'c') + '.png', animationPage = codexCalls.at(-1).animationPage;
      generatedAssets.set(image, generatedSheets[animationPage]);
      return route.fulfill({ json: { image, animationPage, animationVersion:2, model: 'mock-animation-model' } });
    });
    await page.route('**/api/pet-art/*.png', route => route.fulfill({ contentType: 'image/png', body: generatedAssets.get(new URL(route.request().url()).pathname) || png }));
    for (const provider of ['personal','codex']) await page.route('**/api/ai/' + provider + '-chat', route => {
      chats.push(route.request().postDataJSON());
      if (holdNextChat) { holdNextChat = false; heldChat = route; onChatHeld(); return; }
      return route.fulfill({ json: { reply: 'Let’s take one curious little step together.' } });
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => window.Tracer?.pet && Tracer.store.data);
    generatedSheets = (await fixtures(page)).sheets;
    // A synthetic upload fixture, generated locally so no personal photo is used.
    png = Buffer.from(await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#b7dac1'; ctx.fillRect(20, 20, 88, 88);
      ctx.fillStyle = '#213a33'; ctx.fillRect(40, 48, 12, 12); ctx.fillRect(76, 48, 12, 12);
      ctx.fillRect(52, 80, 24, 8);
      return canvas.toDataURL('image/png').split(',')[1];
    }), 'base64');
    const photo = { name: 'companion-photo.png', mimeType: 'image/png', buffer: png };
    await page.click('#pet-open');
    await openCreator(page);
    assert.equal(await page.locator('.pet-generation-details').evaluate(el => el.open), false, 'long usage/privacy details start collapsed');
    assert.equal(await page.locator('.pet-generation-privacy').isVisible(), false);
    assert.equal(await page.locator('.pet-generation-summary').isVisible(), true);
    assert.match(await page.locator('.pet-generation-summary').innerText(), /configured image provider.*API charges/, 'destination and API charges remain in the main flow');
    await page.locator('.pet-generation-details > summary').click();
    assert.equal(await page.locator('.pet-generation-privacy').isVisible(), true, 'full privacy details remain available on demand');
    await page.locator('.pet-generation-details > summary').click();
    await page.locator('#pet-photo').setInputFiles(photo);
    await page.fill('#pet-custom-name', 'Robin');
    await page.selectOption('#pet-custom-kind', 'humanoid');
    await page.fill('#pet-custom-personality', 'Curious, thoughtful, and fond of quiet puzzles.');
    const distinctiveFeatures = 'Keep the round glasses and the curl above the forehead.';
    await page.fill('#pet-distinctive-features', distinctiveFeatures);
    await page.locator('.pet-photo-preview').waitFor({ state: 'visible' });
    assert.equal(calls.length, 0, 'uploading and entering preferences must not send a photo');
    const uploadedPreview = await page.locator('.pet-photo-preview').getAttribute('src');
    const originalImageModel = await page.inputValue('#pet-image-model');
    await page.click('.pet-create-form [data-act="open-ai"]');
    await page.locator('.ai-dialog').waitFor();
    await page.locator('#ai-url').waitFor();
    assert.equal(await page.locator('.ai-dialog [data-ai-step="3"]').getAttribute('aria-current'), 'step', 'creator setup opens My AI directly');
    assert.ok((await page.locator('#ai-mode-api').getAttribute('class')).includes('btn-primary'), 'personal generation opens the API connection settings');
    assert.equal(await page.evaluate(() => localStorage.getItem('tracer.ai.mode')), 'api');
    await page.click('#ai-close');
    await page.click('#pet-generation-status');
    await page.locator('.pet-create-form').waitFor();
    assert.equal(await page.inputValue('#pet-custom-name'), 'Robin');
    assert.equal(await page.inputValue('#pet-custom-kind'), 'humanoid');
    assert.equal(await page.inputValue('#pet-image-source'), 'personal');
    assert.equal(await page.inputValue('#pet-custom-personality'), 'Curious, thoughtful, and fond of quiet puzzles.');
    assert.equal(await page.inputValue('#pet-distinctive-features'), distinctiveFeatures);
    assert.equal(await page.inputValue('#pet-image-model'), originalImageModel);
    assert.equal(await page.locator('.pet-photo-preview').getAttribute('src'), uploadedPreview, 'opening AI settings preserves the recoverable source photo draft');
    assert.equal(await page.locator('.pet-photo-preview').isVisible(), true);
    assert.equal(calls.length, 0, 'opening settings and restoring a draft must not generate automatically');
    assert.equal(await page.evaluate(photo => Object.keys(localStorage).some(key => (localStorage.getItem(key) || '').includes(photo)), uploadedPreview), false, 'the recovery photo uses IndexedDB rather than synchronous localStorage');
    assert.match(await page.locator('.pet-generation-privacy').textContent(), /local recovery draft.*removes the reference photo/, 'privacy explains recoverable local photo storage and removal');
    await page.click('.pet-generate');
    await page.locator('.pet-result-frame .pet-animated-sprite').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('.pet-generate').disabled);
    assert.equal(calls.length, 16);
    assert.deepEqual(calls.map(call => call.animationPage), Array.from({length:16},(_,i)=>i));
    assert.ok(calls.every(call=>call.animationVersion===2));
    assert.equal(calls[0].name, 'Robin');
    assert.equal(calls[0].kind, 'humanoid');
    assert.equal(calls[0].personality, 'Curious, thoughtful, and fond of quiet puzzles.');
    assert.equal(calls[0].distinctiveFeatures, distinctiveFeatures);
    assert.match(calls[0].photo, /^data:image\/(png|jpeg|webp);base64,/);
    assert.equal(await page.evaluate(() => Tracer.pet.read().selected), 'sprout', 'preview does not adopt automatically');
    await inspectForm(page, 'generated preview');
    await page.locator('.pet-adopt').hover();
    const adoptContrast = await page.locator('.pet-adopt').evaluate(el => {
      const style = getComputedStyle(el);
      const luminance = color => {
        const channels = color.match(/[\d.]+/g).slice(0,3).map(Number).map(value => {
          value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
        });
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
      };
      const foreground = luminance(style.color), background = luminance(style.backgroundColor);
      return (Math.max(foreground,background) + .05) / (Math.min(foreground,background) + .05);
    });
    assert.ok(adoptContrast >= 4.5, 'Save remains readable on hover: contrast ' + adoptContrast);
    for (const width of [1440,360]) {
      await page.setViewportSize({ width, height: 1000 });
      const pair = await page.locator('.pet-create-preview').evaluate(el => {
        const [source,output] = [...el.querySelectorAll('figure')].map(figure => {
          const rect = figure.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width };
        });
        return { source, output, width: el.getBoundingClientRect().width };
      });
      if (width > 650) {
        assert.ok(Math.abs(pair.source.top-pair.output.top)<1 && pair.source.right<pair.output.left, 'wide previews are aligned side by side');
      } else {
        assert.ok(pair.source.bottom<pair.output.top && pair.output.width>pair.width*.95, 'narrow previews stack at full width for facial detail');
      }
      await inspectForm(page, 'generated preview/' + width);
      await page.locator('.pet-create-preview').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(profile, 'generated-comparison-' + width + '.png'), animations: 'disabled' });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.match(await page.locator('.pet-generate').innerText(), /Preview actions/);
    await page.click('.pet-generate');
    assert.equal(calls.length, 16, 'the completed primary button previews without spending image allowance');
    const kindConfirmation=page.waitForEvent('dialog').then(async dialog=>{
      assert.match(dialog.message(),/clear.*16.*allowance/);
      await dialog.accept();
    });
    await page.selectOption('#pet-custom-kind', 'creature');
    await kindConfirmation;
    await page.locator('.pet-adopt').waitFor({state:'hidden'});
    assert.equal(await page.locator('.pet-adopt').isVisible(), false, 'confirming a kind change clears artwork generated for the old kind');
    assert.equal(await page.locator('.pet-result-frame .pet-animated-sprite').count(), 0);
    await page.selectOption('#pet-custom-kind', 'humanoid');
    // Regeneration needs an explicit click and adopting uses the latest result.
    await page.click('.pet-generate');
    await page.waitForFunction(() => !document.querySelector('.pet-generate').disabled);
    assert.equal(calls.length, 32);
    await page.click('.pet-adopt');
    await page.waitForFunction(() => document.querySelector('.pet-name')?.textContent === 'Robin');
    const humanoid = await page.evaluate(() => {
      const state = Tracer.pet.read();
      return { selected: state.selected, customs: state.customs };
    });
    assert.equal(humanoid.customs.length, 1);
    assert.equal(humanoid.customs[0].kind, 'humanoid');
    assert.equal('distinctiveFeatures' in humanoid.customs[0], false, 'visual guidance is not stored in the companion profile');
    assert.equal(humanoid.customs[0].image, '/api/pet-art/' + '17'.padStart(32, '0') + '.png');
    assert.equal(humanoid.customs[0].animation.version,2);
    assert.deepEqual(humanoid.customs[0].animation.pages, Array.from({length:16},(_,i)=>i+17).map(value => '/api/pet-art/' + String(value).padStart(32,'0') + '.png'));
    const humanoidCare = await page.locator('.pet-care-actions').innerText();
    assert.match(humanoidCare, /Share a meal/);
    assert.match(humanoidCare, /Hang out/);
    assert.match(humanoidCare, /Rest/);
    await page.screenshot({ path: path.join(profile, 'custom-humanoid.png'), animations: 'disabled' });
    await page.click('[data-act="sleep"]');
    assert.equal(await page.locator('.pet-home').getAttribute('data-mood'), 'sleeping');
    await page.click('[data-act="sleep"]');
    await page.click('[data-tab="chat"]');
    await page.fill('#pet-message', 'How should we approach our day?');
    await page.click('.pet-send');
    await page.locator('.pet-chat-assistant').waitFor();
    assert.deepEqual(chats[0].companion, { name: 'Robin', personality: 'Curious, thoughtful, and fond of quiet puzzles.', kind: 'humanoid' });
    assert.equal('photo' in chats[0], false, 'chat does not resend source photos');
    assert.equal('distinctiveFeatures' in chats[0], false, 'visual guidance is used only for image generation');
    await page.reload(); await page.waitForFunction(() => window.Tracer?.pet);
    assert.equal(await page.evaluate(() => Tracer.pet.read().selected), humanoid.selected);
    await page.click('#pet-open');
    assert.equal(await page.locator('.pet-name').innerText(), 'Robin');
    await page.locator('.pet-character img').waitFor();
    await page.waitForFunction(() => { const image = document.querySelector('.pet-character img'); return image?.complete && image.naturalWidth > 0; });
    // Creature behavior, an optional empty personality, and a recoverable failure.
    await openCreator(page);
    await page.locator('#pet-photo').setInputFiles(photo);
    await page.fill('#pet-custom-name', 'Pebble');
    await page.selectOption('#pet-custom-kind', 'creature');
    await page.locator('.pet-photo-preview').waitFor({ state: 'visible' });
    failNext = true;
    await page.click('.pet-generate');
    await page.waitForFunction(() => !document.querySelector('.pet-generate').disabled);
    assert.equal(calls.length, 33);
    assert.equal(await page.inputValue('#pet-custom-name'), 'Pebble');
    assert.equal(await page.locator('#pet-photo').evaluate(el => el.files.length), 1);
    assert.equal(await page.inputValue('#pet-custom-personality'), '');
    assert.ok(await page.locator('.pet-create-form [role="alert"]').innerText(), 'generation failure is visible');
    await page.click('.pet-generate');
    await page.waitForFunction(() => !document.querySelector('.pet-generate').disabled);
    assert.equal(calls.length, 49);
    assert.equal(calls[33].kind, 'creature');
    assert.equal(calls[33].personality, '');
    await page.click('.pet-adopt');
    await page.waitForFunction(() => document.querySelector('.pet-name')?.textContent === 'Pebble');
    const creatureCare = await page.locator('.pet-care-actions').innerText();
    assert.notEqual(creatureCare, humanoidCare, 'humanoid and creature care use distinct interaction labels');
    assert.match(creatureCare, /Feed/);
    assert.match(creatureCare, /Play/);
    assert.match(creatureCare, /Sleep/);
    await page.screenshot({ path: path.join(profile, 'custom-creature.png'), animations: 'disabled' });
    assert.equal(await page.evaluate(() => Tracer.pet.read().customs.length), 2);
    await page.click('[data-tab="chat"]');
    await page.fill('#pet-message', 'Hello, Pebble.'); await page.click('.pet-send');
    await page.locator('.pet-chat-assistant').waitFor();
    assert.equal(chats.at(-1).companion.kind, 'creature');
    assert.equal(chats.at(-1).companion.personality, '');
    // Switching characters releases a pending chat and rejects its stale reply.
    const chatHeld = new Promise(resolve => { onChatHeld = resolve; });
    holdNextChat = true;
    await page.fill('#pet-message', 'This slow reply belongs to Pebble.');
    await page.click('.pet-send');
    await chatHeld;
    assert.equal(await page.locator('.pet-send').isDisabled(), true);
    await page.click('[data-tab="collection"]');
    await page.locator('[data-act="select"][data-value="' + humanoid.selected + '"]').click();
    await page.click('[data-tab="chat"]');
    await page.waitForFunction(() => !document.querySelector('.pet-send').disabled && !document.querySelector('#pet-message').disabled);
    assert.equal(await page.locator('.pet-name').innerText(), 'Robin');
    assert.equal(await page.locator('.pet-chat-assistant').count(), 0, 'switching resets the previous companion conversation');
    await heldChat.fulfill({ json: { reply: 'STALE PEBBLE REPLY' } }).catch(error => {
      // Chromium may already have discarded the explicitly aborted request.
      if (!/interception|closed|aborted|invalid/i.test(error.message)) throw error;
    });
    await page.fill('#pet-message', 'A new conversation with Robin.');
    await page.click('.pet-send');
    await page.locator('.pet-chat-assistant').waitFor();
    assert.equal(await page.locator('.pet-chat-assistant').innerText(), 'Let’s take one curious little step together.');
    assert.equal(chats.at(-1).companion.kind, 'humanoid');
    assert.equal(chats.at(-1).messages.length, 1, 'new companion conversation excludes the earlier request');
    assert.equal(await page.locator('.pet-chat-log').innerText().then(text => text.includes('STALE PEBBLE REPLY')), false);
    // Subscription generation is the default and never falls back to the API.
    await openCreator(page, null);
    assert.equal(await page.inputValue('#pet-image-source'), 'codex');
    assert.equal(await page.locator('.pet-image-settings').isVisible(), false);
    assert.equal(await page.locator('.pet-generation-details').evaluate(el => el.open), false);
    assert.equal(await page.locator('.pet-generation-summary').isVisible(), true);
    assert.match(await page.locator('.pet-generation-summary').innerText(), /OpenAI.*ChatGPT allowance/, 'subscription destination and allowance remain visible without expanding details');
    await page.locator('#pet-photo').setInputFiles(photo);
    await page.fill('#pet-custom-name', 'Willow');
    await page.fill('#pet-custom-personality', 'Patient and curious.');
    await page.fill('#pet-distinctive-features', 'Keep the original markings.');
    await page.locator('.pet-photo-preview').waitFor({ state: 'visible' });
    await page.click('.pet-create-form [data-act="open-ai"]');
    await page.locator('#ai-mode-codex.btn-primary').waitFor();
    assert.equal(await page.locator('.ai-dialog [data-ai-step="3"]').getAttribute('aria-current'), 'step');
    assert.equal(await page.locator('#ai-url').count(), 0, 'subscription generation opens subscription settings instead of API credentials');
    assert.equal(await page.evaluate(() => localStorage.getItem('tracer.ai.mode')), 'codex');
    await page.click('#ai-close');
    await page.click('#pet-generation-status');
    await page.locator('.pet-create-form').waitFor();
    assert.equal(await page.inputValue('#pet-image-source'), 'codex');
    assert.equal(await page.inputValue('#pet-custom-name'), 'Willow');
    assert.equal(await page.inputValue('#pet-custom-personality'), 'Patient and curious.');
    assert.equal(await page.inputValue('#pet-distinctive-features'), 'Keep the original markings.');
    assert.equal(await page.locator('.pet-photo-preview').isVisible(), true);
    assert.equal(codexCalls.length, 0, 'subscription mode does not upload before Generate');
    await page.click('.pet-generate');
    await page.locator('.pet-adopt').waitFor({ state: 'visible' });
    assert.equal(codexCalls.length, 16);
    assert.equal(codexCalls[0].imageSource, 'codex');
    assert.equal(codexCalls[0].distinctiveFeatures, 'Keep the original markings.');
    assert.equal(calls.length, 49, 'subscription generation does not contact the personal API');
    await page.click('.pet-adopt');
    await page.waitForFunction(() => document.querySelector('.pet-name')?.textContent === 'Willow');
    const subscriptionCompanion = await page.evaluate(() => { const state = Tracer.pet.read(); return state.customs.find(pet => pet.id === state.selected); });
    assert.match(subscriptionCompanion.image, /^\/api\/pet-art\/c{31}1\.png$/);
    assert.equal(subscriptionCompanion.personality, 'Patient and curious.');
    await openCreator(page, null);
    await page.locator('#pet-photo').setInputFiles(photo);
    await page.fill('#pet-custom-name', 'Keep this subscription draft');
    await page.selectOption('#pet-custom-kind', 'humanoid');
    await page.fill('#pet-custom-personality', 'Patient, observant, and gentle.');
    await page.fill('#pet-distinctive-features', 'Keep the round glasses.');
    await page.locator('.pet-photo-preview').waitFor({ state: 'visible' });
    const retryPhoto = await page.locator('.pet-photo-preview').getAttribute('src');
    codexError = 'codex-quota-exhausted';
    await page.click('.pet-generate');
    await page.waitForFunction(() => !document.querySelector('.pet-generate').disabled);
    assert.equal(codexCalls.length, 17);
    assert.equal(calls.length, 49, 'quota failure must not trigger a paid API fallback');
    assert.equal(await page.inputValue('#pet-image-source'), 'codex');
    assert.equal(await page.inputValue('#pet-custom-name'), 'Keep this subscription draft');
    assert.equal(await page.locator('.pet-photo-preview').isVisible(), true);
    assert.match(await page.locator('.pet-create-error').innerText(), /allowance is exhausted/);
    assert.equal(await page.locator('.pet-adopt').isVisible(), false);
    codexError = 'codex-image-no-result';
    await page.click('.pet-generate');
    await page.waitForFunction(() => !document.querySelector('.pet-generate').disabled);
    assert.equal(codexCalls.length, 18);
    assert.equal(calls.length, 49, 'a no-image response must not invoke any paid API fallback');
    assert.equal(await page.inputValue('#pet-image-source'), 'codex');
    assert.equal(await page.inputValue('#pet-custom-name'), 'Keep this subscription draft');
    assert.equal(await page.inputValue('#pet-custom-kind'), 'humanoid');
    assert.equal(await page.inputValue('#pet-custom-personality'), 'Patient, observant, and gentle.');
    assert.equal(await page.inputValue('#pet-distinctive-features'), 'Keep the round glasses.');
    assert.equal(await page.locator('.pet-photo-preview').getAttribute('src'), retryPhoto);
    assert.equal(await page.locator('#pet-photo').evaluate(el => el.files.length), 1);
    assert.equal(await page.locator('.pet-create-error').innerText(), 'This request returned no image. Your photo and settings are still here; you can retry.');
    assert.equal(await page.locator('.pet-adopt').isVisible(), false);
    assert.equal(await page.locator('.pet-result-frame .pet-animated-sprite').count(), 0);
    assert.equal(await page.evaluate(() => Tracer.pet.read().customs.length), 3, 'a failed image request does not add an empty companion');
    await page.locator('.pet-create-error').scrollIntoViewIfNeeded();
    await page.screenshot({ path:path.join(profile,'subscription-no-image.png'), animations:'disabled' });
    let discardConfirmation=page.waitForEvent('dialog').then(dialog=>dialog.accept());
    await page.click('.pet-discard-draft'); await discardConfirmation;
    await page.locator('.pet-create-form').waitFor({state:'hidden'});
    // Both languages retain the original label-spacing fix in the new form.
    for (const language of ['en','zh']) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.selectOption('#language-select', language); await page.click('#pet-open');
      await openCreator(page);
      await page.fill('#pet-custom-name', 'A companion with a pleasantly long name');
      await page.fill('#pet-custom-personality', 'Curious and thoughtful. '.repeat(12));
      await page.fill('#pet-distinctive-features', 'Round glasses, hair curls, and the original jacket. '.repeat(6));
      await page.locator('#pet-photo').setInputFiles(photo);
      await page.locator('.pet-image-settings').evaluate(el => el.open = true);
      for (const width of [360,420,760,1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.locator('#pet-custom-personality').focus();
        await inspectForm(page, language + '/' + width + '/custom form');
      }
      await page.setViewportSize({ width: 360, height: 1000 });
      await page.locator('.modal').evaluate(el => el.scrollTop = 0);
      await page.screenshot({ path: path.join(profile, 'custom-form-' + language + '.png'), animations: 'disabled' });
      discardConfirmation=page.waitForEvent('dialog').then(dialog=>dialog.accept());
      await page.click('.pet-discard-draft'); await discardConfirmation;
      await page.locator('.pet-create-form').waitFor({state:'hidden'});
    }
    assert.equal(calls.length, 49, 'layout checks and canceled uploads make no provider calls');
    assert.equal(codexCalls.length, 18, 'layout checks and canceled uploads make no subscription calls');
    assert.deepEqual(errors, [], 'no renderer errors');
    console.log('PASS custom upload, local recovery disclosure, preserved settings draft, confirmed regeneration, subscription quota/no-image errors without API fallback, preview/adoption, persistence, humanoid/creature behavior, personality, pending-chat switching and bilingual layouts at 360–1440px');
    console.log('Artifacts: ' + profile);
  } finally {
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
