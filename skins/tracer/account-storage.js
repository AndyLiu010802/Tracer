(function () {
  'use strict';
  const context = window.__TRACER_ACCOUNT__ || { scope: 'locked', user: null, capabilities: { mode:'local' } };
  const scope = context.scope, raw = window.localStorage, nativeFetch = window.fetch.bind(window), signalKey = 'tracer.account.signal';
  const prefix = scope === 'guest' ? '' : 'tracer.account.' + scope + '.';
  let locked = scope === 'locked', announced = false, switching = false;
  const storageName = key => prefix + String(key);
  function keys() { const found = []; for (let i=0;i<raw.length;i++) { const key = raw.key(i); if (prefix ? key.startsWith(prefix) : !key.startsWith('tracer.account.')) found.push(prefix ? key.slice(prefix.length) : key); } return found; }
  const storage = { getItem(key) { return raw.getItem(storageName(key)); }, setItem(key,value) { raw.setItem(storageName(key),String(value)); }, removeItem(key) { raw.removeItem(storageName(key)); }, key(index) { return keys()[index] ?? null; }, clear() { keys().forEach(key => raw.removeItem(storageName(key))); }, get length() { return keys().length; } };
  // Modules and their injected storage adapters all see the same scoped facade.
  Object.defineProperty(window,'localStorage',{configurable:true,value:storage});
  function blocked() {
    locked = true;
    if (window.Tracer?.store) { window.Tracer.store.lost = true; clearTimeout(window.Tracer.store.timer); }
    if (announced || !document.body) return; announced = true;
    const layer=document.createElement('div');layer.id='account-session-lock';layer.setAttribute('role','alertdialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-labelledby','account-lock-heading');
    layer.innerHTML='<section><span class="account-eyebrow">TRACER ACCOUNT</span><h2 id="account-lock-heading">账户状态已改变</h2><p>请重新打开工作空间。当前窗口已停止保存，本机草稿仍保留在原账户中。</p><button type="button">重新打开 / Reopen</button></section>';
    // Lock all existing views, including dialogs; keep the recovery action usable.
    document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
    Array.from(document.body.children).forEach(el=>{ if(el.tagName!=='SCRIPT')el.inert=true; });document.body.append(layer);layer.querySelector('button').onclick=async()=>{
      try { const r=await nativeFetch('/api/account/session',{headers:{'x-tracer-account':'1'}});const next=await r.json();if(next.scope==='locked'){const cleared=await nativeFetch('/api/account/logout',{method:'POST',headers:{'x-tracer-account':'1','x-tracer-scope':'locked','content-type':'application/json'},body:'{}'});if(!cleared.ok)throw new Error('retry');}location.reload(); }catch{layer.querySelector('p').textContent='暂时无法读取账户，请稍后重试。 / Please try again.';}
    };layer.querySelector('button').focus();
    window.TracerPet?.send({type:'account-lock'});
  }
  function requestURL(input) { try { return new URL(typeof input === 'string' || input instanceof URL ? input : input.url,location.href); } catch { return null; } }
  function scoped(url) { return url && url.origin === location.origin && /^\/api\/(store\/|ai\/|pet-package\/|pet-art\/|state$)/.test(url.pathname); }
  window.fetch = async function(input,options) {
    const url=requestURL(input);
    if (!scoped(url)) return nativeFetch(input,options);
    if(locked || switching) return new Response(JSON.stringify({error:'account-changed'}),{status:409,headers:{'content-type':'application/json'}});
    url.searchParams.set('__tracer_account',scope);
    const request=input instanceof Request ? new Request(url,input) : url.href;
    const response=await nativeFetch(request,options);
    if(response.status===401||response.status===409) { try { const error=await response.clone().json(); if(error.error==='account-changed')blocked(); }catch{} }
    // A response that began before a switch must not be adopted by an old view.
    if(locked) return new Response(JSON.stringify({error:'account-changed'}),{status:409,headers:{'content-type':'application/json'}});
    return response;
  };
  if (navigator.sendBeacon) {
    const beacon=navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon=function(input,data){const url=requestURL(input);if(scoped(url)){if(locked||switching)return false;url.searchParams.set('__tracer_account',scope);return beacon(url.href,data);}return beacon(input,data);};
  }
  async function check(){if(locked||switching)return;try{const r=await nativeFetch('/api/account/session',{headers:{'x-tracer-account':'1'},cache:'no-store'});if(r.ok){const next=await r.json();if(next.scope!==scope)blocked();}}catch{}}
  window.addEventListener('storage',event=>{
    if(event.key===signalKey){check();event.stopImmediatePropagation();return;}
    if(event.storageArea!==raw)return;
    if(event.key===null){event.stopImmediatePropagation();return;}
    if(prefix ? !event.key.startsWith(prefix) : event.key.startsWith('tracer.account.')){event.stopImmediatePropagation();return;}
    if(prefix)Object.defineProperty(event,'key',{value:event.key.slice(prefix.length)});
    Object.defineProperty(event,'storageArea',{value:storage});
  },true);
  window.TracerAccount={ scope, context, storageName, storage, get locked(){return locked;}, get switching(){return switching;}, lock:blocked,
    suspend(){switching=true;window.TracerPet?.send({type:'account-lock'});},resume(){switching=false;window.TracerPet?.send({type:'account-unlock'});},
    seedLanguage(id,language){if(/^[a-f0-9-]{36}$/.test(id)&&['en','zh'].includes(language)){const key='tracer.account.'+id+'.tracer.language';if(raw.getItem(key)===null)raw.setItem(key,language);}},
    signal(){raw.setItem(signalKey,Date.now()+':'+Math.random());},
    async api(action,data){const r=await nativeFetch('/api/account/'+action,{method:data===undefined?'GET':'POST',headers:{'x-tracer-account':'1','x-tracer-scope':scope,...(data===undefined?{}:{'content-type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});const result=await r.json();if(!r.ok){if(result.error==='account-changed')blocked();throw Object.assign(new Error(result.error||'request-failed'),{status:r.status});}return result;},
    exportPreferences(){return Object.fromEntries(keys().filter(key=>key.startsWith('tracer.')&&!/Draft|draft|Chat|chat|ai\./.test(key)).map(key=>[key,storage.getItem(key)]));}
  };
  document.addEventListener('tracer-visibilitychange',()=>{if(!(document.hidden || document.tracerHidden))check();});
  setInterval(()=>{if(!(document.hidden || document.tracerHidden))check();},10000);
  document.addEventListener('DOMContentLoaded',()=>{if(locked)blocked();});
})();
