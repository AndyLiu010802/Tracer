'use strict';
const effects=Object.freeze([{id:'haunt',name:'Fade - Haunt / \u9ed1\u68a6\u4e4b\u773c',duration:7000},{id:'leer',name:'Reyna - Leer / \u7d2b\u773c',duration:3300}].map(Object.freeze));
const defaults=Object.freeze({enabled:false,effect:'haunt',strength:.35,atmosphere:true,size:100,motion:'system'});
function normalize(value={},current=defaults){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!Object.hasOwn(defaults,k)))throw Error('local-vfx-invalid-settings');
 const c={...current,...value};
 if(typeof c.enabled!=='boolean'||!effects.some(e=>e.id===c.effect)||typeof c.atmosphere!=='boolean'||!Number.isFinite(c.strength)||c.strength<0||c.strength>.6||!Number.isFinite(c.size)||c.size<40||c.size>200||!['system','normal','reduced'].includes(c.motion))throw Error('local-vfx-invalid-settings');
 return Object.freeze(c);
}
const allowed=(app,profile)=>app?.isPackaged===false&&profile?.channel==='local';
module.exports={effects,defaults,normalize,allowed};
