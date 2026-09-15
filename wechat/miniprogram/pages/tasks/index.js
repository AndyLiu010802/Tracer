const store = require('../../lib/store');
const M = store.model;
const I = require('../../lib/i18n');
Page({
  data: { tasks: [], query: '', status: 'all', high: false, overdue: false, projectIndex: 0, projects: [], projectNames: ['全部项目'], count: 0, error: '', loading: false, demo: false, pending: false,
    statuses: [{ key: 'all', label: '全部' }, { key: 'todo', label: '待办' }, { key: 'doing', label: '进行中' }, { key: 'review', label: '待验收' }, { key: 'done', label: '已完成' }] },
  onShow() { this.translate(); this.refresh(); this.timer = setInterval(() => this.refresh(true), 15000); },
  translate() { I.apply(); wx.setNavigationBarTitle({ title: 'Tracer · ' + I.t('tasks') }); this.setData({ L: I.strings(), lang: I.language(), statuses: ['all', 'todo', 'doing', 'review', 'done'].map(key => ({ key, label: I.t(key) })) }); this.render(); },
  language(e) { I.set(e.currentTarget.dataset.lang); this.translate(); },
  onHide() { clearInterval(this.timer); },
  onUnload() { clearInterval(this.timer); },
  async onPullDownRefresh() { try { await this.refresh(); } finally { wx.stopPullDownRefresh(); } },
  async refresh(quiet) {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try { await store.load(); this.setData({ error: '' }); this.render(); }
    catch (e) { this.setData({ error: I.message(e.message || '无法连接云端，请检查网络') }); }
    finally { this.setData({ loading: false }); }
  },
  render() {
    const state = store.snapshot(); if (!state.data) return;
    const ws = state.data, projects = ws.projects;
    const projectIndex = Math.min(this.data.projectIndex, projects.length);
    const ts = M.filterTasks(ws, { query: this.data.query, projectId: projectIndex ? projects[projectIndex - 1].id : null, due: this.data.overdue ? 'overdue' : '' })
      .filter(t => !this.data.high || t.priority === 'high' || t.priority === 'urgent')
      .filter(t => this.data.status === 'all' || t.status === this.data.status)
      .map(t => ({ ...t, priorityLabel: t.priority ? I.t(t.priority) : '', checklistLabel: (t.checklist || []).length ? I.t('checklistProgress', { done: t.checklist.filter(c => c.done).length, total: t.checklist.length }) : '', blockersLabel: M.blockers(ws, t).length ? I.t('blocked', { count: M.blockers(ws, t).length }) : '', statusLabel: this.data.statuses.find(s => s.key === t.status).label, projectName: (projects.find(p => p.id === t.projectId) || {}).name || '', overdue: M.taskDueState(t) === 'overdue' }));
    const count = ws.tasks.filter(t => t.status !== 'done').length;
    this.setData({ tasks: ts, count, countLabel: I.t('openCount', { count }), resultsLabel: I.t('results', { count: ts.length }), projects, projectNames: [I.t('allProjects')].concat(projects.map(p => p.name)), projectIndex, demo: state.demo, pending: state.dirty });
  },
  search(e) { this.setData({ query: e.detail.value }); this.render(); },
  status(e) { this.setData({ status: e.currentTarget.dataset.key }); this.render(); },
  project(e) { this.setData({ projectIndex: +e.detail.value }); this.render(); },
  high() { this.setData({ high: !this.data.high }); this.render(); },
  overdue() { this.setData({ overdue: !this.data.overdue }); this.render(); },
  edit(e) { wx.navigateTo({ url: '/pages/edit/index?id=' + e.currentTarget.dataset.id }); },
  add() { const p = this.data.projectIndex ? this.data.projects[this.data.projectIndex - 1].id : ''; wx.navigateTo({ url: '/pages/edit/index?project=' + p }); },
  async newProject() {
    const result = await wx.showModal({ title: I.t('newProject'), editable: true, placeholderText: I.t('projectName'), confirmText: I.t('create'), cancelText: I.t('cancel') });
    if (!result.confirm || !result.content.trim()) return;
    try { await store.mutate(ws => M.addProject(ws, { name: result.content })); this.render(); }
    catch (e) { this.setData({ error: I.message(e.message) }); this.render(); }
  },
});
