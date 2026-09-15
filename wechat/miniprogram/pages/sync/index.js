const store = require('../../lib/store');
const I = require('../../lib/i18n');
Page({
  data: { demo: false, error: '', devices: [], code: '', expires: '', busy: false, pending: false, conflicts: [], choiceLabels: ['请选择', '保留手机', '保留云端'] },
  onShow() { this.translate(); this.refresh(); },
  translate() { I.apply(); wx.setNavigationBarTitle({ title: I.t('syncDevices') }); this.setData({ L: I.strings(), lang: I.language(), choiceLabels: [I.t('choose'), I.t('keepPhone'), I.t('keepCloud')], error: I.message(this.data.error), expires: this.expiresAt ? I.t('expires', { time: new Date(this.expiresAt).toLocaleTimeString() }) : '' }); },
  language(e) { I.set(e.currentTarget.dataset.lang); this.translate(); this.refresh(); },
  async refresh() {
    try {
      await store.load(); const state = store.snapshot();
      this.setData({ demo: state.demo, pending: state.dirty, conflicts: store.getConflicts().map(c => ({ ...c, fieldLabel: I.t(c.field), localText: c.local === undefined ? I.t('deleted') : JSON.stringify(c.local), remoteText: c.remote === undefined ? I.t('deleted') : JSON.stringify(c.remote), selected: 0 })) });
      if (!state.demo) { const r = await store.api('devices'); if (!r.ok) throw new Error(r.error); this.setData({ devices: r.devices.map(d => ({ ...d, dateLabel: I.t('boundOn', { date: new Date(d.createdAt).toLocaleDateString() }) })) }); }
    } catch (e) { this.setData({ error: I.message(e.message) }); }
  },
  async generate() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try { const r = await store.api('pairCode'); if (!r.ok) throw new Error(r.error); this.expiresAt = r.expiresAt; this.setData({ code: r.code, expires: I.t('expires', { time: new Date(r.expiresAt).toLocaleTimeString() }) }); }
    catch (e) { this.setData({ error: I.message(e.message) }); } finally { this.setData({ busy: false }); }
  },
  copy() { if (this.data.code) wx.setClipboardData({ data: this.data.code }); },
  async revoke(e) {
    const result = await wx.showModal({ title: I.t('revokeTitle'), content: I.t('revokeWarning'), confirmText: I.t('confirm'), cancelText: I.t('cancel') });
    if (!result.confirm) return;
    try { const r = await store.api('revoke', { id: e.currentTarget.dataset.id }); if (!r.ok) throw new Error(r.error); await this.refresh(); }
    catch (error) { this.setData({ error: I.message(error.message) }); }
  },
  choose(e) { this.setData({ ['conflicts[' + e.currentTarget.dataset.index + '].selected']: +e.detail.value }); },
  async retry() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '' });
    try {
      if (this.data.conflicts.length) {
        const choices = {}; this.data.conflicts.forEach(c => { if (c.selected) choices[c.key] = c.selected === 1 ? 'local' : 'remote'; });
        await store.resolve(choices);
      } else await store.flush();
      await this.refresh(); wx.showToast({ title: I.t('saved') });
    } catch (e) { this.setData({ error: I.message(e.message) }); await this.refresh(); }
    finally { this.setData({ busy: false }); }
  },
});
