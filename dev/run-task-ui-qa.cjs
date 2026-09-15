'use strict';
// Optional QA dependency; it is not required by the application.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { chromium } = require(process.env.TRACER_QA_PLAYWRIGHT || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const source = fs.readFileSync(path.join(__dirname, process.argv[2] || 'qa-task-interactions.js'), 'utf8');
    const run = vm.runInThisContext('(' + source + ')');
    const result = await run(page);
    console.log(JSON.stringify(result, null, 2));
    if (result.error) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
