const I = require('./task-i18n');
function language() {
  const saved = wx.getStorageSync('tracer-language');
  if (saved === 'en' || saved === 'zh') return saved;
  return 'zh';
}
function apply() {
  wx.setTabBarItem({ index: 0, text: t('tasks') });
  wx.setTabBarItem({ index: 1, text: t('syncDevices') });
}
function set(lang) { wx.setStorageSync('tracer-language', lang === 'en' ? 'en' : 'zh'); apply(); }
function t(key, values) { return I.t(language(), key, values); }
module.exports = { language, set, apply, strings: () => I.strings(language()), t, message: text => I.message(language(), text) };
