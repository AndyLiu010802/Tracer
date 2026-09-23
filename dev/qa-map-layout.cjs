'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(root, '.cache/map-layout-'));
Object.assign(process.env, { DOCS_PORTAL_HOST: '127.0.0.1', DOCS_PORTAL_SKIN: 'tracer', DOCS_PORTAL_DATA_DIR: path.join(temporary, 'data'), DOCS_PORTAL_STATE_FILE: path.join(temporary, 'bookmarks.json') });
const { server } = require('../server');
const M = require('../skins/tracer/model');
const workspace = M.emptyWorkspace();
const project = M.addProject(workspace, { name: 'Weekend Apartment Reset' });
const titles = ['Make a weekend reset plan', 'Buy groceries & cleaning supplies', 'Deep clean the kitchen', 'Meal prep for next week', 'Final apartment reset', 'W'.repeat(100), '\u5468\u672b\u516c\u5bd3\u6e05\u6d01\u4e0e\u6574\u7406'.repeat(6), 'Review "quotes" <tags> & details', 'Short'];
titles.forEach((title, index) => M.addTask(workspace, { title, projectId: project.id, status: index === 0 ? 'done' : index === 2 ? 'doing' : 'todo' }));
M.addProject(workspace, { name: 'Empty project with a very long name' });
M.addTask(workspace, { title: 'Unassigned task' });
function check(value, label) { assert.ok(value, label); console.log('PASS ' + label); }
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/store/workspace', route => route.fulfill({ json: workspace }));
    await page.addInitScript(() => localStorage.setItem('tracer.language', 'en'));
    await page.goto('http://127.0.0.1:' + server.address().port + '/?sec=map');
    await page.locator('.mn-label').first().waitFor();
    for (const width of [1440, 1000, 900]) {
      await page.setViewportSize({ width, height: 1000 });
      const metrics = await page.locator('.mn').evaluateAll(nodes => nodes.map(node => {
        const label = node.querySelector('.mn-label'), box = label.getBoundingClientRect();
        const rect = node.querySelector('rect').getBoundingClientRect();
        const moon = node.matches('.mn-proj') && node.querySelector('circle').getBoundingClientRect();
        const style = getComputedStyle(label);
        return { fits: box.left >= rect.left && box.right <= rect.right && box.top >= rect.top && box.bottom <= rect.bottom, clear: !moon || box.right <= moon.left - 6, tooltip: label.title === label.textContent, clipped: style.overflow === 'hidden' && style.textOverflow === 'ellipsis', long: label.scrollWidth > label.clientWidth };
      }));
      check(metrics.every(m => m.fits && m.clear && m.tooltip && m.clipped), width + ': labels fit nodes, clear icons and preserve full titles');
      check(metrics.some(m => m.long), width + ': long labels use ellipsis');
      await page.locator('#sec-map').screenshot({ path: path.join(temporary, 'map-' + width + '.png') });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const toggle = page.locator('[data-toggle="' + project.id + '"]');
    await toggle.click();
    check(await page.locator('.mn-task').count() === 1, 'project collapses');
    await toggle.click();
    check(await page.locator('.mn-task').count() === titles.length + 1, 'project expands');
    const canvas = await page.locator('#map-canvas').boundingBox();
    await page.mouse.move(canvas.x + 20, canvas.y + 20);
    await page.mouse.down();
    await page.mouse.move(canvas.x + 60, canvas.y + 50);
    await page.mouse.up();
    check(await page.locator('#map-svg').evaluate(el => el.style.transform === 'translate(40px, 30px)'), 'canvas still pans');
    const task = page.locator('.mn-task').filter({ hasText: titles[1] });
    await task.locator('.mn-label').click();
    check(await page.locator('input').evaluateAll(inputs => inputs.some(input => input.value === 'Buy groceries & cleaning supplies')), 'clicking a truncated title opens the original task');
    check(errors.length === 0, 'no renderer errors');
    console.log('Screenshots: ' + temporary);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(() => server.close());
