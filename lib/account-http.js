'use strict';
function trusted(req) {
  return /^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i.test(req.headers.host || '') &&
    ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress) &&
    (!req.headers.origin || req.headers.origin === 'http://' + req.headers.host) &&
    (!req.headers['sec-fetch-site'] || ['same-origin','none'].includes(req.headers['sec-fetch-site']));
}
function send(res, status, data, headers = {}) {
  res.writeHead(status, { 'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff', ...headers }); res.end(JSON.stringify(data));
}
function createAccountHttp(provider, { readBody, readonly }) {
  return async function handle(req, res, pathname) {
    if (pathname !== '/account-context.js' && !pathname.startsWith('/api/account/')) return false;
    if (!trusted(req)) { req.resume?.(); send(res,403,{error:'forbidden'}); return true; }
    try {
      const token = provider.tokenFrom(req);
      if (pathname === '/account-context.js') {
        if (req.method !== 'GET') { send(res,405,{error:'method-not-allowed'}); return true; }
        const context = await provider.context(token);
        res.writeHead(200,{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin'});
        // Escape HTML-sensitive characters even though this is a separate JS resource.
        res.end('window.__TRACER_ACCOUNT__='+JSON.stringify(context).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';'); return true;
      }
      if (req.headers['x-tracer-account'] !== '1') { req.resume?.(); send(res,403,{error:'forbidden'}); return true; }
      const action = pathname.slice('/api/account/'.length);
      if (!['session','capabilities'].includes(action)) {
        const context = await provider.context(token);
        if (req.headers['x-tracer-scope'] !== context.scope) { req.resume?.(); send(res,409,{error:'account-changed'}); return true; }
      }
      if (req.method === 'GET') {
        const reads = { session: () => provider.context(token), sessions: () => provider.sessions(token), 'guest-preview': () => provider.guestPreview(token), collection: () => provider.collection(token), export: () => provider.exportData(token), capabilities: () => provider.capabilities };
        if (!reads[action]) send(res,404,{error:'not-found'}); else send(res,200,await reads[action]()); return true;
      }
      if (readonly) { req.resume?.(); send(res,403,{error:'readonly'}); return true; }
      if (req.method !== 'POST' || !String(req.headers['content-type']).startsWith('application/json')) { req.resume?.(); send(res,405,{error:'method-not-allowed'}); return true; }
      const input = JSON.parse(await readBody(req,256*1024));
      if (!input || typeof input !== 'object' || Array.isArray(input)) { send(res,400,{error:'invalid-request'}); return true; }
      const operations = { register: () => provider.register(input,req.headers['user-agent']), login: () => provider.login(input,req.headers['user-agent']), logout: () => provider.logout(token), profile: () => provider.updateProfile(token,input), password: () => provider.changePassword(token,input,req.headers['user-agent']), recover: () => provider.recover(input), 'recovery-code': () => provider.rotateRecovery(token,input), 'revoke-session': () => provider.revoke(token,input.id), 'import-guest': () => provider.importGuest(token), 'wallpaper-purchase': () => provider.purchaseWallpaper(token,input), 'wallpaper-equip': () => provider.equipWallpaper(token,input) };
      if (!operations[action]) { send(res,404,{error:'not-found'}); return true; }
      const result = await operations[action](), headers = {};
      if (result.token) { headers['set-cookie'] = provider.cookie(result.token); delete result.token; }
      else if (action === 'logout' || result.signedOut) headers['set-cookie'] = provider.cookie('');
      send(res,200,result,headers);
    } catch (error) { send(res,error.code === 'too-large' ? 413 : error.status || (error instanceof SyntaxError ? 400 : 503),{error:error.code === 'too-large' ? 'request-too-large' : error.status ? error.code : error instanceof SyntaxError ? 'invalid-request' : 'account-storage-unavailable'}); }
    return true;
  };
}
module.exports = { createAccountHttp, trusted, send };
