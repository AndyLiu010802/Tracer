'use strict';

const path = require('node:path');
const { app, BrowserWindow, Menu, Tray, nativeImage, dialog, systemPreferences } = require('electron');
const { installApplicationMenu, canStartInputHook } = require('./platform-integration');
const { pulseFor } = require('./pulse');
const { migrateUserData } = require('./migrate');
const { resolveDesktopProfile } = require('./release-profile');

// 默认皮肤为 tracer。必须在 require server.js 之前设，
// 因为 server.js 在模块加载时就读了一次配置。
process.env.DOCS_PORTAL_SKIN = process.env.DOCS_PORTAL_SKIN || 'tracer';
// 桌面版用自己专属的端口，不跟浏览器版（默认 8080）抢——否则你同时开着
// `node server.js` 时，桌面版一起 listen 就会 EADDRINUSE。仍可用 DOCS_PORTAL_PORT 覆盖。
process.env.DOCS_PORTAL_PORT = process.env.DOCS_PORTAL_PORT || '8137';

// 打包后装进 Program Files 的 app.asar，安装目录运行时只读，DATA_DIR/STATE_FILE
// 不能再落在仓库根（server.js 默认值）下，必须指到 app.getPath('userData')。
// 必须在 require server.js 之前设：server.js 在模块加载时就把这两个路径读成
// 常量了（const DATA_DIR = process.env.DOCS_PORTAL_DATA_DIR || ...），require
// 之后再设环境变量对它已经没有意义。实测 app.getPath() 在 app.whenReady() 之前
// 调用即可正常返回路径，不需要等 ready、也不需要为此把 server 的 require 挪到
// whenReady 之后。
// Packaged commercial metadata selects a separate profile before any service loads.
const desktopProfile = resolveDesktopProfile({
  isPackaged: app.isPackaged === true,
  appPath: app.isPackaged === true ? app.getAppPath() : undefined,
  appData: app.getPath('appData'), env: process.env, platform: process.platform,
});
app.setPath('userData', desktopProfile.userData);
const userData = app.getPath('userData');
process.env.DOCS_PORTAL_DATA_DIR = desktopProfile.dataDir;
process.env.DOCS_PORTAL_STATE_FILE = desktopProfile.stateFile;
// Audio stays outside app.asar for streaming; the installer includes the local library.
if (app.isPackaged) {
  process.env.DOCS_PORTAL_MUSIC_DIR = process.env.DOCS_PORTAL_MUSIC_DIR || path.join(process.resourcesPath, 'music');
}

// 复用现有的 Node 服务：皮肤页面、小说代理(/r/)、状态存档全靠它。
// 作为模块引入时它不会自己 listen（见 server.js 末尾的 require.main 判断），这里手动起。
let server, config, accounts;

let win = null;
let tray = null;
let fishing = null;
let fishingAquarium = null;
let receiveInstanceCommand = () => false;
let pendingInstanceArgs = null;
// TRACER_LOCAL_VFX_BEGIN cold_queue
let queueInstanceCommand = () => false;
let initialCommandPending = true;
// Keep the last valid local command while app/server readiness is pending.
// Normal launches and malformed local commands cannot replace queued work.
if (app.isPackaged === false && desktopProfile.channel === 'local' && process.platform === 'win32') {
  const commandModel = require('./local-vfx-shell-model');
  const sourceLaunch = commandModel.fixedSourceLaunch();
  queueInstanceCommand = (argv, secondInstance = false) => {
    const command = commandModel.parseArgv(argv, sourceLaunch, secondInstance);
    if (command === null) return false;
    if (command.kind === 'command') pendingInstanceArgs = [sourceLaunch.executable, sourceLaunch.appPath, commandModel.PREFIX + command.action];
    return true;
  };
  receiveInstanceCommand = queueInstanceCommand;
}
// TRACER_LOCAL_VFX_END cold_queue
// 只有走了「退出」这条路才真的退。关窗口默认只是缩进托盘，isQuitting 用来区分两者。
let isQuitting = false;

// 把一个脉冲送进渲染进程。两条闸门：
//   1. 窗口不存在就不送；
//   2. 窗口聚焦时不送——此刻页内输入由 wellness.js 的 DOM 监听做专注统计，
//      全局钩子只负责补「你切去别的程序时」的那部分，否则同一次按键会被数两遍。
function forward(pulse) {
  if (!pulse || !win || win.isDestroyed()) return;
  if (win.isFocused()) return;
  win.webContents.send('farm-pulse', pulse);
}

let hookStarted = false;
function startHook(prompt = false) {
  if (process.env.TRACER_DISABLE_INPUT_HOOK === '1') return;
  if (hookStarted || !canStartInputHook(process.platform, systemPreferences, prompt)) return;
  let uIOhook;
  try {
    uIOhook = require('uiohook-napi').uIOhook;
  } catch (e) {
    // 没装原生钩子也能跑，只是退化成「只统计窗口内输入」，和网页版一样。
    console.error('[farm] 全局输入钩子加载失败，桌面版仅统计窗口内输入：' + e.message);
    return;
  }
  // 处理器不接收事件参数——键位、坐标从源头就够不到。内容无关是结构上的，不是过滤出来的。
  uIOhook.on('keydown', function () { forward(pulseFor('keydown')); });
  uIOhook.on('mousedown', function () { forward(pulseFor('mousedown')); });
  try { uIOhook.start(); hookStarted = true; }
  catch (e) {
    uIOhook.removeAllListeners('keydown');
    uIOhook.removeAllListeners('mousedown');
    console.error('[farm] 全局输入钩子启动失败，仅统计窗口内输入：' + e.message);
    return;
  }
  app.on('will-quit', function () { try { uIOhook.stop(); } catch (e) {} });
}

// createWindow + startHook 只该跑一次，无论服务是我们自己起的还是复用了已在运行的实例。
let launched = false;
function launch() {
  if (launched || isQuitting) return;
  launched = true;
  createTray();
  createWindow();
  startHook();
}

function createWindow() {
  if (isQuitting) return;
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    fullscreen: true,
    backgroundColor: '#101214',
    title: 'Tracer — Tasks & Focus',
    icon: path.join(__dirname, 'assets', 'app-icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // The preload only forwards anonymous input pulses via postMessage.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // 缩进托盘后窗口是隐藏的，仍需及时结算专注计时，
      // 并让专注期间收到的匿名输入脉冲照常记账。
      backgroundThrottling: false,
    },
  });
  // A renderer can cancel quitting to preserve unsaved work.
  win.webContents.on('will-prevent-unload', () => { isQuitting = false; });
  installApplicationMenu({ platform: process.platform, Menu, showWindow, enableInput: () => startHook(true) });
  win.webContents.setWindowOpenHandler(({ url }) => {
    // OAuth authorization belongs in the user's normal browser, never an embedded login page.
    try {
      if (require('../lib/ai-codex').loginURL(url)) {
        require('electron').shell.openExternal(url).catch(() => {});
        return { action: 'deny' };
      }
    } catch {}
    return { action: 'allow' };
  });
  require('./backup-files').attachBackupFiles(win,'http://' + config.host + ':' + config.port,accounts);
  require('./preferences-import').attachPreferencesImport(win, userData, 'http://' + config.host + ':' + config.port);
  const reference = require('./browser').attachBrowser(win, 'http://' + config.host + ':' + config.port);
  require('./window-controls').attachWindowControls(win, 'http://' + config.host + ':' + config.port, [reference.contents]);
  fishing = require('./fishing').attachFishing(win, 'http://' + config.host + ':' + config.port, userData, showWindow);
  fishingAquarium = require('./fishing-aquarium').attachFishingAquarium(win, 'http://' + config.host + ':' + config.port, userData, showWindow);
  // TRACER_LOCAL_VFX_BEGIN
  if (app.isPackaged === false && desktopProfile.channel === 'local') {
    const localVfx = require('./local-vfx').attachLocalVfx(win, {
      app, profile: desktopProfile, origin: 'http://' + config.host + ':' + config.port, userData,
      // Release opens a one-shot picker; only the subsequent left click selects a point.
      // No cursor or screen-centre fallback and no global input hook.
      getOrigin: () => null, showMain: showWindow, visualsReady: true,
    });
    const localVfxRouter = require('./local-vfx-shell-router').createRouter({
      app, profile: desktopProfile, platform: process.platform,
      launch: require('./local-vfx-shell-model').fixedSourceLaunch(),
      release: () => { localVfx.beginPlacement(); return { ok: true }; },
      cancel: () => { localVfx.cancel(); return { ok: true }; },
      configure: () => localVfx.configure(),
      onResult: result => { if (['local-vfx-assets-pending','local-vfx-disabled','local-vfx-assets-failed','local-vfx-invoke-point-unavailable','local-vfx-placement-unavailable'].includes(result.error)) localVfx.configure(result.error); },
    });
    require('./local-vfx-shell-entry').attachShellMenu(win, {
      app, profile: desktopProfile, platform: process.platform,
      origin: 'http://' + config.host + ':' + config.port, userData,
      ipcMain: require('electron').ipcMain,
    });
    receiveInstanceCommand = (argv, secondInstance = false) => localVfxRouter.receive(argv, secondInstance);
    if (initialCommandPending) {
      initialCommandPending = false;
      localVfxRouter.receive(process.argv);
    }
    if (pendingInstanceArgs) { localVfxRouter.receive(pendingInstanceArgs); pendingInstanceArgs = null; }
    let localRendererLoaded = false;
    win.webContents.once('did-finish-load', () => {
      localRendererLoaded = true;
      if (!isQuitting) localVfxRouter.ready();
    });
    win.webContents.on('will-prevent-unload', () => { if (localRendererLoaded) localVfxRouter.ready(); });
    win.once('closed', () => {
      localVfxRouter.destroy();
      receiveInstanceCommand = (argv, secondInstance = false) => {
        const consumed = queueInstanceCommand(argv, secondInstance);
        if (consumed && pendingInstanceArgs) {
          // A destroyed main already disposed its overlay; cancel must stay silent.
          if (pendingInstanceArgs[2] === '--tracer-local-action=cancel') pendingInstanceArgs = null;
          else createWindow();
        }
        return consumed;
      };
    });
  }
  // TRACER_LOCAL_VFX_END
  win.loadURL('http://' + config.host + ':' + config.port + '/');

  // 关闭窗口 = 缩进托盘继续后台计数，不是退出。真正退出走托盘菜单的「退出」。
  win.on('close', function (e) {
    if (isQuitting) return;
    e.preventDefault();
    win.hide();
  });
}

function showWindow() {
  if (isQuitting) return;
  if (!win || win.isDestroyed()) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createTray() {
  if (tray) return;
  // 托盘图标是琥珀色新月，配 tracer 的「日月轮回」主题（透明底，深浅两种任务栏都验过对比度）。
  // 同目录还有 tray-16.png 备用；换素材时两个尺寸一起换。
  var icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
  if (process.platform === 'darwin') { icon = icon.resize({ width: 18, height: 18 }); icon.setTemplateImage(true); }
  tray = new Tray(icon);
  tray.setToolTip('Tracer');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Tracer / 打开面板', click: showWindow },
    { label: 'Desktop fishing / 桌面钓鱼', click: function () { if (fishing) fishing.show(); } },
    { label: 'Legendary aquarium / 传奇水族箱', click: function () { if (fishingAquarium) fishingAquarium.show(); } },
    { type: 'separator' },
    { label: 'Quit / 退出', click: function () { isQuitting = true; app.quit(); } },
  ]));
  // Windows 上左键单击托盘图标也打开面板（右键才出菜单）。
  if (process.platform !== 'darwin') tray.on('click', showWindow);
}

// 单实例：只允许一个桌面进程在跑。否则第二个进程会再挂一个全局钩子、再建一个托盘，
// 同一次按键被两个进程各记一遍。抢不到锁的直接退出，并把已在跑的那个顶到前台。
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', function (_event, argv) {
    if (isQuitting) return;
    if (!launched) { receiveInstanceCommand(argv, true); return; }
    if (!receiveInstanceCommand(argv, true)) showWindow();
  });
  bootApp();
}

function bootApp() {
  ({ server, config, accounts } = require('../server.js'));
  require('../lib/ai-gateway').setSecureStorage(require('electron').safeStorage);
  app.whenReady().then(function () {
  // 改名前（podmatrix-desktop）遗留的旧存档搬到新身份（tracer-desktop）的 userData
  // 下面。必须赶在 createWindow() 加载页面之前——页面一加载，专注、家园和伙伴便会读
  // localStorage，到那时候再迁就晚了。纯函数实现见 migrate.js（同 pulse.js 的
  // 理由：脱离 Electron 单测）；这里只负责把 app.getPath 算出的真实路径喂给它。
  // 旧应用名写死是有意的，它对应的是改名前的 package.json name，不会再变。
  var oldUserData = path.join(app.getPath('appData'), 'podmatrix-desktop');
  // Commercial profiles never import the local-only companions or their saves.
  var migrateResult = desktopProfile.migrateLegacy ? migrateUserData(oldUserData, userData) : { status: desktopProfile.migrationStatus };
  console.log('[migrate] 存档迁移结果：' + migrateResult.status);

  // 端口占用等错误在这里兜住，别再变成主进程未捕获异常那个弹窗。
  server.once('error', function (err) {
    if (err && err.code === 'EADDRINUSE') {
      // Never load an unrelated service into the desktop app when its port is busy.
      dialog.showErrorBox('Tracer 无法启动 / Unable to start',
        '本地端口 ' + config.port + ' 已被占用，请关闭占用该端口的程序后重试。\nLocal port ' + config.port + ' is already in use. Close the other program and try again.');
      app.quit();
    } else {
      console.error('[farm] 本地服务启动失败：' + (err && err.message));
      app.quit();
    }
  });
  server.listen(config.port, config.host, function () { launch(); });
  app.on('activate', function () {
    if (launched && !isQuitting) { showWindow(); startHook(); }
  });
  });
}

// 任何退出路径（托盘菜单、Cmd/Ctrl+Q、系统关机）都先把标记立起来，
// 免得 close 事件又把窗口拦回托盘。
app.on('before-quit', function () { isQuitting = true; });
// TRACER_LOCAL_VFX_BEGIN quit_queue
app.on('before-quit', function () { pendingInstanceArgs = null; });
// TRACER_LOCAL_VFX_END quit_queue
// A renderer may still cancel quit to preserve its companion draft. Stop the AI
// runtime only after the windows have accepted unloading and quitting proceeds.
app.on('will-quit', function () { if (server) require('../lib/ai-gateway').closeCodex(); });

// 不在关掉最后一个窗口时退出——那正是「缩进托盘后台跑」要的效果。
// 退出只由托盘菜单的「退出」触发。
app.on('window-all-closed', function () {});
