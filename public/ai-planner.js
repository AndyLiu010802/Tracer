(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerAIPlanner=api;})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  function fail(code){throw new Error(code);}
  function date(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s;}
  function add(s,n){const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
  function week(s){const d=new Date(s+'T12:00:00Z').getUTCDay();return add(s,-((d+6)%7));}
  function text(s,max,required){if(typeof s!=='string'||s.length>max||required&&!s.trim())fail('invalid-plan');return s.trim();}
  function constraints(raw){
    if(!raw||!date(raw.start)||!date(raw.deadline)||raw.deadline<raw.start||raw.deadline>add(raw.start,730))fail('invalid-dates');
    if(!Array.isArray(raw.days))fail('invalid-days');
    const days=Array.from(new Set(raw.days)).sort();
    if(!days.length||days.some(d=>!Number.isInteger(d)||d<0||d>6))fail('invalid-days');
    const weekly=Number(raw.weekly),daily=Number(raw.daily),session=Number(raw.session),buffer=Number(raw.buffer||0);
    if(!Number.isFinite(weekly)||weekly<.25||weekly>100||!Number.isFinite(daily)||daily<.25||daily>16||!Number.isFinite(session)||session<.25||session>8||session>daily||!Number.isFinite(buffer)||buffer<0||buffer>50)fail('invalid-hours');
    return {start:raw.start,deadline:raw.deadline,days,weekly,daily,session,buffer};
  }
  function proposal(raw){
    if(!raw||!Array.isArray(raw.tasks)||raw.tasks.length<1||raw.tasks.length>40)fail('invalid-plan');
    const out={title:text(raw.title,160,true),summary:text(raw.summary,12000,true),assumptions:[],risks:[],questions:[],tasks:[]};
    for(const k of ['assumptions','risks','questions']){if(!Array.isArray(raw[k])||raw[k].length>12)fail('invalid-plan');out[k]=raw[k].map(v=>text(v,2000,true));}
    const keys=new Set();
    for(const t of raw.tasks){
      if(!t||typeof t.key!=='string'||!/^[a-zA-Z0-9_-]{1,32}$/.test(t.key)||keys.has(t.key))fail('invalid-plan');keys.add(t.key);
      const hours=Number(t.hours);if(!Number.isFinite(hours)||hours<.25||hours>160)fail('invalid-plan');
      if(!['low','medium','high','urgent'].includes(t.priority))fail('invalid-plan');
      if(!Array.isArray(t.dependsOn)||t.dependsOn.length>40||!Array.isArray(t.checklist)||t.checklist.length>15)fail('invalid-plan');
      out.tasks.push({key:t.key,title:text(t.title,200,true),notes:text(t.notes,6000,false),acceptance:text(t.acceptance,3000,false),hours:Math.ceil(hours*4)/4,priority:t.priority,dependsOn:Array.from(new Set(t.dependsOn)),checklist:t.checklist.map(v=>text(v,1000,true))});
    }
    for(const t of out.tasks)if(t.dependsOn.some(k=>!keys.has(k)||k===t.key))fail('invalid-dependencies');
    const done=new Set(),active=new Set(),byKey=Object.fromEntries(out.tasks.map(t=>[t.key,t]));
    function visit(t){if(active.has(t.key))fail('invalid-dependencies');if(done.has(t.key))return;active.add(t.key);t.dependsOn.forEach(k=>visit(byKey[k]));active.delete(t.key);done.add(t.key);}
    out.tasks.forEach(visit);return out;
  }
  function schedule(plan,raw,existing){
    const c=constraints(raw),p=proposal(plan),units=h=>Math.max(0,Math.ceil(h*4));
    const weekLimit=Math.floor(c.weekly*4*(1-c.buffer/100)),dayLimit=Math.floor(c.daily*4),sessionLimit=Math.floor(c.session*4);
    const weekUse={},dayUse={},buckets=[],unknown=[];
    for(const t of existing||[]){
      if(t.status==='done'||!date(t.scheduled))continue;
      if(week(t.scheduled)<week(c.start)||week(t.scheduled)>week(c.deadline))continue;
      const known=typeof t.estimate==='number'&&Number.isFinite(t.estimate)&&t.estimate>=0;
      const hours=known?Math.max(0,t.estimate-(Number(t.spent)||0)):1;
      if(!known)unknown.push(t.id);
      const used=units(hours),w=week(t.scheduled);weekUse[w]=(weekUse[w]||0)+used;dayUse[t.scheduled]=(dayUse[t.scheduled]||0)+used;
    }
    for(let d=c.start;d<=c.deadline;d=add(d,1))if(c.days.includes(new Date(d+'T12:00:00Z').getUTCDay()))buckets.push(d);
    const byKey=Object.fromEntries(p.tasks.map(t=>[t.key,t])),ordered=[],seen=new Set();
    function visit(t){if(seen.has(t.key))return;t.dependsOn.forEach(k=>visit(byKey[k]));seen.add(t.key);ordered.push(t);}p.tasks.forEach(visit);
    const finished=Object.create(null),blocks=[],unscheduled=[];
    for(const t of ordered){
      let left=units(t.hours),earliest=c.start;
      for(const k of t.dependsOn){if(!finished[k])earliest=add(c.deadline,1);else if(finished[k]>earliest)earliest=finished[k];}
      let last='';
      for(const d of buckets){
        if(!left)break;if(d<earliest)continue;const w=week(d);
        let capacity=Math.min(dayLimit-(dayUse[d]||0),weekLimit-(weekUse[w]||0));
        while(capacity>0&&left>0){const take=Math.min(capacity,left,sessionLimit);blocks.push({key:t.key,date:d,hours:take/4});left-=take;capacity-=take;dayUse[d]=(dayUse[d]||0)+take;weekUse[w]=(weekUse[w]||0)+take;last=d;}
      }
      if(left)unscheduled.push({key:t.key,hours:left/4});else finished[t.key]=last;
    }
    if(blocks.length>500)fail('too-many-blocks');
    return {blocks,unscheduled,totalHours:p.tasks.reduce((n,t)=>n+t.hours,0),scheduledHours:blocks.reduce((n,t)=>n+t.hours,0),missingHours:unscheduled.reduce((n,t)=>n+t.hours,0),unknownEstimates:unknown.length,weekly:Object.keys(weekUse).sort().map(w=>({week:w,hours:weekUse[w]/4,limit:weekLimit/4})),constraints:c};
  }
  function apply(workspace,plan,raw,id,M){
    if(typeof id!=='string'||!/^aip_[a-zA-Z0-9_-]{1,70}$/.test(id))fail('invalid-plan');
    if(workspace.projects.some(p=>p.id===id))return {workspace,duplicate:true};
    const p=proposal(plan),s=schedule(p,raw,workspace.tasks);
    if(s.missingHours>0)fail('insufficient-capacity');
    if(workspace.tasks.length+s.blocks.length>2000)fail('too-many-blocks');
    const ws=JSON.parse(JSON.stringify(workspace)),project=M.addProject(ws,{name:p.title});project.id=id;project.start=s.constraints.start;project.end=s.constraints.deadline;
    const last=Object.create(null),all=Object.create(null),byKey=Object.fromEntries(p.tasks.map(t=>[t.key,t]));
    for(const b of s.blocks){const t=byKey[b.key],total=s.blocks.filter(x=>x.key===b.key).length;all[b.key]=(all[b.key]||0)+1;const part=all[b.key];
      const deps=last[b.key]?[last[b.key]]:t.dependsOn.map(k=>last[k]).filter(Boolean);
      const record=M.addTask(ws,{title:t.title+(total>1?' ['+part+'/'+total+']':''),notes:t.notes,acceptance:t.acceptance,estimate:b.hours,spent:0,priority:t.priority,type:'task',projectId:id,scheduled:b.date,due:s.constraints.deadline,dependsOn:deps,checklist:part===total?t.checklist.map(v=>({text:v,done:false})):[],labels:['AI plan']});last[b.key]=record.id;
    }
    const note=M.addNote(ws,{title:p.title,projectId:id,body:p.summary+'\n\n'+p.assumptions.concat(p.risks).map(x=>'- '+x).join('\n')});
    return {workspace:ws,projectId:id,tasks:s.blocks.length,noteId:note.id,schedule:s};
  }
  return {date,add,week,constraints,proposal,schedule,apply};
});
