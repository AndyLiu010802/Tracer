'use strict';

// 皮肤无关的通用 JSON 存储，供 server.js 的 /api/store 路由调用。
// 单独拆出来是因为写队列这种并发逻辑值得脱离 HTTP 单独测试。

const fsp = require('node:fs/promises');
const path = require('node:path');

// 同一个 name 的写入必须串行化：早先的实现让所有并发写共用同一个 .tmp 文件名，
// 两个 PUT 交错写入同一个 fd 会把主文件拼成「一份 payload 的头 + 另一份的尾」，
// rename 谁后谁赢，先完成的那个还会撞见 ENOENT。用一条按 name 排队的 Promise
// 链保证同名写入互不重叠；tmp 文件名本身也加上 pid + 自增序号，双保险。
// 队列用 Map 记录，每条链跑完自己出队，避免长期占用内存。
const queues = new Map();
let tmpSeq = 0;

async function readStore(dataDir, name) {
  const file = path.join(dataDir, name + '.json');
  let raw;
  let mainExists = true;
  try {
    raw = await fsp.readFile(file, 'utf8');
  } catch {
    mainExists = false;
  }

  if (mainExists) {
    try {
      return JSON.parse(raw);
    } catch (err) {
      // 主文件在但解析不出来——这是真损坏，留个日志方便事后定位，再回退 .bak。
      process.stderr.write('[store] ' + name + '.json 损坏，尝试回退 .bak: ' + err.message + '\n');
    }
  }

  const bakFile = path.join(dataDir, name + '.json.bak');
  let bakRaw;
  let bakExists = true;
  try {
    bakRaw = await fsp.readFile(bakFile, 'utf8');
  } catch {
    bakExists = false;
  }
  if (bakExists) {
    try {
      return JSON.parse(bakRaw);
    } catch {
      // .bak 也解析不出来，继续往下走，跟主文件的坏结果一起判定。
    }
  }

  // 主文件和 .bak 都不存在——货真价实的「从没写过」，这是唯一能返回 null 的情形。
  if (!mainExists && !bakExists) return null;

  // 走到这里说明主文件或 .bak 至少有一个曾经存在过（即曾经写过），
  // 但现在两者都读不出合法数据。这种「坏档」绝不能伪装成「从没写过」的 null 返回——
  // 调用方（server.js 的 GET 分支）一旦把它当空工作区，客户端会拿空数据在下次
  // 保存时把这些可能还救得回来的原始字节覆盖掉。用专门的错误码让上层区分对待。
  const err = new Error('store corrupt: ' + name);
  err.code = 'store-corrupt';
  throw err;
}

// 对外的写入入口：把这次写入接到该 name 的队尾，前一个写完（无论成败）才轮到它。
function writeStore(dataDir, name, text, transform) {
  const key = dataDir + ' ' + name;
  const next = (queues.get(key) || Promise.resolve())
    .catch(() => {}) // 前一个写失败不能连累后一个排不上队
    .then(async () => {
      if (transform) text = JSON.stringify(transform(await readStore(dataDir, name), JSON.parse(text)));
      return writeOnce(dataDir, name, text);
    });
  queues.set(key, next);
  next.catch(() => {}).finally(() => {
    if (queues.get(key) === next) queues.delete(key);
  });
  return next;
}

async function writeOnce(dataDir, name, text) {
  await fsp.mkdir(dataDir, { recursive: true });
  const file = path.join(dataDir, name + '.json');
  const bakFile = file + '.bak';

  // 备份前先验证上一版：只有它是合法 JSON 才覆盖 .bak，
  // 否则一份已经损坏的主文件会在这次保存时把唯一还能用的备份也抹掉。
  // 首次写没有上一版可备份，.bak 要等第二次写起才会出现。
  // 直接把刚读出来、已经验证过的 prev 写进 .bak，而不是再 copyFile 读一次主文件——
  // 校验的是这份内容，备份的就该是这份内容，省一次读也避免两次读之间文件被改的 TOCTOU。
  try {
    const prev = await fsp.readFile(file, 'utf8');
    JSON.parse(prev);
    await fsp.writeFile(bakFile, prev, 'utf8');
  } catch {
    // 上一版不存在或已损坏，两种情况都跳过备份，保留现有 .bak 不动。
  }

  // 临时文件名带上 pid + 自增序号，同名并发写各用各的 fd，不会互相截断；
  // rename 是原子操作，谁的临时文件先 rename 成功谁就是最终版本。
  const tmp = file + '.' + process.pid + '.' + (tmpSeq++) + '.tmp';
  try {
    await fsp.writeFile(tmp, text, 'utf8');
    await fsp.rename(tmp, file);
  } catch (err) {
    // 清理临时文件也可能失败（Windows 上常见 EPERM），但那不是原本要抛出的错误，
    // 不能让清理失败盖掉真正的写盘错误。
    try { await fsp.rm(tmp, { force: true }); } catch {}
    throw err;
  }
}

module.exports = { readStore, writeStore };
