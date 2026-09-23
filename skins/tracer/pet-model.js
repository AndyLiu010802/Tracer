(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./pet-animation') : root.TracerPetAnimation);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerPetModel = api;
})(typeof self !== 'undefined' ? self : this, function (Animation) {
  'use strict';
  const pets = [
    { id: 'sprout', en: 'Sprout', zh: '芽芽', species: ['小绵羊', 'Cloud sheep'], metric: 'welcome', target: 1, color: '#b7dac1' },
    { id: 'miso', en: 'Miso', zh: '米酥', species: ['橘猫', 'Ginger cat'], metric: 'gardenHarvests', target: 1, color: '#e5b575' },
    { id: 'brook', en: 'Brook', zh: '溪溪', species: ['小企鹅', 'River penguin'], metric: 'focus', target: 25, color: '#8bc6de' },
    { id: 'ember', en: 'Ember', zh: '小焰', species: ['赤狐', 'Ember fox'], metric: 'tasks', target: 10, color: '#eb9478' },
    { id: 'luna', en: 'Luna', zh: '月芽', species: ['月光兔', 'Moon rabbit'], metric: 'streak', target: 3, color: '#baa8eb' },
    { id: 'nova', en: 'Nova', zh: '星芽', species: ['星星幼龙', 'Starlight dragon'], metric: 'focus', target: 120, color: '#89d9c5' }
  ].map(pet => ({ ...pet, kind: 'creature' }));
  const customLimit = 12;
  const gardenPets = ['wildflower','sunflower','lavender','apple','peach','cherry','neon_orchid','volt_berry','crystal_tree'].flatMap((plantKind,index)=>[false,true].map(shiny=>({
    id:'garden_'+plantKind+(shiny?'_shiny':''),plantKind,garden:true,shiny,kind:'creature',
    zh:(shiny?'闪光 · ':'')+['花团','小葵','绒绒','苹宝','桃桃','樱丸','霓霓','莓光','晶芽'][index],
    en:(shiny?'Shiny ':'')+['Petal','Sunny','Violet','Pippin','Peaches','Cherry','Lumi','Berryglow','Prism'][index],
    species:shiny?['闪光植物伙伴','Shiny garden companion']:['奇幻植物伙伴','Garden companion'],
    color:shiny?'#c9b2f3':['#e9a1b2','#ebc359','#b49bcf','#cd7769','#efb59b','#d67e9d','#bd8be8','#79d7e1','#92d9b7'][index]
  })));
  function customProfile(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      typeof raw.id !== 'string' || !/^custom_[a-f0-9]{32}$/.test(raw.id) ||
      typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 40 ||
      (raw.personality !== undefined && (typeof raw.personality !== 'string' || raw.personality.length > 600)) ||
      !['humanoid', 'creature'].includes(raw.kind) ||
      typeof raw.image !== 'string' || !/^\/api\/pet-art\/[a-f0-9]{32}\.png$/.test(raw.image)) return null;
    const animation = raw.animation === undefined ? undefined : Animation?.normalize(raw.animation);
    if (raw.animation !== undefined && (!animation || raw.image !== animation.pages[0])) return null;
    return { id: raw.id, name: raw.name.trim(), personality: (raw.personality || '').trim(), kind: raw.kind, image: raw.image,
      ...(animation ? { animation } : {}) };
  }
  function customProfiles(raw) {
    const result = [], seen = new Set();
    for (const value of Array.isArray(raw) ? raw : []) {
      const profile = customProfile(value);
      if (!profile || seen.has(profile.id)) continue;
      result.push(profile); seen.add(profile.id);
      if (result.length === customLimit) break;
    }
    return result;
  }
  function catalog(s) {
    return pets.concat(gardenPets.filter(pet=>s?.unlocked?.includes(pet.id)),customProfiles(s && s.customs).map(profile => ({
      ...profile, en: profile.name, zh: profile.name, custom: true,
      species: profile.kind === 'humanoid' ? ['人型伙伴', 'Humanoid companion'] : ['生物伙伴', 'Creature companion'],
      color: profile.kind === 'humanoid' ? '#baa8eb' : '#b7dac1'
    })));
  }
  const clamp = (v, fallback = 70) => Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : fallback;
  const day = time => { const d = new Date(time); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
  function fresh(now = Date.now()) {
    return { v: 1, selected: 'sprout', unlocked: ['sprout'], customs: [], pets: {}, updatedAt: now, reminders: true, snoozedUntil: 0, lastReminder: 0, lastAction: '', lastActionAt: 0 };
  }
  function read(raw, now = Date.now()) {
    const s = fresh(now);
    if (!raw || raw.v !== 1) return s;
    s.customs = customProfiles(raw.customs);
    const available = catalog({...s,unlocked:Array.isArray(raw.unlocked)?raw.unlocked:[]});
    s.unlocked = Array.from(new Set(['sprout', ...s.customs.map(p => p.id), ...(Array.isArray(raw.unlocked) ? raw.unlocked : [])])).filter(id => available.some(p => p.id === id));
    s.selected = s.unlocked.includes(raw.selected) ? raw.selected : 'sprout';
    for (const pet of available) {
      const old = raw.pets && raw.pets[pet.id];
      if (old) s.pets[pet.id] = { food: clamp(old.food), energy: clamp(old.energy), joy: clamp(old.joy), bond: clamp(old.bond, 0), sleeping: old.sleeping === true };
    }
    s.updatedAt = Number.isFinite(raw.updatedAt) ? Math.min(now, raw.updatedAt) : now;
    s.reminders = raw.reminders !== false;
    for (const key of ['snoozedUntil','lastReminder','lastActionAt']) s[key] = Number.isFinite(raw[key]) ? Math.max(0,raw[key]) : 0;
    s.lastAction = ['feed','play','sleep','wake','pet'].includes(raw.lastAction) ? raw.lastAction : '';
    return s;
  }
  function addCustom(s, raw, now = Date.now()) {
    const profile = customProfile(raw);
    if (!profile) throw new Error('invalid-custom');
    const customs = customProfiles(s.customs);
    if (customs.some(p => p.id === profile.id)) throw new Error('custom-exists');
    if (customs.length >= customLimit) throw new Error('custom-limit');
    advance(s, now);
    s.customs = customs.concat(profile);
    s.unlocked.push(profile.id);
    s.selected = profile.id;
    s.lastAction = ''; s.lastActionAt = 0;
    current(s);
    return profile;
  }
  function removeCustom(s, id) {
    if (!Array.isArray(s.customs) || !s.customs.some(p => p.id === id)) return false;
    s.customs = s.customs.filter(p => p.id !== id);
    s.unlocked = s.unlocked.filter(value => value !== id);
    delete s.pets[id];
    if (s.selected === id) { s.selected = 'sprout'; s.lastAction = ''; s.lastActionAt = 0; current(s); }
    return true;
  }
  function current(s) {
    return s.pets[s.selected] || (s.pets[s.selected] = { food: 80, energy: 85, joy: 80, bond: 0, sleeping: false });
  }
  function advance(s, now = Date.now()) {
    const hours = Math.min(24, Math.max(0, now - s.updatedAt) / 3600000);
    for (const pet of Object.values(s.pets)) {
      pet.food = clamp(pet.food - hours * (pet.sleeping ? 2 : 4));
      pet.energy = clamp(pet.energy + hours * (pet.sleeping ? 18 : -3));
      pet.joy = clamp(pet.joy - hours * (pet.sleeping ? 1 : 2));
    }
    s.updatedAt = Math.max(s.updatedAt, now); current(s); return s;
  }
  function metrics(harvestRecords = [], completed = [], focus = {}, now = Date.now()) {
    const unique = new Set(completed.map(h => h.taskId));
    const days = new Set(completed.filter(h => Number.isFinite(h.completedAt)).map(h => day(h.completedAt)));
    const cursor = new Date(now); cursor.setHours(12,0,0,0);
    if (!days.has(day(cursor))) cursor.setDate(cursor.getDate()-1);
    let streak = 0;
    while (days.has(day(cursor))) { streak++; cursor.setDate(cursor.getDate()-1); }
    // Only durable project-garden harvest receipts count. Retired leisure-game
    // counters cannot grant new unlocks; read() keeps companions already earned.
    const harvested = new Set((Array.isArray(harvestRecords) ? harvestRecords : []).filter(row => row &&
      typeof row.projectId === 'string' && row.projectId.length > 0 &&
      Number.isSafeInteger(row.maturedAt) && row.maturedAt >= 0 &&
      Number.isSafeInteger(row.harvestedAt) && row.harvestedAt >= row.maturedAt && row.harvestedAt <= now
    ).map(row => row.projectId));
    return { welcome: 1, gardenHarvests: harvested.size, tasks: unique.size, streak, focus: Number.isFinite(focus.totalMinutes) ? Math.max(0,focus.totalMinutes) : 0 };
  }
  function unlock(s, values) {
    const added = [];
    for (const pet of pets) if (!s.unlocked.includes(pet.id) && values[pet.metric] >= pet.target) { s.unlocked.push(pet.id); added.push(pet.id); }
    return added;
  }
  function unlockGarden(s,records){
    const added=[];
    for(const row of Array.isArray(records)?records:[]){
      if(!row||row.harvestedAt===null||!Number.isSafeInteger(row.harvestedAt)||!Number.isInteger(row.ticket)||row.ticket<0||row.ticket>=100)continue;
      const value='garden_'+row.plantKind+(row.ticket===0?'_shiny':'');
      if(gardenPets.some(pet=>pet.id===value)&&!s.unlocked.includes(value)){s.unlocked.push(value);added.push(value);}
    }return added;
  }
  function act(s, action, value, now = Date.now()) {
    advance(s, now);
    const result = (accepted, reason = 'ok', actual = action) => ({ accepted, reason, action: actual });
    if (action === 'select') {
      if (!s.unlocked.includes(value)) return result(false, 'locked');
      if (s.selected !== value) { s.selected = value; s.lastAction = ''; s.lastActionAt = 0; }
      current(s); return result(true);
    }
    if (action === 'reminders') { s.reminders = value === true; return result(true); }
    if (action === 'snooze') { s.snoozedUntil = now + 30 * 60000; return result(true); }
    const p = current(s);
    if (action === 'sleep') { p.sleeping = !p.sleeping; s.lastAction = p.sleeping ? 'sleep' : 'wake'; }
    else if (['feed','play','pet'].includes(action)) {
      if (p.sleeping) return result(false, 'sleeping');
      if (action === 'feed' && p.food >= 95) return result(false, 'full');
      if (action === 'play' && p.energy < 15) return result(false, 'tired');
      if (action === 'play' && p.joy >= 95) return result(false, 'content');
      if (action === 'pet' && p.joy >= 100 && p.bond >= 100) return result(false, 'content');
      if (s.lastAction && now - s.lastActionAt < 2500) return result(false, 'cooldown');
      if (action === 'feed') { p.food = clamp(p.food+25); p.bond = clamp(p.bond+2); }
      if (action === 'play') { p.joy = clamp(p.joy+25); p.energy = clamp(p.energy-8); p.bond = clamp(p.bond+3); }
      if (action === 'pet') { p.joy = clamp(p.joy+5); p.bond = clamp(p.bond+1); }
      s.lastAction = action;
    } else return result(false, 'invalid-action');
    s.lastActionAt = now;
    return result(true, 'ok', s.lastAction);
  }
  function mood(s, focusing) {
    const p = current(s);
    return p.sleeping ? 'sleeping' : focusing ? 'focusing' : p.food < 25 ? 'hungry' : p.energy < 25 ? 'tired' : p.joy < 25 ? 'bored' : 'happy';
  }
  function nextTask(tasks = [], today = day(Date.now())) {
    return tasks.filter(t => t.status !== 'done' && ((t.due && t.due <= today) || (t.scheduled && t.scheduled <= today)))
      .sort((a,b) => (a.due || a.scheduled).localeCompare(b.due || b.scheduled) || ({urgent:0,high:1,medium:2,low:3}[a.priority] ?? 4) - ({urgent:0,high:1,medium:2,low:3}[b.priority] ?? 4))[0] || null;
  }
  function reminder(s, tasks, focus, now = Date.now()) {
    if (!s.reminders || s.snoozedUntil > now || focus.running || current(s).sleeping || now-s.lastReminder < 30*60000) return null;
    const task = nextTask(tasks, day(now));
    if (task) { s.lastReminder = now; return { id: task.id, title: task.title, due: task.due || task.scheduled }; }
    return null;
  }
  return { pets, gardenPets, customLimit, customProfile, catalog, addCustom, removeCustom, fresh, read, current, advance, metrics, unlock, unlockGarden, act, mood, nextTask, reminder, day };
});
