'use strict';

const test = require('node:test');
const assert = require('node:assert');
const e = require('../lib/encoding.js');

// GB18030 是 GBK/GB2312 的超集，用它统一解码这三者是安全的。
function gbkBytes(str) {
  // Node 没有内置 GBK 编码器，只有解码器。用一小段已知字节做固定样本：
  // "第一章" 的 GBK 编码
  const known = { '第一章': Buffer.from([0xB5, 0xDA, 0xD2, 0xBB, 0xD5, 0xC2]) };
  if (!known[str]) throw new Error('no sample for ' + str);
  return known[str];
}

test('charsetFromContentType 解析并归一化别名', () => {
  assert.strictEqual(e.charsetFromContentType('text/html; charset=UTF-8'), 'utf-8');
  assert.strictEqual(e.charsetFromContentType('text/html; charset=gbk'), 'gb18030');
  assert.strictEqual(e.charsetFromContentType('text/html; charset=GB2312'), 'gb18030');
  assert.strictEqual(e.charsetFromContentType('text/html;charset="big5"'), 'big5');
  assert.strictEqual(e.charsetFromContentType('text/html'), null);
  assert.strictEqual(e.charsetFromContentType(''), null);
  assert.strictEqual(e.charsetFromContentType(null), null);
});

test('charsetFromMeta 支持两种 meta 写法', () => {
  assert.strictEqual(e.charsetFromMeta(Buffer.from('<meta charset="gb2312">')), 'gb18030');
  assert.strictEqual(e.charsetFromMeta(Buffer.from("<meta charset='GBK'>")), 'gb18030');
  assert.strictEqual(e.charsetFromMeta(Buffer.from('<meta charset=utf-8>')), 'utf-8');
  assert.strictEqual(
    e.charsetFromMeta(Buffer.from('<meta http-equiv="Content-Type" content="text/html; charset=gbk">')),
    'gb18030'
  );
  assert.strictEqual(e.charsetFromMeta(Buffer.from('<html><body>no meta</body></html>')), null);
});

test('charsetFromMeta 只扫描文档开头', () => {
  const far = Buffer.from('x'.repeat(5000) + '<meta charset="gbk">');
  assert.strictEqual(e.charsetFromMeta(far), null, '超出 head 区域的声明浏览器也不认');
});

test('isValidUtf8 区分合法 UTF-8 与 GBK 字节', () => {
  assert.strictEqual(e.isValidUtf8(Buffer.from('第一章', 'utf8')), true);
  assert.strictEqual(e.isValidUtf8(Buffer.from('plain ascii')), true);
  assert.strictEqual(e.isValidUtf8(gbkBytes('第一章')), false);
});

test('detectCharset 优先级：响应头 > meta > 字节特征', () => {
  const body = Buffer.from('<meta charset="utf-8">');
  assert.strictEqual(e.detectCharset(body, 'text/html; charset=gbk'), 'gb18030', '响应头应压过 meta');
  assert.strictEqual(e.detectCharset(body, 'text/html'), 'utf-8', '无响应头时用 meta');
  assert.strictEqual(e.detectCharset(gbkBytes('第一章'), 'text/html'), 'gb18030', '无声明时靠字节特征');
  assert.strictEqual(e.detectCharset(Buffer.from('hello'), 'text/html'), 'utf-8');
});

test('decode 把 GBK 正文正确转成 UTF-8 字符串', () => {
  const out = e.decode(gbkBytes('第一章'), 'text/html; charset=gbk');
  assert.strictEqual(out.text, '第一章');
  assert.strictEqual(out.charset, 'gb18030');
});

test('decode 在未知编码时回退到 UTF-8 而非抛错', () => {
  const out = e.decode(Buffer.from('hello'), 'text/html; charset=x-nonexistent-999');
  assert.strictEqual(out.text, 'hello');
  assert.strictEqual(out.charset, 'utf-8', '未知编码归一化后为 null，落到字节特征判定');
});

test('decode 剥掉 UTF-8 BOM', () => {
  const withBom = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('第一章', 'utf8')]);
  assert.strictEqual(e.decode(withBom, 'text/html; charset=utf-8').text, '第一章');
});
