(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerCelebrationsModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const kinds=['wildflower','sunflower','lavender','apple','peach','cherry','neon_orchid','volt_berry','crystal_tree'];
  function changes(before,after){
    if(!before||!after)return[];
    const projects=new Map((before.projects||[]).map(p=>[p.id,p])),seeds=new Map((before.taskGarden?.seeds||[]).map(s=>[s.taskId,s])),events=[];
    for(const p of after.projects||[])if(projects.has(p.id)&&projects.get(p.id).status!=='completed'&&p.status==='completed')events.push({key:'project:'+p.id,type:'project',id:p.id,title:p.name||'',at:p.completedAt});
    for(const s of after.taskGarden?.seeds||[])if(s.variant==='shiny'&&s.ticket===0&&s.completedAt&&!s.forgottenAt&&!s.retiredAt&&['mature','harvested'].includes(s.state)&&!seeds.get(s.taskId)?.completedAt&&kinds.includes(s.plantKind)&&!s.taskId.startsWith('legacy-'))events.push({key:'shiny:'+s.taskId+':'+s.plantedAt,type:'shiny',id:s.taskId,title:s.title||'',kind:s.plantKind,at:s.completedAt});
    return events;
  }
  function valid(event,ws){
    if(!event||typeof event.key!=='string'||typeof event.id!=='string')return false;
    if(event.type==='project')return(ws?.projects||[]).some(p=>p.id===event.id&&p.status==='completed');
    return event.type==='shiny'&&kinds.includes(event.kind)&&(ws?.taskGarden?.seeds||[]).some(s=>s.taskId===event.id&&s.variant==='shiny'&&s.ticket===0&&s.completedAt&&['mature','harvested'].includes(s.state)&&!s.forgottenAt&&!s.retiredAt);
  }
  function burst(width,height,random=Math.random){
    const count=width<600?108:180,out=[];
    for(let i=0;i<count;i++){
      const emitter=i%3,from=['bottom','left','right'][emitter],delay=Math.floor(i/36)*.1,speed=.8+random()*.4;
      out.push({from,x:emitter===0?width*(.12+random()*.76):emitter===1?-18:width+18,y:emitter===0?height+18:height*(.48+random()*.35),vx:(emitter===0?(random()-.5)*width*.52:emitter===1?width*.43:-width*.43)*speed,vy:-height*(emitter===0?.8+random()*.36:.37+random()*.35),size:13+random()*15,rotation:random()*Math.PI*2,spin:(random()-.5)*7,phase:random()*Math.PI*2,delay,material:Math.floor(i/3)%6});
    }return out;
  }
  return{changes,valid,burst};
});
