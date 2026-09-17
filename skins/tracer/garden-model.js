(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./task-history') : root.TaskHistory,
    typeof module === 'object' && module.exports ? require('./project-deletion') : root.ProjectDeletion);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerGardenModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (History, Deletion) {
  'use strict';
  const limit = 6, receiptLimit = 10000, maximumTime = 8640000000000000;
  const plantKinds = ['wildflower', 'sunflower', 'lavender'];
  const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const id = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
  const time = value => Number.isSafeInteger(value) && value >= 0 && value <= maximumTime;
  const keys = (value, fields) => object(value) && Object.keys(value).length === fields.length && fields.every(key => has(value, key));
  function fail(code) { throw Object.assign(new Error(code), { code }); }
  function stageFor(tasks, minutes) { const effort = tasks + Math.floor(minutes / 25); return effort >= 6 ? 3 : effort >= 3 ? 2 : effort >= 1 ? 1 : 0; }
  function fresh() { return { v: 1, plots: [] }; }
  function read(raw) {
    if (!keys(raw, ['v', 'plots']) || raw.v !== 1 || !Array.isArray(raw.plots) || raw.plots.length > limit) fail('invalid-garden-state');
    const projects = new Set(), allTasks = new Set(), allFocus = new Set();
    function receipts(values, seen) {
      if (!Array.isArray(values) || values.length > receiptLimit) fail('invalid-garden-state');
      return Array.from(values, value => { if (!id(value) || seen.has(value)) fail('invalid-garden-state'); seen.add(value); return value; });
    }
    const plots = Array.from(raw.plots, plot => {
      if (!keys(plot, ['projectId', 'plantKind', 'plantedAt', 'initialized', 'stage', 'commemoratedAt', 'taskIds', 'focusIds', 'focusMinutes']) ||
          !id(plot.projectId) || projects.has(plot.projectId) || !plantKinds.includes(plot.plantKind) || !time(plot.plantedAt) ||
          typeof plot.initialized !== 'boolean' || !Number.isInteger(plot.stage) || plot.stage < 0 || plot.stage > 4 ||
          !(plot.commemoratedAt === null || time(plot.commemoratedAt) && plot.commemoratedAt >= plot.plantedAt) ||
          (plot.stage === 4) !== (plot.commemoratedAt !== null)) fail('invalid-garden-state');
      const taskIds = receipts(plot.taskIds, allTasks), focusIds = receipts(plot.focusIds, allFocus);
      if (!Number.isFinite(plot.focusMinutes) || plot.focusMinutes < 0 || plot.focusMinutes > focusIds.length * 180 ||
          (focusIds.length > 0 && plot.focusMinutes === 0) ||
          (!plot.initialized && (plot.stage !== 0 || taskIds.length || focusIds.length || plot.focusMinutes)) ||
          (plot.stage < 4 && plot.stage !== stageFor(taskIds.length, plot.focusMinutes))) fail('invalid-garden-state');
      projects.add(plot.projectId);
      return { projectId: plot.projectId, plantKind: plot.plantKind, plantedAt: plot.plantedAt, initialized: plot.initialized,
        stage: plot.stage, commemoratedAt: plot.commemoratedAt, taskIds, focusIds, focusMinutes: plot.focusMinutes };
    });
    return { v: 1, plots };
  }
  function plant(raw, projectId, plantKind, now = Date.now()) {
    const state = read(raw);
    if (!id(projectId) || !plantKinds.includes(plantKind) || !time(now)) fail('invalid-garden-argument');
    if (state.plots.some(plot => plot.projectId === projectId)) fail('garden-project-exists');
    if (state.plots.length >= limit) fail('garden-full');
    state.plots.push({ projectId, plantKind, plantedAt: now, initialized: false, stage: 0, commemoratedAt: null, taskIds: [], focusIds: [], focusMinutes: 0 });
    return state;
  }
  function remove(raw, projectId) {
    const state = read(raw);
    if (!id(projectId)) fail('invalid-garden-argument');
    state.plots = state.plots.filter(plot => plot.projectId !== projectId);
    return state;
  }
  function context(workspace, focus, now) {
    if (!time(now) || !object(workspace) || !Array.isArray(workspace.projects) || workspace.projects.length > 2000 ||
        !Array.isArray(workspace.tasks) || workspace.tasks.length > 2000 || (focus !== undefined && focus !== null && !object(focus))) fail('invalid-garden-context');
    const projects = new Map(), tasks = new Map();
    for (const project of workspace.projects) {
      if (!object(project) || !id(project.id) || projects.has(project.id) || typeof project.name !== 'string' || !project.name.trim() || project.name.length > 100000) fail('invalid-garden-context');
      projects.set(project.id, project);
    }
    for (const task of workspace.tasks) {
      if (!object(task) || !id(task.id) || tasks.has(task.id) || typeof task.title !== 'string' || !task.title.trim() || task.title.length > 100000 ||
          !['todo', 'doing', 'review', 'done'].includes(task.status) ||
          !(task.projectId === undefined || task.projectId === null || task.projectId === '' || id(task.projectId)) ||
          !(task.doneAt === undefined || task.doneAt === null || time(task.doneAt))) fail('invalid-garden-context');
      tasks.set(task.id, task);
    }
    let deletions, completed;
    try {
      deletions = Deletion.validate(workspace.projectDeletions);
      completed = History.completed({ tasks: workspace.tasks, projects: workspace.projects, completionHistory: History.validate(workspace.completionHistory) });
    } catch { fail('invalid-garden-context'); }
    const removedTasks = new Set();
    for (const row of deletions) { projects.delete(row.id); for (const taskId of row.taskIds) removedTasks.add(taskId); }
    for (const [taskId, task] of tasks) if (removedTasks.has(taskId) || task.projectId && !projects.has(task.projectId)) tasks.delete(taskId);
    completed = completed.filter(row => row.completedAt <= now && !removedTasks.has(row.taskId) && (!row.projectId || projects.has(row.projectId)));
    const historicalProjects = new Map();
    for (const row of completed) if (row.projectId && !historicalProjects.has(row.taskId)) historicalProjects.set(row.taskId, row.projectId);
    const focusHistory = focus?.history === undefined ? [] : focus.history;
    if (!Array.isArray(focusHistory) || focusHistory.length > 50000) fail('invalid-garden-context');
    const sessions = new Map();
    for (const row of focusHistory) {
      if (!object(row) || !id(row.id) || !time(row.endedAt) || !Number.isFinite(row.minutes) || row.minutes <= 0 || row.minutes > 180 ||
          !(row.task === undefined || row.task === null || object(row.task) && id(row.task.id)) ||
          (row.task && has(row.task, 'projectId') && row.task.projectId !== null && !id(row.task.projectId))) fail('invalid-garden-context');
      // New focus snapshots retain the original project. Explicit null means
      // unassigned, while old snapshots may use their surviving task/history.
      let projectId = null;
      if (row.task) projectId = has(row.task, 'projectId') ? row.task.projectId : tasks.get(row.task.id)?.projectId || historicalProjects.get(row.task.id) || null;
      const session = { id: row.id, endedAt: row.endedAt, minutes: row.minutes, taskId: row.task?.id || null, projectId,
        title: typeof row.task?.title === 'string' ? row.task.title.slice(0, 100000) : tasks.get(row.task?.id)?.title || '' };
      const old = sessions.get(row.id);
      if (old && (old.endedAt !== session.endedAt || old.minutes !== session.minutes || old.taskId !== session.taskId || old.projectId !== session.projectId)) fail('invalid-garden-context');
      sessions.set(row.id, session);
    }
    return { projects, tasks, completed, sessions: Array.from(sessions.values()).filter(row => row.endedAt <= now &&
      !removedTasks.has(row.taskId) && (row.projectId === null || projects.has(row.projectId))) };
  }
  function reconcile(raw, workspace, focus, now = Date.now()) {
    const previous = read(raw), state = read(previous), source = context(workspace, focus, now), events = [];
    state.plots = state.plots.filter(plot => source.projects.has(plot.projectId));
    const plots = new Map(state.plots.map(plot => [plot.projectId, plot]));
    const tasks = new Set(state.plots.flatMap(plot => plot.taskIds)), sessions = new Set(state.plots.flatMap(plot => plot.focusIds));
    for (const row of source.completed) {
      const projectId = row.projectId || source.tasks.get(row.taskId)?.projectId, plot = plots.get(projectId);
      if (!plot || tasks.has(row.taskId)) continue;
      if (plot.taskIds.length >= receiptLimit) fail('garden-history-limit');
      plot.taskIds.push(row.taskId); tasks.add(row.taskId);
      if (plot.initialized) events.push({ type: 'task', projectId, taskId: row.taskId, title: row.title || '', at: row.completedAt });
    }
    for (const row of source.sessions) {
      const plot = plots.get(row.projectId);
      if (!plot || sessions.has(row.id)) continue;
      if (plot.focusIds.length >= receiptLimit) fail('garden-history-limit');
      plot.focusIds.push(row.id); plot.focusMinutes += row.minutes; sessions.add(row.id);
      if (plot.initialized) events.push({ type: 'focus', projectId: row.projectId, taskId: row.taskId, title: row.title, minutes: row.minutes, at: row.endedAt });
    }
    for (const plot of state.plots) {
      const owned = Array.from(source.tasks.values()).filter(task => task.projectId === plot.projectId);
      const finished = owned.length > 0 && (owned.every(task => task.status === 'done') || source.projects.get(plot.projectId).status === 'done');
      plot.stage = Math.max(plot.stage, stageFor(plot.taskIds.length, plot.focusMinutes));
      if (finished && plot.stage < 4) {
        plot.stage = 4; plot.commemoratedAt = Math.max(now, plot.plantedAt);
        if (plot.initialized) events.push({ type: 'bloom', projectId: plot.projectId, at: plot.commemoratedAt });
      }
      plot.initialized = true;
    }
    return { state, changed: JSON.stringify(state) !== JSON.stringify(previous), events };
  }
  function day(value) { const date = new Date(value); return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate(); }
  function snapshot(raw, workspace, focus, now = Date.now()) {
    const state = read(raw), source = context(workspace, focus, now), today = day(now);
    const plots = state.plots.filter(plot => source.projects.has(plot.projectId)).map(plot => {
      const tasks = Array.from(source.tasks.values()).filter(task => task.projectId === plot.projectId);
      return { projectId: plot.projectId, projectName: source.projects.get(plot.projectId).name, plantKind: plot.plantKind, stage: plot.stage,
        plantedAt: plot.plantedAt, commemoratedAt: plot.commemoratedAt, done: tasks.filter(task => task.status === 'done').length, total: tasks.length,
        completedTasks: plot.taskIds.length, focusMinutes: plot.focusMinutes };
    });
    return { plots, today: { completedTasks: new Set(source.completed.filter(row => day(row.completedAt) === today).map(row => row.taskId)).size,
      focusMinutes: source.sessions.filter(row => day(row.endedAt) === today).reduce((sum, row) => sum + row.minutes, 0) } };
  }
  return { limit, plantKinds: plantKinds.slice(), fresh, read, plant, remove, reconcile, snapshot };
});
