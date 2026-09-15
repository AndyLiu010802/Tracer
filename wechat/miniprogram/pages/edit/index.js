const store = require('../../lib/store');
const M = store.model;
const I = require('../../lib/i18n');
Page({
  data: { id: '', title: '', notes: '', statusIndex: 0, statuses: ['待办', '进行中', '待验收', '已完成'], projectIndex: 0, projects: [], projectNames: ['无项目'], priorityIndex: 0, typeIndex: 0, assignee: '', labelsText: '', estimate: '', spent: '', acceptance: '', linksText: '', checklist: [], checkNew: '', dependencies: [], dependsOn: [], scheduled: '', due: '', saving: false, error: '' },
  async onLoad(options) {
    this.setData({ L: I.strings(), statuses: M.STATUSES.map(k => I.t(k)), priorities: M.PRIORITIES.map(k => I.t(k || 'noPriority')), types: M.TASK_TYPES.map(k => I.t(k)) });
    try {
      await store.load(); const state = store.snapshot();
      const task = options.id ? M.findTask(state.data, options.id) : null;
      if (options.id && !task) throw new Error('任务已在另一端删除，请返回刷新');
      this.setData({ id: options.id || '', title: task ? task.title : '', notes: task ? task.notes : '',
        statusIndex: task ? M.STATUSES.indexOf(task.status) : 0, priorityIndex: task ? Math.max(0, M.PRIORITIES.indexOf(task.priority || '')) : 0, typeIndex: task ? Math.max(0, M.TASK_TYPES.indexOf(task.type || 'task')) : 0,
        assignee: task && task.assignee || '', labelsText: task && (task.labels || []).join(', ') || '', estimate: task && task.estimate != null ? String(task.estimate) : '', spent: task && task.spent != null ? String(task.spent) : '',
        acceptance: task && task.acceptance || '', linksText: task && (task.links || []).join('\n') || '', checklist: task && task.checklist || [], dependsOn: task && task.dependsOn || [],
        dependencies: state.data.tasks.filter(t => t.id !== options.id).map(t => ({ id: t.id, title: t.title, seq: t.seq, status: I.t(t.status), checked: !!(task && (task.dependsOn || []).includes(t.id)) })),
        scheduled: task && task.scheduled || '', due: task && task.due || '',
        projects: state.data.projects, projectNames: [I.t('noProject')].concat(state.data.projects.map(p => p.name)),
        projectIndex: state.data.projects.findIndex(p => p.id === (task ? task.projectId : options.project)) + 1 });
      wx.setNavigationBarTitle({ title: task ? task.seq : I.t('newTask') });
      this.ready = true;
    } catch (e) { this.setData({ error: I.message(e.message) }); }
  },
  field(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); },
  clear(e) { this.setData({ [e.currentTarget.dataset.field]: '' }); },
  dependency(e) { this.setData({ dependsOn: e.detail.value }); },
  checkText(e) { const checklist = this.data.checklist.map((c, i) => i === +e.currentTarget.dataset.index ? { ...c, text: e.detail.value } : c); this.setData({ checklist }); },
  checkToggle(e) { const checklist = this.data.checklist.map((c, i) => i === +e.currentTarget.dataset.index ? { ...c, done: !c.done } : c); this.setData({ checklist }); },
  checkRemove(e) { this.setData({ checklist: this.data.checklist.filter((_, i) => i !== +e.currentTarget.dataset.index) }); },
  checkAdd() { if (!this.data.checkNew.trim()) return; this.setData({ checklist: this.data.checklist.concat({ id: M.uid(), text: this.data.checkNew.trim(), done: false }), checkNew: '' }); },
  async save() {
    if (!this.ready || this.data.saving) return;
    if (!this.data.title.trim()) { this.setData({ error: I.t('requiredTitle') }); return; }
    if (this.data.scheduled && this.data.due && this.data.due < this.data.scheduled) { this.setData({ error: I.t('dateOrder') }); return; }
    this.checkAdd();
    this.setData({ saving: true, error: '' });
    try {
      await store.mutate(ws => {
        const fields = { title: this.data.title, notes: this.data.notes, status: M.STATUSES[+this.data.statusIndex], priority: M.PRIORITIES[+this.data.priorityIndex] || null,
          type: M.TASK_TYPES[+this.data.typeIndex], assignee: this.data.assignee, labels: this.data.labelsText.split(/[,，]/).filter(v => v.trim()), estimate: this.data.estimate, spent: this.data.spent,
          acceptance: this.data.acceptance, links: this.data.linksText.split(/\r?\n/).filter(v => v.trim()), checklist: this.data.checklist, dependsOn: this.data.dependsOn,
          projectId: +this.data.projectIndex ? this.data.projects[+this.data.projectIndex - 1].id : null, scheduled: this.data.scheduled || null, due: this.data.due || null };
        if (this.data.id) { if (!M.findTask(ws, this.data.id)) throw new Error('任务已删除'); M.updateTask(ws, this.data.id, fields); }
        else { const t = M.addTask(ws, fields); this.setData({ id: t.id }); }
      });
      wx.showToast({ title: I.t(store.snapshot().demo ? 'savedDemo' : 'saved') }); wx.navigateBack();
    } catch (e) { this.setData({ error: I.message(e.message) + ' ' + I.t('kept') }); }
    finally { this.setData({ saving: false }); }
  },
  async remove() {
    if (this.data.saving) return;
    const choice = await wx.showModal({ title: I.t('deleteTask'), content: I.t('deleteWarning'), confirmText: I.t('delete'), cancelText: I.t('cancel'), confirmColor: '#d65b5b' });
    if (!choice.confirm) return;
    this.setData({ saving: true });
    try { await store.mutate(ws => M.deleteTask(ws, this.data.id)); wx.navigateBack(); }
    catch (e) { this.setData({ error: I.message(e.message) }); }
    finally { this.setData({ saving: false }); }
  },
});
