'use strict';

function attachPetGenerationExit(win, { dialog, onStay }) {
  function blocked(event) {
    let choice = 0;
    try {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      choice = dialog.showMessageBoxSync(win, {
        type: 'warning',
        title: 'Tracer · 伙伴生成 / Companion generation',
        message: '伙伴仍在生成或尚未保存。\nA companion is still being generated or has not been saved.',
        detail: '离开可能中断当前动作。已暂存的进度可在下次打开时恢复；如果界面提示暂存失败，请继续留在应用并重试保存。\nLeaving may interrupt the current action. Saved draft progress can be restored next time. If draft storage failed, stay in the app and retry saving.',
        buttons: ['继续留在应用 / Stay', '离开 / Leave'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
    } catch { /* If the native dialog cannot open, keep the unsaved work in place. */ }
    // For this Electron event, preventDefault overrides the renderer's veto and
    // permits unloading. Only an explicit Leave choice should do that.
    if (choice === 1) event.preventDefault();
    else onStay();
  }
  function detach() { win.webContents.removeListener('will-prevent-unload', blocked); }
  win.webContents.on('will-prevent-unload', blocked);
  win.once('closed', detach);
  return detach;
}

module.exports = { attachPetGenerationExit };
