'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// 存储必须落进临时目录，不能污染仓库的 data/。
// 环境变量要在 require server 之前设好——config 和常量在 require 时就固定了。
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'store-test-'));
process.env.DOCS_PORTAL_DATA_DIR = TMP;
process.env.DOCS_PORTAL_SKIN = 'docs-portal';

const { server, handleRequest } = require('../server.js');

let origin;

test.before(() => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    origin = 'http://127.0.0.1:' + server.address().port;
    resolve();
  });
}));

test.after(() => new Promise((resolve) => server.close(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  resolve();
})));

function req(method, pathname, body, headers) {
  return new Promise((resolve, reject) => {
    const r = http.request(origin + pathname, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    r.on('error', error => {
      error.message += ' [' + method + ' ' + pathname + ', headers=' + JSON.stringify(headers || {}) + ', reusedSocket=' + r.reusedSocket + ']';
      reject(error);
    });
    r.end(body);
  });
}

test('PUT 后 GET 取回同一份数据', async () => {
  const put = await req('PUT', '/api/store/ws-a', '{"tasks":[{"id":"t1"}]}');
  assert.strictEqual(put.status, 200);
  const get = await req('GET', '/api/store/ws-a');
  assert.strictEqual(get.status, 200);
  assert.deepStrictEqual(JSON.parse(get.body), { tasks: [{ id: 't1' }] });
});

test('未写过的名字返回 null', async () => {
  const r = await req('GET', '/api/store/never-written');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body, 'null');
});

test('非法名字一律 404', async () => {
  // 大写、空格、下划线、点都不在白名单里；
  // 穿越型的 ../ 会被 URL 规范化吃掉，落到别的路由自然 404。
  for (const bad of ['/api/store/UPPER', '/api/store/a%20b',
    '/api/store/a_b', '/api/store/x.y', '/api/store/']) {
    const r = await req('PUT', bad, '{}');
    assert.strictEqual(r.status, 404, bad + ' 应 404');
  }
});

test('编码的斜杠混不进名字', async () => {
  // %2F 解码后名字带 /，正则拒绝
  const nested = await req('PUT', '/api/store/x%2Fy', '{}');
  assert.strictEqual(nested.status, 404, '名字里的 / 必须拒绝');
  // 穿越型在入口就被 pathname 规范化吃掉，整段掉出 /api/store/ 前缀
  const escaped = await req('PUT', '/api/store/..%2F..%2Fescaped', '{}');
  assert.strictEqual(escaped.status, 404, '穿越型名字不得命中 store 路由');
  // x/../y 规范化成 y：是个合法名字，写得进去，但只能落在 DATA_DIR 里
  const norm = await req('PUT', '/api/store/x%2F..%2Fy', '{"v":1}');
  assert.strictEqual(norm.status, 200);
  assert.ok(fs.existsSync(path.join(TMP, 'y.json')), '应落在 DATA_DIR 内');
  assert.ok(!fs.existsSync(path.join(TMP, 'x')), '不得建出嵌套目录');
});

test('非 JSON body 拒收', async () => {
  const r = await req('PUT', '/api/store/ws-bad', 'not json at all');
  assert.strictEqual(r.status, 400);
  const g = await req('GET', '/api/store/ws-bad');
  assert.strictEqual(g.body, 'null', '坏数据不应落盘');
});

test('主文件损坏时回退上一版 .bak', async () => {
  await req('PUT', '/api/store/ws-crash', '{"v":1}');
  await req('PUT', '/api/store/ws-crash', '{"v":2}');
  // 第二次写之前，v1 被留成了 .bak。现在把主文件写坏：
  fs.writeFileSync(path.join(TMP, 'ws-crash.json'), '{"v":2,,,BROKEN', 'utf8');
  const r = await req('GET', '/api/store/ws-crash');
  assert.deepStrictEqual(JSON.parse(r.body), { v: 1 }, '应回退到上一版');
});

test('POST 与 PUT 等效（sendBeacon 只会发 POST）', async () => {
  await req('POST', '/api/store/ws-post', '{"ok":true}');
  const r = await req('GET', '/api/store/ws-post');
  assert.deepStrictEqual(JSON.parse(r.body), { ok: true });
});

test('同名并发 PUT 不写坏主文件', async () => {
  // 模拟真实客户端的时序：500ms 防抖 PUT 与 beforeunload sendBeacon 可能撞在一起，
  // 一大一小两份 payload 同时到达。旧实现共用一个 .tmp 文件名，
  // 两个写请求会交错写入同一个 fd，产出「大小payload 拼接 + NUL 填充」的垃圾。
  const big = JSON.stringify({ who: 'BIG', pad: 'A'.repeat(200 * 1024) });
  const small = JSON.stringify({ who: 'small' });
  for (let i = 0; i < 20; i++) {
    const [putBig, putSmall] = await Promise.all([
      req('PUT', '/api/store/ws-race', big),
      req('PUT', '/api/store/ws-race', small),
    ]);
    assert.ok([200].includes(putBig.status) && [200].includes(putSmall.status),
      '第 ' + i + ' 轮：两个并发 PUT 都应成功');
    const get = await req('GET', '/api/store/ws-race');
    assert.strictEqual(get.status, 200);
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(get.body); },
      '第 ' + i + ' 轮：主文件不应被并发写坏，实际内容：' + get.body.slice(0, 80));
    assert.ok(get.body === big || get.body === small,
      '第 ' + i + ' 轮：应完整等于其中一份 payload，不能是二者拼接');
  }
});

test('超限 body 返回 413 而不是连接被重置', async () => {
  // 存储上限是 4MB；旧实现超限时 req.destroy()，连响应都送不出去，
  // 客户端只会看到连接被重置而不是一个正常的 4xx。
  const huge = JSON.stringify({ pad: 'A'.repeat(5 * 1024 * 1024) });
  const r = await req('PUT', '/api/store/ws-huge', huge);
  assert.strictEqual(r.status, 413);
  // 顺带确认连接还活着，能接着发下一个请求（真被 destroy 的话这里会连不上）。
  const g = await req('GET', '/api/store/ws-huge');
  assert.strictEqual(g.status, 200);
});

test('损坏的主文件不会在下次保存时覆盖好的 .bak', async () => {
  // 时序（这条要点是"备份前必须验证上一版"，而不是无条件 copyFile）：
  //   1. 写 v1、写 v2：v2 落盘前，上一版 v1 合法，正常备份 -> .bak = v1。
  //   2. 手动写坏主文件——模拟 v2 写完之后磁盘/进程出了问题，主文件变成垃圾。
  //      这时 .bak 仍然 = v1（好的）。
  //   3. 写 v3：备份步骤读到的"上一版"是垃圾，解析失败 -> 跳过备份，
  //      .bak 保持 v1 不变（旧实现会在这里无条件把垃圾抄进 .bak，
  //      直接销毁掉唯一能用的备份）。写完之后主文件 = v3。
  //   4. 再次手动写坏主文件，模拟 v3 也崩溃了。
  //   5. GET：主文件解析失败，回退 .bak。
  //      新实现应该拿到 v1（备份从未被垃圾污染过）；
  //      旧实现在步骤 3 就已经把 .bak 覆盖成垃圾，这里会连不出任何版本，只能返回 null。
  const file = path.join(TMP, 'ws-guard.json');
  await req('PUT', '/api/store/ws-guard', '{"v":1}');
  await req('PUT', '/api/store/ws-guard', '{"v":2}');
  fs.writeFileSync(file, '{BROKEN', 'utf8');
  await req('PUT', '/api/store/ws-guard', '{"v":3}');
  fs.writeFileSync(file, '{BROKEN', 'utf8');
  const r = await req('GET', '/api/store/ws-guard');
  assert.deepStrictEqual(JSON.parse(r.body), { v: 1 }, '应回退到最后一份没被污染的好备份');
});

test('首写后损坏主文件（无 .bak 可退）时 GET 返回 409 corrupt', async () => {
  await req('PUT', '/api/store/ws-corrupt-nobak', '{"v":1}');
  // 只写过一次，还没有 .bak；现在把唯一的一份写坏。
  fs.writeFileSync(path.join(TMP, 'ws-corrupt-nobak.json'), '{BROKEN', 'utf8');
  const r = await req('GET', '/api/store/ws-corrupt-nobak');
  assert.strictEqual(r.status, 409);
  assert.strictEqual(r.headers['content-type'], 'application/json');
  assert.deepStrictEqual(JSON.parse(r.body), { ok: false, corrupt: true });
});

test('主文件与 .bak 都写坏时 GET 返回 409 corrupt', async () => {
  await req('PUT', '/api/store/ws-corrupt-both', '{"v":1}');
  await req('PUT', '/api/store/ws-corrupt-both', '{"v":2}');
  // 此时 .bak = v1；把主文件和 .bak 都写坏，模拟两份都救不回来的最坏情况。
  fs.writeFileSync(path.join(TMP, 'ws-corrupt-both.json'), '{BROKEN', 'utf8');
  fs.writeFileSync(path.join(TMP, 'ws-corrupt-both.json.bak'), '{ALSO BROKEN', 'utf8');
  const r = await req('GET', '/api/store/ws-corrupt-both');
  assert.strictEqual(r.status, 409);
  assert.deepStrictEqual(JSON.parse(r.body), { ok: false, corrupt: true });
});

test('不支持的方法返回 405，并带 Allow 头', async () => {
  const r = await req('DELETE', '/api/store/ws-x');
  assert.strictEqual(r.status, 405);
  assert.strictEqual(r.headers.allow, 'GET, HEAD, PUT, POST');
});

test('HEAD 走读取分支而不是被 405 误伤', async () => {
  await req('PUT', '/api/store/ws-head', '{"ok":true}');
  const r = await req('HEAD', '/api/store/ws-head');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body, '', 'HEAD 不应带 body');
});

test('旧同步配置不会接管工作区，本地写入保留任务和已有备份', async () => {
  const oldDir = path.join(TMP, '.sync');
  fs.mkdirSync(oldDir, { recursive: true });
  // An unusable retired endpoint must not be consulted for local reads or writes.
  const connection = JSON.stringify({ endpoint: 'https://retired.invalid/tracer', token: 'a'.repeat(48), expiresAt: 1 });
  const backup = JSON.stringify({ tasks: [{ id: 'before-pairing', title: 'Keep this backup' }], meta: {} });
  fs.writeFileSync(path.join(oldDir, 'connection.json'), connection);
  fs.writeFileSync(path.join(oldDir, 'before-pairing.json'), backup);
  const original = { tasks: [{ id: 'local-task', title: 'Local task' }], projects: [], notes: [], inbox: [], meta: { syncAccount: 'retired-account', syncVersion: 9 } };
  assert.strictEqual((await req('PUT', '/api/store/workspace', JSON.stringify(original))).status, 200);
  let result = await req('GET', '/api/store/workspace');
  assert.strictEqual(result.status, 200);
  assert.deepStrictEqual(JSON.parse(result.body).tasks, original.tasks);
  assert.strictEqual((await req('HEAD', '/api/store/workspace')).status, 200);
  const updated = JSON.parse(JSON.stringify(original)); updated.tasks[0].title = 'Local edit';
  assert.strictEqual((await req('POST', '/api/store/workspace', JSON.stringify(updated))).status, 200);
  result = await req('GET', '/api/store/workspace');
  assert.deepStrictEqual(JSON.parse(result.body).tasks, updated.tasks);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(TMP, 'workspace.json.bak'), 'utf8')).tasks, original.tasks);
  assert.strictEqual(fs.readFileSync(path.join(oldDir, 'connection.json'), 'utf8'), connection);
  assert.strictEqual(fs.readFileSync(path.join(oldDir, 'before-pairing.json'), 'utf8'), backup);
});

test('已移除的配对和同步接口返回 404', async () => {
  for (const [method, url] of [['GET', '/api/sync/status'], ['POST', '/api/sync/pair'], ['POST', '/api/sync/disconnect']]) {
    assert.strictEqual((await req(method, url, method === 'POST' ? '{}' : undefined)).status, 404, url);
  }
});

test('工作区拒绝非本机 Host 和跨来源写入且保留本地数据', async () => {
  const before = (await req('GET', '/api/store/workspace')).body;
  const replacement = JSON.stringify({ tasks: [], projects: [], notes: [], inbox: [], meta: {} });
  for (const method of ['GET', 'HEAD', 'PUT', 'POST']) {
    const result = await req(method, '/api/store/workspace', ['PUT', 'POST'].includes(method) ? replacement : undefined, { Host: 'untrusted.example' });
    assert.strictEqual(result.status, 403, method + ' with a non-loopback Host');
  }
  for (const method of ['PUT', 'POST']) {
    for (const source of ['https://untrusted.example', 'null', origin + '1']) {
      const result = await req(method, '/api/store/workspace', replacement, { Origin: source, 'content-type': 'text/plain;charset=UTF-8' });
      assert.strictEqual(result.status, 403, method + ' from ' + source);
    }
  }
  assert.strictEqual((await req('GET', '/api/store/workspace')).body, before);
});

test('工作区拒绝伪装成本机 Host 的远端连接', async () => {
  let status, body;
  const response = { writeHead(code) { status = code; return this; }, end(value) { body = value; } };
  await handleRequest({ url: '/api/store/workspace', method: 'GET', headers: { host: '127.0.0.1:8080' }, socket: { remoteAddress: '203.0.113.40' } }, response);
  assert.strictEqual(status, 403);
  assert.deepStrictEqual(JSON.parse(body), { ok: false });
});

test('同源工作区 beacon 和 JSON 写入无需自定义同步请求头', async () => {
  for (const [method, contentType] of [['POST', 'text/plain;charset=UTF-8'], ['PUT', 'application/json']]) {
    const workspace = { tasks: [{ id: 'same-origin', title: contentType }], projects: [], notes: [], inbox: [], meta: {} };
    const result = await req(method, '/api/store/workspace', JSON.stringify(workspace), { Origin: origin, 'content-type': contentType });
    assert.strictEqual(result.status, 200);
    assert.deepStrictEqual(JSON.parse((await req('GET', '/api/store/workspace')).body).tasks, workspace.tasks);
  }
});

test('old workspace writes preserve companion creation receipts and contradictory receipts never reach disk', async () => {
  const Work=require('../public/companion-work'),M=require('../skins/tracer/model');
  const id='f623b4d1-79de-4cad-ae76-d5523a54dacf';
  const proposal={type:'tasks',project:null,tasks:[{title:'Create once',notes:'',due:null,scheduled:null,priority:'medium',estimate:null,checklist:[]}]};
  const created=Work.apply(M.emptyWorkspace(),proposal,id,M).workspace;
  assert.strictEqual((await req('PUT','/api/store/workspace',JSON.stringify(created))).status,200);
  const legacy=JSON.parse(JSON.stringify(created));delete legacy.meta.companionReceipts;legacy.tasks[0].notes='Edited by an older client';
  assert.strictEqual((await req('PUT','/api/store/workspace',JSON.stringify(legacy))).status,200);
  const before=(await req('GET','/api/store/workspace')).body;
  assert.deepStrictEqual(JSON.parse(before).meta.companionReceipts,created.meta.companionReceipts);
  const conflict=Work.apply(M.emptyWorkspace(),{...proposal,tasks:[{...proposal.tasks[0],title:'Changed operation'}]},id,M).workspace;
  assert.strictEqual((await req('PUT','/api/store/workspace',JSON.stringify(conflict))).status,500);
  assert.strictEqual((await req('GET','/api/store/workspace')).body,before);
});

test('stale workspace writes cannot discard unseen companion tasks, projects or notes and leave disk unchanged', async () => {
  const Work = require('../public/companion-work'), M = require('../skins/tracer/model');
  const id = 'bbcc9a16-75e1-4379-9201-8539701745b8';
  const oldTab = JSON.parse((await req('GET', '/api/store/workspace')).body);
  const proposal = { type: 'project', project: { name: 'New project', notes: 'Project description', start: null, end: null },
    tasks: [{ title: 'New task', notes: '', due: null, scheduled: null, priority: 'medium', estimate: null, checklist: [] }] };
  const created = Work.apply(oldTab, proposal, id, M);
  assert.strictEqual((await req('PUT', '/api/store/workspace', JSON.stringify(created.workspace))).status, 200);
  const file = path.join(TMP, 'workspace.json'), before = fs.readFileSync(file, 'utf8'), backup = fs.readFileSync(file + '.bak', 'utf8');
  const attempts = [oldTab];
  for (const [collection, recordId] of [['tasks', created.taskIds[0]], ['projects', created.projectId], ['notes', created.noteId]]) {
    const incoming = JSON.parse(JSON.stringify(created.workspace));
    incoming.meta.companionReceipts = incoming.meta.companionReceipts.filter(receipt => receipt.requestId !== id);
    incoming[collection] = incoming[collection].filter(record => record.id !== recordId);
    attempts.push(incoming);
  }
  // A forged deletion marker must not bypass the check by retaining raw records
  // which history preservation would remove before saving.
  const tombstone = JSON.parse(JSON.stringify(created.workspace));
  delete tombstone.meta.companionReceipts;
  tombstone.projectDeletions = [{ id: created.projectId, taskIds: created.taskIds }];
  attempts.push(tombstone);
  for (const [index, incoming] of attempts.entries()) {
    const response = await req(index % 2 ? 'POST' : 'PUT', '/api/store/workspace', JSON.stringify(incoming));
    assert.strictEqual(response.status, 409);
    assert.deepStrictEqual(JSON.parse(response.body), { ok: false, error: 'workspace-stale' });
    assert.strictEqual(fs.readFileSync(file, 'utf8'), before);
    assert.strictEqual(fs.readFileSync(file + '.bak', 'utf8'), backup);
    assert.deepStrictEqual(JSON.parse((await req('GET', '/api/store/workspace')).body), JSON.parse(before));
  }
  // The rejected request must not poison the write queue or block explicit deletion.
  const informed = JSON.parse(before); M.deleteProject(informed, created.projectId);
  assert.strictEqual((await req('PUT', '/api/store/workspace', JSON.stringify(informed))).status, 200);
  const stored = JSON.parse((await req('GET', '/api/store/workspace')).body);
  const retry = Work.apply(stored, proposal, id, M);
  assert.strictEqual(retry.duplicate, true);
  assert.deepStrictEqual(retry.workspace, stored);
  assert.ok(!stored.projects.some(row => row.id === created.projectId));
  assert.ok(!stored.tasks.some(row => created.taskIds.includes(row.id)));
  assert.ok(!stored.notes.some(row => row.id === created.noteId));
});

test('informed clients can delete companion standalone tasks without a retry resurrecting them', async () => {
  const Work = require('../public/companion-work'), M = require('../skins/tracer/model');
  const id = 'ac20127b-72e6-4cf0-8bbe-96804e826f10';
  const proposal = { type: 'tasks', project: null,
    tasks: [{ title: 'Delete explicitly', notes: '', due: null, scheduled: null, priority: 'low', estimate: null, checklist: [] }] };
  const base = JSON.parse((await req('GET', '/api/store/workspace')).body);
  const created = Work.apply(base, proposal, id, M);
  assert.strictEqual((await req('PUT', '/api/store/workspace', JSON.stringify(created.workspace))).status, 200);
  M.deleteTask(created.workspace, created.taskIds[0]);
  assert.strictEqual((await req('POST', '/api/store/workspace', JSON.stringify(created.workspace))).status, 200);
  const stored = JSON.parse((await req('GET', '/api/store/workspace')).body);
  assert.ok(!stored.tasks.some(row => row.id === created.taskIds[0]));
  const retry = Work.apply(stored, proposal, id, M);
  assert.strictEqual(retry.duplicate, true);
  assert.deepStrictEqual(retry.workspace, stored);
  assert.strictEqual((await req('PUT', '/api/store/workspace', JSON.stringify(retry.workspace))).status, 200);
  assert.deepStrictEqual(JSON.parse((await req('GET', '/api/store/workspace')).body), stored);
  // Missing receipts alone are safe once all corresponding records were explicitly removed.
  const legacy = JSON.parse(JSON.stringify(stored)); delete legacy.meta.companionReceipts;
  assert.strictEqual((await req('PUT', '/api/store/workspace', JSON.stringify(legacy))).status, 200);
  assert.deepStrictEqual(JSON.parse((await req('GET', '/api/store/workspace')).body).meta.companionReceipts, stored.meta.companionReceipts);
});
