'use strict';

// 给 tracer 皮肤灌一份演示数据（项目/任务/笔记/收集项），让七个分区一眼看上去
// 像个用了一阵子的工作台：Board 四列都有卡、Planner 本周排得满、Timeline 有横条、
// Insights 有完成柱、Map 有分叉、Notes 有内容。
//
// 为什么需要它：演示数据存在 data/workspace.json，被 .gitignore 挡在版本控制之外，
// 而 store 的 .bak 只保留一代——某个探针不小心写坏它，就没有任何恢复点。
// 这个脚本就是那个恢复点：随时可重放。
//
// 用法：
//   node dev/seed.js              # 灌进默认的 data/（已有非空存档时会拒绝）
//   node dev/seed.js --force      # 覆盖已有存档
//   DOCS_PORTAL_DATA_DIR=/tmp/x node dev/seed.js   # 灌进别处
//
// 数据全部走 skins/tracer/model.js 的真实 API 生成，所以 id、seq 计数器、
// 排序步长、项目配色、状态枚举都与应用自己写出来的档完全同构，不会灌出非法结构。

const path = require('node:path');
const fs = require('node:fs');

const REPO = path.join(__dirname, '..');
const M = require(path.join(REPO, 'skins', 'tracer', 'model.js'));
const store = require(path.join(REPO, 'lib', 'store.js'));

const DATA_DIR = process.env.DOCS_PORTAL_DATA_DIR || path.join(REPO, 'data');
const NAME = 'workspace';
const force = process.argv.includes('--force');

// 日期一律相对「今天」算，所以无论哪天跑，Planner 的本周和 Timeline 的当月都是满的。
const today = M.todayISO();
const d = M.addDays;

function build() {
  const ws = M.emptyWorkspace();

  const api = M.addProject(ws, { name: 'API redesign' });
  M.updateProject(ws, api.id, { start: d(today, -6), end: d(today, 12) });

  const infra = M.addProject(ws, { name: 'Infra migration' });
  M.updateProject(ws, infra.id, { start: d(today, 3), end: d(today, 24) });

  // 五个任务铺满四列，并且分别落在本周的不同天上，Planner 才有东西可拖。
  const t1 = M.addTask(ws, {
    title: 'Draft v2 resource schema',
    projectId: api.id,
    status: 'done',
    scheduled: d(today, -3),
    notes: 'Settled on cursor pagination over offset.',
  });
  // done 的任务要有 doneAt，Insights 的每周完成柱才落得进桶里。
  t1.doneAt = Date.now() - 3 * 86400000;

  M.addTask(ws, {
    title: 'Deprecate /v1/records batch endpoint',
    projectId: api.id,
    status: 'doing',
    scheduled: today,
    priority: 'high',
    due: d(today, 4),
  });

  M.addTask(ws, {
    title: 'Write migration guide for consumers',
    projectId: api.id,
    status: 'review',
    scheduled: d(today, 1),
  });

  M.addTask(ws, {
    title: 'Benchmark connection pooling under load',
    projectId: infra.id,
    status: 'todo',
    scheduled: d(today, 2),
  });

  // 一个不挂项目、也不排期的任务：Map 的 Unassigned 分支和 Planner 的未安排托盘
  // 各需要至少一条数据才看得出结构。
  M.addTask(ws, {
    title: 'Audit stale feature flags',
    status: 'todo',
  });

  M.addNote(ws, {
    title: 'Rollout checklist',
    projectId: api.id,
    body: [
      '## Before flipping the flag',
      '',
      '- [x] Shadow traffic for a full week',
      '- [ ] Error budget signed off',
      '- [ ] Rollback rehearsed on staging',
      '',
      'Owner: platform. Escalation goes to the on-call rotation, not to me.',
    ].join('\n'),
  });

  M.addNote(ws, {
    title: 'Notes from the sync',
    body: [
      'Consumers care more about **stable ordering** than about raw latency.',
      '',
      'Two teams asked for the same thing in different words, so it is worth',
      'writing down once: cursors must survive a backfill.',
    ].join('\n'),
  });

  M.addInbox(ws, 'Ask about retention policy on the audit log');
  M.addInbox(ws, 'Read up on connection pooling in the new driver');

  return ws;
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const target = path.join(DATA_DIR, NAME + '.json');
  if (!force && fs.existsSync(target)) {
    let existing = null;
    try {
      existing = JSON.parse(fs.readFileSync(target, 'utf8'));
    } catch {
      existing = null;
    }
    // 空档（或坏档）直接覆盖没什么可惜的；有内容的档必须显式 --force，
    // 免得手滑把正在用的工作台清了。
    const populated = existing && ((existing.tasks || []).length
      || (existing.notes || []).length || (existing.inbox || []).length);
    if (populated) {
      process.stderr.write(
        '拒绝覆盖已有存档：' + target + '\n'
        + '  它现在有 ' + (existing.tasks || []).length + ' 个任务、'
        + (existing.notes || []).length + ' 条笔记、'
        + (existing.inbox || []).length + ' 个收集项。\n'
        + '  确认要重灌请加 --force。\n');
      process.exitCode = 1;
      return;
    }
  }

  const ws = build();
  await store.writeStore(DATA_DIR, NAME, JSON.stringify(ws));

  process.stdout.write(
    '已灌入演示数据 → ' + target + '\n'
    + '  ' + ws.projects.length + ' 个项目、' + ws.tasks.length + ' 个任务、'
    + ws.notes.length + ' 条笔记、' + ws.inbox.length + ' 个收集项\n');
}

main().catch((err) => {
  process.stderr.write('灌数据失败：' + err.message + '\n');
  process.exitCode = 1;
});
