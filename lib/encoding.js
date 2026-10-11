'use strict';

// 字符编码探测与转换。中文小说站大量使用 GBK/GB2312，必须转成 UTF-8
// 才能在伪装页里正常渲染，否则整页乱码，比不加载还显眼。

const ALIASES = new Map([
  ['utf-8', 'utf-8'], ['utf8', 'utf-8'],
  ['gb2312', 'gb18030'], ['gbk', 'gb18030'], ['gb18030', 'gb18030'],
  ['big5', 'big5'], ['big5-hkscs', 'big5'], ['cp950', 'big5'],
  ['shift_jis', 'shift_jis'], ['sjis', 'shift_jis'],
  ['euc-jp', 'euc-jp'], ['euc-kr', 'euc-kr'],
  ['iso-8859-1', 'windows-1252'], ['latin1', 'windows-1252'],
  ['windows-1252', 'windows-1252'],
]);

function normalizeCharset(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase().replace(/^["']|["']$/g, '');
  return ALIASES.get(key) || null;
}

function charsetFromContentType(contentType) {
  if (!contentType) return null;
  const m = /charset\s*=\s*([^;\s]+)/i.exec(contentType);
  return m ? normalizeCharset(m[1]) : null;
}

// meta charset 必须出现在文档前 1024 字节内才对浏览器生效，
// 扫 4KB 留足余量，同时避免整页正则。
function charsetFromMeta(buf) {
  const head = buf.subarray(0, 4096).toString('latin1');
  let m = /<meta[^>]+charset\s*=\s*["']?\s*([a-z0-9_-]+)/i.exec(head);
  if (m) {
    const c = normalizeCharset(m[1]);
    if (c) return c;
  }
  m = /<meta[^>]+http-equiv\s*=\s*["']?content-type["']?[^>]*content\s*=\s*["'][^"']*charset\s*=\s*([a-z0-9_-]+)/i.exec(head);
  return m ? normalizeCharset(m[1]) : null;
}

function isValidUtf8(buf) {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return true;
  } catch {
    return false;
  }
}

// 优先级：响应头 > meta 声明 > 字节特征。
// 站点声明与实际不符的情况存在，但声明优先仍是命中率最高的策略。
function detectCharset(buf, contentType) {
  return charsetFromContentType(contentType)
    || charsetFromMeta(buf)
    || (isValidUtf8(buf) ? 'utf-8' : 'gb18030');
}

function decode(buf, contentType) {
  const charset = detectCharset(buf, contentType);
  try {
    return { text: new TextDecoder(charset).decode(buf), charset };
  } catch {
    return { text: new TextDecoder('utf-8').decode(buf), charset: 'utf-8' };
  }
}

module.exports = { normalizeCharset, charsetFromContentType, charsetFromMeta, isValidUtf8, detectCharset, decode };
