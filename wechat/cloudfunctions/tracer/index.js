'use strict';
const cloud = require('wx-server-sdk');
const { createService } = require('./core');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const service = createService({
  transaction: callback => db.runTransaction(async transaction => callback({
    async get(collection, id) {
      const result = await transaction.collection(collection).doc(id).get();
      const data = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!data) return null;
      const { _id, ...value } = data;
      return value;
    },
    async set(collection, id, value) { await transaction.collection(collection).doc(id).set({ data: value }); },
  })),
});

exports.main = async (event, context) => {
  const http = !!(event && event.httpMethod);
  try {
    let input = event, identity;
    if (http) {
      if (event.httpMethod !== 'POST') return response({ ok: false, status: 405, error: '仅支持 POST' });
      const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
      const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body;
      if (typeof raw !== 'string' || Buffer.byteLength(raw) > 600 * 1024) return response({ ok: false, status: 413, error: '请求过大' });
      input = JSON.parse(raw);
      identity = { token: String(headers.authorization || '').replace(/^Bearer\s+/i, '') };
    } else {
      const wx = cloud.getWXContext();
      identity = { openid: wx.OPENID, appid: wx.APPID };
    }
    const result = await service(input, identity);
    return http ? response(result) : result;
  } catch (err) {
    // Do not log request payloads, pairing codes, task text or authorization tokens.
    const result = { ok: false, status: err instanceof SyntaxError ? 400 : 503, error: '服务暂时不可用，请稍后重试' };
    return http ? response(result) : result;
  }
};
function response(result) {
  return { statusCode: result.status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: JSON.stringify(result) };
}
