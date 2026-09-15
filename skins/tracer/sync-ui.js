(function () {
  'use strict';
  var T = window.Tracer, M = window.TracerModel, S = window.WorkspaceSync;
  var I = window.TracerLocale, L = I.t;
  var button = document.getElementById('cloud-sync-btn');
  var connection = { connected: false };
  function request(path, input) {
    return fetch('/api/sync/' + path, input ? { method: 'POST', headers: { 'content-type': 'application/json', 'x-tracer-sync': '1' }, body: JSON.stringify(input) } : {})
      .then(function (r) { return r.json().then(function (body) { if (!r.ok || body.ok === false) throw new Error(body.error || '连接失败'); return body; }); });
  }
  T.refreshSyncLabel = function () {
    button.textContent = L(T.store.conflict ? 'conflictButton' : T.store.dirty && connection.connected ? 'pendingButton' : connection.connected ? 'connected' : 'syncButton');
  };
  request('status').then(function (s) { connection = s; T.refreshSyncLabel(); }).catch(function () {});
  function conflicts() {
    T.ui.modal(function (box, close) {
      var list = S.merge(T.store.base, T.store.data, T.store.conflict).conflicts;
      box.innerHTML = '<h2>' + L('conflictTitle') + '</h2><p>' + L('conflictHelp') + '</p>'
        + list.map(function (c, i) { return '<div class="sync-conflict"><b>' + M.esc(c.title) + '</b><label>' + M.esc(L(c.field)) + '</label><pre>' + L('desktop') + ': ' + M.esc(c.local === undefined ? L('deleted') : JSON.stringify(c.local)) + '\n' + L('cloud') + ': ' + M.esc(c.remote === undefined ? L('deleted') : JSON.stringify(c.remote)) + '</pre><select data-choice="' + i + '"><option value="">' + L('choose') + '</option><option value="local">' + L('keepDesktop') + '</option><option value="remote">' + L('keepCloud') + '</option></select></div>'; }).join('')
        + '<div class="modal-actions"><button class="btn" id="sync-later">' + L('later') + '</button><button class="btn btn-primary" id="sync-resolve">' + L('mergeSave') + '</button></div>';
      box.querySelector('#sync-later').onclick = close;
      box.querySelector('#sync-resolve').onclick = function () {
        var choices = {}, complete = true;
        box.querySelectorAll('[data-choice]').forEach(function (el) { if (!el.value) complete = false; else choices[list[+el.dataset.choice].key] = el.value; });
        if (!complete) return;
        if (T.resolveCloud(choices)) { close(); T.refreshSyncLabel(); }
      };
    });
  }
  button.onclick = function () {
    if (T.store.conflict) { conflicts(); return; }
    T.ui.modal(function (box, close) {
      box.innerHTML = '<h2>' + L('syncTitle') + '</h2>' + (connection.connected
        ? '<p>' + L('connectedHelp') + '</p><p>' + L('disconnectHelp') + '</p><div class="modal-actions"><button class="btn" id="sync-disconnect">' + L('disconnect') + '</button><button class="btn btn-primary" id="sync-now">' + L('syncNow') + '</button></div>'
        : '<p>' + L('pairHelp') + '</p><label for="sync-endpoint">' + L('endpoint') + '</label><input type="text" id="sync-endpoint" placeholder="' + L('endpointHint') + '"><label for="sync-code">' + L('pairCode') + '</label><input type="text" id="sync-code" autocomplete="off" spellcheck="false"><p>' + L('importHelp') + '</p><div class="modal-actions"><button class="btn" id="sync-cancel">' + L('cancel') + '</button><button class="btn btn-primary" id="sync-pair">' + L('pairAndMerge') + '</button></div>')
        + '<p id="sync-error" role="status"></p>';
      function error(e) { box.querySelector('#sync-error').textContent = I.message(e.message); }
      if (connection.connected) {
        box.querySelector('#sync-now').onclick = function () { close(); if (T.store.lost) location.reload(); else if (T.store.dirty) T.saveNow(); else T.refreshCloud(); };
        box.querySelector('#sync-disconnect').onclick = function () {
          if (T.store.dirty || T.store.inflight) { error(new Error('请先同步未保存的改动，再断开连接')); return; }
          request('disconnect', {}).then(function () { location.reload(); }).catch(error);
        };
      } else {
        box.querySelector('#sync-cancel').onclick = close;
        box.querySelector('#sync-pair').onclick = function () {
          if (T.store.inflight || T.store.dirty || !T.store.data) { error(new Error('请先等本机任务保存完成')); return; }
          var btn = this; btn.disabled = true;
          request('pair', { endpoint: box.querySelector('#sync-endpoint').value.trim(), code: box.querySelector('#sync-code').value.trim() }).then(function (result) {
            connection.connected = true; close(); T.importCloud(result.workspace); T.refreshSyncLabel(); if (T.store.conflict) conflicts();
          }).catch(function (e) { btn.disabled = false; error(e); });
        };
      }
    });
  };
})();
