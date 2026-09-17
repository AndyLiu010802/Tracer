// Run with Playwright MCP browser_run_code_unsafe(filename). All workspace/state requests
// are fulfilled in memory. This harness never writes to the task server.
async (page) => {
  const p = await page.context().newPage();
  p.setDefaultTimeout(6000);
  const results = [], errors = [];
  p.on('pageerror', error => errors.push(error.message));
  const assert = (ok, label) => { if (!ok) throw new Error(label); results.push(label); };
  let ws = { tasks: [
    { id: 'qa-one', seq: 'TRC-1', title: 'Design review', notes: '', status: 'todo', order: 1000, createdAt: 1789440000000 },
    { id: 'qa-two', seq: 'TRC-2', title: 'Verify release', notes: '', status: 'todo', order: 2000, createdAt: 1789440000000 },
    { id: 'qa-three', seq: 'TRC-3', title: 'Prepare build', notes: '', status: 'doing', order: 3000, createdAt: 1789440000000 }
  ], projects: [], notes: [], inbox: [], meta: { seqCounter: 3, rev: 0 } };
  let writes = 0;
  await p.route('**/api/store/**', async route => {
    if (route.request().url().endsWith('/workspace')) {
      if (route.request().method() === 'PUT') { writes++; ws = route.request().postDataJSON(); await route.fulfill({ json: { ok: true } }); }
      else await route.fulfill({ json: ws });
    } else await route.fulfill({ json: null });
  });
  await p.route('**/api/state', route => route.fulfill({ json: {} }));
  try {
    await p.setViewportSize({ width: 1440, height: 1000 });
    await p.goto('http://localhost:8097/?sec=board&qa=interactions', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await p.locator('.card').first().waitFor();
    await p.selectOption('#language-select', 'en');
    const state = id => p.evaluate(id => ({ ...window.TracerModel.findTask(window.Tracer.store.data, id) }), id);
    const saveSettled = () => p.waitForFunction(() => !window.Tracer.store.dirty && !window.Tracer.store.inflight);
    await p.locator('#new-btn').click();
    await p.locator('#f-title').fill('Professional task');
    await p.locator('#f-assignee').fill('Andy'); await p.locator('#f-labels').fill('UI, delivery');
    await p.selectOption('#f-type', 'feature'); await p.selectOption('#f-pri', 'urgent');
    await p.locator('#f-estimate').fill('3.5'); await p.locator('#f-spent').fill('1');
    await p.locator('#f-acceptance').fill('Pointer and keyboard both pass');
    await p.locator('#f-links').fill('https://example.com/spec');
    await p.locator('#check-new').fill('Verify save'); await p.locator('#check-add').click();
    await p.locator('[data-check="0"]').check(); await p.locator('[data-dependency="qa-one"]').check();
    await p.locator('#f-save').click(); await saveSettled();
    const created = await p.evaluate(() => window.Tracer.store.data.tasks.find(t => t.title === 'Professional task'));
    assert(created.assignee === 'Andy' && created.estimate === 3.5 && created.checklist[0].done && created.dependsOn[0] === 'qa-one', 'rich fields save through real editor');
    await p.reload(); await p.locator('.card').first().waitFor();
    assert((await state(created.id)).labels.join(',') === 'UI,delivery', 'rich fields survive reload');
    await p.locator('.card[data-id="qa-one"] .card-title').click();
    await p.locator('#f-assignee').fill('Discard candidate');
    p.once('dialog', d => d.dismiss()); await p.locator('#f-cancel').click();
    assert(await p.locator('.task-editor').isVisible(), 'cancel protects unsaved fields');
    p.once('dialog', d => d.accept()); await p.locator('#f-cancel').click();
    assert(!(await state('qa-one')).assignee, 'discard leaves original task unchanged');
    await p.locator('.card[data-id="qa-one"] .card-title').click();
    await p.locator('[data-dependency="' + created.id + '"]').check(); await p.locator('#f-save').click();
    assert((await p.locator('#task-error').innerText()).includes('cycles'), 'dependency cycle has actionable error');
    p.once('dialog', d => d.accept()); await p.locator('#f-cancel').click();
    let grip = await p.locator('.card[data-id="qa-one"] .drag-handle').boundingBox();
    let destination = await p.locator('.col-body[data-col="done"]').boundingBox();
    await p.mouse.move(grip.x + 10, grip.y + 10); await p.mouse.down();
    await p.mouse.move(destination.x + destination.width / 2, destination.y + 45, { steps: 12 });
    assert(await p.locator('.drag-ghost').count() === 1 && await p.locator('.drag-placeholder').count() === 1 && await p.locator('.drop-target').count() === 1, 'drag shows lifted card, insertion slot and target');
    assert((await state('qa-one')).status === 'todo', 'drag preview does not mutate task');
    await p.mouse.up();
    assert((await state('qa-one')).status === 'done', 'drop changes status');
    assert(await p.locator('#modal-root').isHidden(), 'drop does not accidentally open editor');
    await p.locator('#task-notice button').click(); assert((await state('qa-one')).status === 'todo', 'undo restores prior status');
    await saveSettled(); const beforeCancel = writes;
    grip = await p.locator('.card[data-id="qa-one"] .drag-handle').boundingBox();
    destination = await p.locator('.col-body[data-col="doing"]').boundingBox();
    await p.mouse.move(grip.x + 10, grip.y + 10); await p.mouse.down(); await p.mouse.move(destination.x + 50, destination.y + 25, { steps: 8 });
    await p.keyboard.press('Escape'); await p.mouse.up();
    assert(await p.locator('.drag-ghost').count() === 0 && (await state('qa-one')).status === 'todo' && writes === beforeCancel, 'Escape cancels drag without persistence');
    grip = await p.locator('.card[data-id="qa-one"] .drag-handle').boundingBox();
    await p.mouse.move(grip.x + 10, grip.y + 10); await p.mouse.down(); await p.mouse.move(5, 5, { steps: 8 });
    assert(await p.locator('.drag-ghost.drop-invalid').count() === 1, 'outside drop shows invalid target feedback');
    await p.mouse.up(); assert((await state('qa-one')).status === 'todo', 'outside drop cancels task move');
    grip = await p.locator('.card[data-id="qa-one"] .drag-handle').boundingBox();
    const second = await p.locator('.card[data-id="qa-two"]').boundingBox();
    await p.mouse.move(grip.x + 10, grip.y + 10); await p.mouse.down(); await p.mouse.move(second.x + 45, second.y + second.height + 6, { steps: 8 }); await p.mouse.up();
    assert((await state('qa-one')).order > (await state('qa-two')).order, 'pointer reorders within column');
    await p.locator('#task-notice button').click();
    await p.locator('.card[data-id="qa-one"]').focus(); await p.keyboard.press('Alt+ArrowDown');
    assert((await state('qa-one')).order > (await state('qa-two')).order, 'keyboard reorders within column');
    await p.keyboard.press('Alt+ArrowRight'); assert((await state('qa-one')).status === 'doing', 'keyboard moves across columns');
    await p.locator('.card[data-id="qa-one"] .card-move').selectOption('review'); assert((await state('qa-one')).status === 'review', 'status menu provides non-drag alternative');
    await p.selectOption('#language-select', 'zh');
    await p.locator('.card[data-id="' + created.id + '"] .card-title').click();
    assert((await p.locator('.task-editor').innerText()).includes('验收标准'), 'new editor fields switch to Chinese');
    await p.setViewportSize({ width: 1100, height: 800 });
    assert(await p.locator('#f-save').isVisible(), 'editor save remains visible');
    await p.locator('#f-cancel').click();
    await p.locator('[data-sec="planner"]').click();
    grip = await p.locator('.pl-card[data-id="qa-one"] .drag-handle').boundingBox();
    destination = await p.locator('.pl-day .pl-body').first().boundingBox();
    const plannedDay = await p.locator('.pl-day .pl-body').first().getAttribute('data-day');
    await p.mouse.move(grip.x + 8, grip.y + 8); await p.mouse.down(); await p.mouse.move(destination.x + destination.width / 2, destination.y + 20, { steps: 10 }); await p.mouse.up();
    assert((await state('qa-one')).scheduled === plannedDay, 'planner drag schedules task');
    await p.locator('#task-notice button').click(); assert(!(await state('qa-one')).scheduled, 'planner undo restores schedule');
    assert(errors.length === 0, 'no browser runtime errors');
    return { results, mockedWrites: writes };
  } catch (error) { return { results, error: error.message, browserErrors: errors }; }
  finally { await p.close(); }
}
