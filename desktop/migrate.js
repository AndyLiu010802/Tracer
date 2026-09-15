'use strict';

const fs = require('node:fs');
const path = require('node:path');

// 桌面壳改名（podmatrix-desktop → tracer-desktop）之前，userData 落在旧名字下面：
// 农场存档（Local Storage 里的 dbconsole.farm.v3）、工作台数据（data/）、书签
// （bookmarks.json）都在那。改名会让 Electron 的 app.getPath('userData') 换到
// 新路径，旧存档就成了孤儿。这个清单是「可能装着用户真实数据」的条目全集。
//
// TODO(迁移代码保留期限)：确认没有还在跑旧版本（podmatrix-desktop）的机器之后，
// 这个文件、main.js 里对它的调用、以及 test/migrate.test.js 都可以一起删掉——
// 新装的用户从一开始就是 tracer-desktop，没有旧目录需要迁。
const ENTRIES = ['Local Storage', 'Session Storage', 'data', 'bookmarks.json'];

// 判断新 userData 是否「已经有存档」：这四项任意一项已经存在，就整体跳过、
// 一个字节都不碰。
//
// 刻意做成「任意一项命中就整体跳过」而不是逐项判断要不要补齐缺的几项——新目录
// 里出现这些路径，不管是上次迁移成功留下的，还是用户在新身份下已经产生的新
// 进度，都不该被旧存档覆盖或"补全"。这个判断必须在任何写操作之前完成，
// 单靠后面 fs.cpSync 的 errorOnExist 兜不住：实测当目标目录已存在但内容不同
// （比如只是缺一个文件）时，cpSync 会把缺的文件合并进去，而不是整体拒绝——
// 那就不是"逐字节不变"了。所以这里的 existsSync 检查才是幂等的唯一保障。
function alreadyMigrated(newDir) {
  return ENTRIES.some(function (name) {
    return fs.existsSync(path.join(newDir, name));
  });
}

/**
 * 把旧 userData 目录（改名前）里的存档条目复制进新 userData 目录（改名后）。
 *
 * 跟 pulse.js 同样的理由做成不碰 Electron 的纯函数：main.js 只管把
 * app.getPath('userData') 算出的新路径、以及旧应用名对应的旧路径喂进来，
 * 这里的逻辑可以脱离 Electron 用 node --test 单测。
 *
 * 语义（详见桌面打包计划 Task 3，任何一条改动前请先确认没有破坏"绝不覆盖"）：
 *   - 新目录已经有任意一项存档 → 直接跳过，绝不覆盖（幂等，最关键的一条）。
 *   - 旧目录整个不存在 → 安静跳过（全新安装的正常路径，不是错误）。
 *   - 否则逐项【复制】（不是移动）存在的条目；旧目录里没有的条目跳过，不报错。
 *     复制不是移动：移动一旦中途失败就两头都没有，复制失败了旧的还在原地。
 *   - 任何一步出错都不抛出——迁移失败绝不能让应用起不来，兜住、打日志、继续，
 *     用户至少还能用，存档也还在旧目录里等人工处理。
 *
 * @param {string} oldDir 改名前的 userData 目录
 * @param {string} newDir 改名后的 userData 目录（app.getPath('userData') 的当前值）
 * @returns {{
 *   status: 'no-old-dir'|'already-migrated'|'ok'|'partial'|'no-entries'|'failed',
 *   migrated: string[],
 *   skipped: {name: string, reason: string}[],
 *   errors: {name: string, message: string}[],
 * }}
 */
function migrateUserData(oldDir, newDir) {
  const result = { status: 'no-entries', migrated: [], skipped: [], errors: [] };

  try {
    if (!fs.existsSync(oldDir)) {
      result.status = 'no-old-dir';
      console.log('[migrate] 旧存档目录不存在（' + oldDir + '），无需迁移（全新安装）。');
      return result;
    }

    if (alreadyMigrated(newDir)) {
      result.status = 'already-migrated';
      console.log('[migrate] 新存档目录（' + newDir + '）已有内容，跳过迁移（幂等，绝不覆盖）。');
      return result;
    }

    fs.mkdirSync(newDir, { recursive: true });

    ENTRIES.forEach(function (name) {
      const src = path.join(oldDir, name);
      const dest = path.join(newDir, name);
      if (!fs.existsSync(src)) {
        result.skipped.push({ name: name, reason: 'not-found' });
        return;
      }
      try {
        // force:false + errorOnExist:true 是双保险：正常情况下走到这里 dest
        // 必然不存在（前面 alreadyMigrated 已经确认过），万一还是撞上了，
        // 宁可这一项报错也不覆盖用户数据。
        fs.cpSync(src, dest, { recursive: true, force: false, errorOnExist: true });
        result.migrated.push(name);
        console.log('[migrate] 已迁移：' + name);
      } catch (e) {
        result.errors.push({ name: name, message: e.message });
        console.error('[migrate] 迁移失败（' + name + '）：' + e.message);
      }
    });

    if (result.errors.length > 0) {
      result.status = 'partial';
    } else if (result.migrated.length > 0) {
      result.status = 'ok';
    } else {
      result.status = 'no-entries';
      console.log('[migrate] 旧目录里没有任何已知存档条目，无事可做。');
    }
    return result;
  } catch (e) {
    result.status = 'failed';
    result.errors.push({ name: '*', message: e.message });
    console.error('[migrate] 存档迁移遇到意外错误，已跳过（应用仍会正常启动）：' + e.message);
    return result;
  }
}

module.exports = { migrateUserData };
