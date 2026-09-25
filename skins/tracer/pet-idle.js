(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./pet-personalities') : root.TracerPetPersonalities);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerPetIdle = api;
})(typeof self !== 'undefined' ? self : this, function (Personalities) {
  'use strict';
  const activities = ['fishing', 'exercise', 'farming', 'mining'];
  const workActivities = ['reading', 'farming', 'writing', 'fishing', 'crafting', 'mining', 'tea', 'exercise'];
  const quietTime = 20000, activeTime = 70000, cycleTime = quietTime + activeTime;

  function offset(id) {
    let value = 2166136261;
    for (let i = 0; i < id.length; i++) value = Math.imul(value ^ id.charCodeAt(i), 16777619);
    return value >>> 0;
  }

  function create() {
    let petId = null, kind = null, anchor = null, lastTime = null, wasBlocked = false;
    let nextActivity = 0, activeCycle = null, activeAction = '';
    function reset(now = Date.now()) {
      anchor = Number.isFinite(now) ? now : null;
      lastTime = null;
      wasBlocked = false;
      activeCycle = null; activeAction = '';
    }
    function update(input, now = Date.now()) {
      if (!Number.isFinite(now)) { reset(now); return ''; }
      const valid = input && typeof input.petId === 'string' && input.petId.length > 0 &&
        (input.kind === 'humanoid' || input.kind === 'creature');
      if (!valid || input.blocked) {
        anchor = now; lastTime = now; wasBlocked = true;
        activeCycle = null; activeAction = '';
        return '';
      }
      const changed = petId !== null && (petId !== input.petId || kind !== input.kind);
      const elapsed = anchor === null ? 0 : now - anchor;
      // A missed quiet interval indicates suspension. Resume with the full wait, never a late activity.
      const interrupted = lastTime !== null && (now < lastTime || now - lastTime > quietTime);
      if (changed) nextActivity = 0;
      if (anchor === null || changed || wasBlocked || interrupted || elapsed < 0 || !Number.isFinite(elapsed)) {
        anchor = now; activeCycle = null; activeAction = '';
      }
      petId = input.petId; kind = input.kind; lastTime = now; wasBlocked = false;
      const age = now - anchor;
      if (age % cycleTime < quietTime) return '';
      const preferred=Personalities?.get(petId)?.activityOrder;
      // Built-ins retain their own favorite activities, alternating each one with
      // a quiet work action when their complete pose library is available.
      const order=preferred?(input.workActivities?preferred.flatMap((activity,index)=>[activity,['reading','writing','crafting','tea'][index]]):preferred):(input.workActivities ? workActivities : activities);
      const cycle = Math.floor(age / cycleTime);
      // Advance only when an activity actually starts. Pauses restart the quiet
      // wait, but must not send the companion back to its first favorite.
      if (activeCycle !== cycle || !order.includes(activeAction)) {
        activeAction = order[((preferred ? 0 : offset(petId)) + nextActivity) % order.length];
        nextActivity = (nextActivity + 1) % order.length;
        activeCycle = cycle;
      }
      return activeAction;
    }
    return { update, reset };
  }
  return { create, quietTime, activeTime };
});
