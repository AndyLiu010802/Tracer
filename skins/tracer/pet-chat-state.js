(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.TracerPetChatState=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const invalid=()=>new Error('pet-chat-state-invalid');
  const id=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
  function normalize(value){
    if(!value||typeof value!=='object'||!Array.isArray(value.conversation)||value.conversation.length>32||typeof value.draft!=='string'||value.draft.length>2000)throw invalid();
    const proposal=value=>root.TracerCompanionWork.normalize(value);
    const conversation=value.conversation.map(message=>{
      if(!message||!Number.isSafeInteger(message.id)||message.id<1||!['user','assistant'].includes(message.role)||typeof message.content!=='string'||message.content.length>2000||!message.content.trim()||(message.status!==undefined&&!['pending','sent','failed'].includes(message.status)))throw invalid();
      return {id:message.id,role:message.role,content:message.content,...(message.status?{status:message.status}:{})};
    });
    let work=null;
    if(value.work){
      const source=value.work;
      if(!id(source.requestId)||!['pending','editing','saving','failed','created'].includes(source.status))throw invalid();
      work={requestId:source.requestId,proposal:proposal(source.proposal),status:source.status,result:null};
      if(source.result){
        if((source.result.projectId!==null&&typeof source.result.projectId!=='string')||!Array.isArray(source.result.taskIds)||source.result.taskIds.length>20||source.result.taskIds.some(id=>typeof id!=='string'||id.length>100))throw invalid();
        work.result={projectId:source.result.projectId,taskIds:source.result.taskIds.slice()};
      }
      if(work.status==='created'&&!work.result)throw invalid();
    }
    return {conversation,draft:value.draft,work,proposalContext:value.proposalContext?proposal(value.proposalContext):null};
  }
  function create({surface,petId,storage=root.localStorage}){
    if(!['main','native'].includes(surface)||typeof petId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(petId))throw invalid();
    const key='tracer.petChat.v1.'+surface+'.'+petId;
    let source=null,blocked=false;
    function load(){
      source=storage.getItem(key);
      if(source===null){blocked=false;return null;}
      try {
        const record=JSON.parse(source);
        if(record.version!==1||!Number.isSafeInteger(record.savedAt))throw invalid();
        const result=normalize(record.state);blocked=false;return result;
      }catch(error){blocked=true;throw error;}
    }
    function save(state){
      if(blocked)throw invalid();
      const current=storage.getItem(key);
      if(current!==null&&current!==source)throw new Error('pet-chat-state-changed');
      const next=JSON.stringify({version:1,savedAt:Date.now(),state:normalize(state)});
      storage.setItem(key,next);source=next;
    }
    function clear(){
      const current=storage.getItem(key);
      if(current!==null&&current!==source)throw new Error('pet-chat-state-changed');
      storage.removeItem(key);source=null;blocked=false;
    }
    function finish(requestId,status,result=null,content=''){
      const state=load();if(!state?.work||state.work.requestId!==requestId)return false;
      if(state.work.status==='created')return status==='created';
      if(status==='created'&&state.work.status!=='created'&&content){
        state.conversation.push({id:state.conversation.reduce((max,message)=>Math.max(max,message.id),0)+1,role:'assistant',content});
        state.conversation=state.conversation.slice(-32);
      }
      state.work.status=status;state.work.result=result;
      if(status==='created')state.proposalContext=null;
      save(state);return true;
    }
    function completed(requestId){
      const previous=source,state=load();
      if(state?.work?.requestId===requestId&&state.work.status==='created')return state;
      source=previous;return null;
    }
    return {load,save,clear,finish,completed};
  }
  return {create,normalize};
});
