'use strict';
const { WebContentsView, ipcMain, session, dialog, shell, Menu, clipboard } = require('electron');
const { webURL, bounds } = require('./browser-policy');

// Remote sites get a real top-level Chromium document, a separate cookie jar,
// and no preload or Node bridge. The app's controls alone may send commands.
function attachBrowser(win, appOrigin) {
  const partition = 'persist:tracer-browser';
  const browserSession = session.fromPartition(partition);
  const webPreferences = { partition, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, plugins: true };
  const view = new WebContentsView({ webPreferences });
  const contents = view.webContents;
  view.setBackgroundColor('#101214');
  win.contentView.addChildView(view);
  view.setVisible(false);
  const popups = new Set();
  let requestedVisible = false, failed = false, currentURL = '', latestBounds = null, lastError = '';
  const permissions = new Set();

  function trusted(event) {
    return event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame
      && event.senderFrame.url.startsWith(appOrigin + '/') && !event.senderFrame.url.startsWith(appOrigin + '/r/');
  }
  function visibility() { if (!contents.isDestroyed()) view.setVisible(requestedVisible && !failed && !!currentURL); }
  function report(extra = {}) {
    if (win.isDestroyed() || contents.isDestroyed()) return;
    win.webContents.send('tracer-browser-state', {
      url: currentURL, title: contents.getTitle(), loading: contents.isLoading(),
      back: contents.navigationHistory.canGoBack(), forward: contents.navigationHistory.canGoForward(),
      visible: view.getVisible(), error: failed ? lastError : '', ...extra,
    });
  }
  function navigate(raw) {
    const url = webURL(raw);
    if (!url) { report({ error: '仅支持有效的 http / https 网址。 Enter a valid HTTP(S) address.' }); return; }
    currentURL = url; failed = false; lastError = ''; visibility(); report({ error: '' });
    contents.loadURL(url).catch(() => {}); // did-fail-load renders a recoverable error in the app.
  }
  function secureContents(wc) {
    wc.setWindowOpenHandler(({ url }) => {
      if (url !== 'about:blank' && !webURL(url)) return { action: 'deny' };
      return { action: 'allow', overrideBrowserWindowOptions: {
        width: 1000, height: 760, parent: win, autoHideMenuBar: true, webPreferences,
      } };
    });
    wc.on('will-navigate', (event, url) => { if (!webURL(url)) event.preventDefault(); });
    wc.on('will-redirect', (event, url) => { if (!webURL(url)) event.preventDefault(); });
    wc.on('did-create-window', child => {
      popups.add(child); child.on('closed', () => popups.delete(child));
      secureContents(child.webContents);
      child.webContents.on('did-navigate', (_event, url) => child.setTitle(new URL(url).host + ' — Tracer Browser'));
    });
    wc.on('context-menu', (_event, params) => {
      const menu = [];
      if (webURL(params.linkURL)) {
        menu.push({ label: '在参考面板打开 / Open here', click: () => navigate(params.linkURL) });
        menu.push({ label: '用系统浏览器打开 / Open in browser', click: () => shell.openExternal(webURL(params.linkURL)) });
        menu.push({ label: '复制链接 / Copy link', click: () => clipboard.writeText(params.linkURL) });
      }
      if (params.isEditable) menu.push({ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' });
      else if (params.selectionText) menu.push({ role: 'copy' });
      menu.push({ type: 'separator' }, { label: '后退 / Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
        { label: '前进 / Forward', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
        { label: '刷新 / Reload', click: () => wc.reload() });
      Menu.buildFromTemplate(menu).popup();
    });
  }
  secureContents(contents);
  // Keep the genuine Chromium version, without the product-specific UA tokens
  // that some sites incorrectly reject before checking browser capabilities.
  browserSession.setUserAgent(browserSession.getUserAgent().replace(/\s(?:Electron|tracer-desktop|Tracer)\/\S+/g, ''));
  browserSession.setPermissionCheckHandler((_wc, permission, origin) => permissions.has(origin + ':' + permission));
  browserSession.setPermissionRequestHandler(async (wc, permission, callback, details) => {
    if (!wc || !webURL(wc.getURL())) { callback(false); return; }
    const origin = details.requestingUrl ? new URL(details.requestingUrl).origin : new URL(wc.getURL()).origin;
    if (!['media', 'geolocation', 'notifications', 'fullscreen', 'clipboard-sanitized-write'].includes(permission)) { callback(false); return; }
    if (permission === 'fullscreen' || permission === 'clipboard-sanitized-write') { callback(true); return; }
    const key = origin + ':' + permission;
    if (permissions.has(key)) { callback(true); return; }
    const result = await dialog.showMessageBox(win, { type: 'question', title: '网站权限 / Website permission',
      message: origin + '\n请求权限 / Requests permission: ' + permission,
      buttons: ['拒绝 / Deny', '允许本次运行 / Allow this session'], defaultId: 0, cancelId: 0 });
    if (result.response === 1) permissions.add(key);
    callback(result.response === 1);
  });
  function download(_event, item) {
    report({ download: '正在下载 / Downloading: ' + item.getFilename() });
    item.once('done', (_e, state) => report({ download: (state === 'completed' ? '下载完成 / Downloaded: ' : '下载未完成 / Download interrupted: ') + item.getFilename() }));
  }
  browserSession.on('will-download', download);
  contents.on('did-start-navigation', (_e, url, inPlace, mainFrame) => {
    if (mainFrame && !inPlace && webURL(url)) { currentURL = url; failed = false; visibility(); report({ error: '' }); }
  });
  contents.on('did-navigate', (_e, url) => { if (webURL(url)) { currentURL = url; report(); } });
  contents.on('did-navigate-in-page', (_e, url, mainFrame) => { if (mainFrame) { currentURL = url; report(); } });
  contents.on('did-start-loading', () => report());
  contents.on('did-stop-loading', () => report());
  contents.on('page-title-updated', () => report());
  contents.on('did-fail-load', (_e, code, description, url, mainFrame) => {
    if (!mainFrame || code === -3) return;
    currentURL = url || currentURL; failed = true; lastError = description + ' (' + code + ')'; visibility(); report({ loading: false });
  });
  contents.on('render-process-gone', (_e, details) => { failed = true; lastError = details.reason; visibility(); report({ loading: false }); });
  // 阅读窗口的匿名输入交给主页面专注统计；farm-pulse 保留为兼容协议名。
  contents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown') win.webContents.send('farm-pulse', { kind: 'key' });
    if ((input.control || input.meta) && input.key.toLowerCase() === 'l') {
      _event.preventDefault(); win.webContents.focus(); win.webContents.send('tracer-browser-state', { focusAddress: true });
    }
  });
  contents.on('before-mouse-event', (_event, mouse) => {
    if (mouse.type === 'mouseDown') win.webContents.send('farm-pulse', { kind: 'click' });
  });
  function command(event, message) {
    if (!trusted(event) || !message || typeof message !== 'object') return;
    if (message.action === 'layout') {
      latestBounds = message.bounds;
      const rect = bounds(latestBounds, win.webContents.getZoomFactor(), win.getContentSize());
      requestedVisible = !!message.visible && !!rect && rect.width > 4 && rect.height > 4;
      if (rect) view.setBounds(rect);
      visibility(); report();
    } else if (message.action === 'navigate') navigate(message.url);
    else if (message.action === 'back' && contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack();
    else if (message.action === 'forward' && contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward();
    else if (message.action === 'reload') { failed = false; visibility(); contents.reload(); }
    else if (message.action === 'external') { const url = webURL(currentURL || message.url); if (url) shell.openExternal(url).catch(() => report({ error: '无法打开系统浏览器 / Could not open system browser' })); }
  }
  ipcMain.on('tracer-browser-command', command);
  // Initialize the renderer even before the first address is entered.
  contents.loadURL('about:blank').catch(() => {});
  win.on('closed', () => {
    ipcMain.removeListener('tracer-browser-command', command);
    browserSession.removeListener('will-download', download);
    for (const popup of popups) if (!popup.isDestroyed()) popup.destroy();
    if (!contents.isDestroyed()) contents.close();
  });
  return { contents, view };
}
module.exports = { attachBrowser };
