'use strict';

const path = require('node:path');
const { app, BrowserWindow, Menu, Tray, nativeImage, dialog, systemPreferences } = require('electron');
const { installApplicationMenu, canStartInputHook } = require('./platform-integration');
const { pulseFor } = require('./pulse');
const { migrateUserData } = require('./migrate');

// 皮肤固定为 tracer（农场现在挂在它的 Garden 分区）。必须在 require server.js 之前设，
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
app.setPath('userData', process.env.TRACER_USER_DATA_DIR ? path.resolve(process.env.TRACER_USER_DATA_DIR) : path.join(app.getPath('appData'), 'tracer-desktop'));
const userData = app.getPath('userData');
process.env.DOCS_PORTAL_DATA_DIR = process.env.DOCS_PORTAL_DATA_DIR || path.join(userData, 'data');
process.env.DOCS_PORTAL_STATE_FILE = process.env.DOCS_PORTAL_STATE_FILE || path.join(userData, 'bookmarks.json');
// Audio stays outside app.asar for streaming; the installer includes the local library.
if (app.isPackaged) {
  process.env.DOCS_PORTAL_MUSIC_DIR = process.env.DOCS_PORTAL_MUSIC_DIR || path.join(process.resourcesPath, 'music');
}

// 复用现有的 Node 服务：皮肤页面、小说代理(/r/)、状态存档全靠它。
// 作为模块引入时它不会自己 listen（见 server.js 末尾的 require.main 判断），这里手动起。
const { server, config } = require('../server.js');
require('../lib/ai-gateway').setSecureStorage(require('electron').safeStorage);

let win = null;
let tray = null;
// 只有走了「退出」这条路才真的退。关窗口默认只是缩进托盘，isQuitting 用来区分两者。
let isQuitting = false;

// 把一个脉冲送进渲染进程。两条闸门：
//   1. 窗口不存在就不送；
//   2. 窗口聚焦时不送——此刻页内输入由 farm.js 自己的 DOM 监听在数，
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
    console.error('[farm] Global input hook unavailable; counting only in-app input: ' + e.message);
    return;
  }
  app.on('will-quit', function () { try { uIOhook.stop(); } catch (e) {} });
}

// createWindow + startHook 只该跑一次，无论服务是我们自己起的还是复用了已在运行的实例。
let launched = false;
function launch() {
  if (launched) return;
  launched = true;
  createTray();
  createWindow();
  startHook();
}

function createWindow() {
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
      // 缩进托盘后窗口是隐藏的，别让 Electron 把它的定时器降频——农场靠墙钟结算下雨，
      // 也要保证隐藏时收到的输入脉冲照常记账。
      backgroundThrottling: false,
    },
  });
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
  require('./preferences-import').attachPreferencesImport(win, userData, 'http://' + config.host + ':' + config.port);
  const reference = require('./browser').attachBrowser(win, 'http://' + config.host + ':' + config.port);
  require('./window-controls').attachWindowControls(win, 'http://' + config.host + ':' + config.port, [reference.contents]);
  win.loadURL('http://' + config.host + ':' + config.port + '/');

  // 关闭窗口 = 缩进托盘继续后台计数，不是退出。真正退出走托盘菜单的「退出」。
  win.on('close', function (e) {
    if (isQuitting) return;
    e.preventDefault();
    win.hide();
  });
}

function showWindow() {
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
    { label: '打开面板', click: showWindow },
    { type: 'separator' },
    { label: '退出', click: function () { isQuitting = true; app.quit(); } },
  ]));
  // Windows 上左键单击托盘图标也打开面板（右键才出菜单）。
  if (process.platform !== 'darwin') tray.on('click', showWindow);
}

// 单实例：只允许一个桌面进程在跑。否则第二个进程会再挂一个全局钩子、再建一个托盘，
// 同一次按键被两个进程各记一遍。抢不到锁的直接退出，并把已在跑的那个顶到前台。
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', function () { showWindow(); });
  bootApp();
}

function bootApp() {
  app.whenReady().then(function () {
  // 改名前（podmatrix-desktop）遗留的旧存档搬到新身份（tracer-desktop）的 userData
  // 下面。必须赶在 createWindow() 加载页面之前——页面一加载，farm.js 立刻就去读
  // localStorage 了，到那时候再迁就晚了。纯函数实现见 migrate.js（同 pulse.js 的
  // 理由：脱离 Electron 单测）；这里只负责把 app.getPath 算出的真实路径喂给它。
  // 旧应用名写死是有意的，它对应的是改名前的 package.json name，不会再变。
  var oldUserData = path.join(app.getPath('appData'), 'podmatrix-desktop');
  var migrateResult = process.env.TRACER_USER_DATA_DIR ? { status: 'custom-profile' } : migrateUserData(oldUserData, userData);
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
app.on('before-quit', function () { isQuitting = true; require('../lib/ai-gateway').closeCodex(); });

// 不在关掉最后一个窗口时退出——那正是「缩进托盘后台跑」要的效果。
// 退出只由托盘菜单的「退出」触发。
app.on('window-all-closed', function () {});
