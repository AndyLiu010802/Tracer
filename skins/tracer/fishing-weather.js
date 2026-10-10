(function(root, factory){
  'use strict';
  const api = factory();
  if(typeof module === 'object' && module.exports) module.exports = api;
  else root.TracerFishingWeather = api;
})(typeof window !== 'undefined' ? window : globalThis, function(){
  'use strict';
  const REFRESH = 15 * 60 * 1000, MAX_AGE = 30 * 60 * 1000;
  function weatherId(code){
    if([0,1].includes(code)) return 'clear';
    if([2,3].includes(code)) return 'cloudy';
    if([45,48].includes(code)) return 'fog';
    if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return 'rain';
    if([71,73,75,77,85,86].includes(code)) return 'snow';
    if([95,96,99].includes(code)) return 'storm';
    return 'unknown';
  }
  function timeId(now, data){
    const sun = data?.sun?.find(s => s.rise && s.set && now >= s.rise - 6*3600000 && now < s.set + 6*3600000);
    if(sun){
      if(Math.abs(now-sun.rise) <= 45*60000) return 'dawn';
      if(Math.abs(now-sun.set) <= 45*60000) return 'dusk';
      return now > sun.rise && now < sun.set ? 'day' : 'night';
    }
    // Polar day/night has no sunrise or sunset. Trust a fresh observation.
    if(data && now-data.observedAt < MAX_AGE && data.sun?.every(s=>!s.rise&&!s.set)) return data.isDay?'day':'night';
    const hour = Number(new Intl.DateTimeFormat('en-GB', {hour:'2-digit', hourCycle:'h23', ...(data?.timezone?{timeZone:data.timezone}:{})}).format(now));
    return hour >= 5 && hour < 7 ? 'dawn' : hour >= 7 && hour < 17 ? 'day' : hour >= 17 && hour < 19 ? 'dusk' : 'night';
  }
  function create(options={}){
    const geo = options.geolocation || globalThis.navigator?.geolocation, fetcher = options.fetch || globalThis.fetch;
    const now = options.now || Date.now, every = options.setInterval || globalThis.setInterval, cancel = options.clearInterval || globalThis.clearInterval;
    let data = null, status = 'idle', reason = '', running = false, disposed = false, timer = null, lastAttempt = -Infinity, denied = false;
    function snapshot(){
      const at = now(), fresh = status === 'ready' && data && at-data.fetchedAt < MAX_AGE && at-data.observedAt < 90*60000;
      return {status: fresh?'ready':status==='ready'?'unavailable':status, reason, timeId:timeId(at,data), weatherId:fresh?weatherId(data.code):'unknown', now:at,
        timezone:data?.timezone || null, temperature:fresh?data.temperature:null, observedAt:fresh?data.observedAt:null};
    }
    const emit=()=>{if(!disposed)options.onChange?.(snapshot());};
    async function refresh(){
      if(running||disposed)return;running=true;lastAttempt=now();status='loading';reason='';emit();
      try{
        if(!geo||!fetcher)throw new Error('location-unavailable');
        const pos=await new Promise((resolve,reject)=>geo.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:12000,maximumAge:5*60000}));
        if(disposed)return;
        const lat=pos.coords.latitude,lon=pos.coords.longitude;
        if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw new Error('location-unavailable');
        const response=await fetcher('/api/fishing/weather?latitude='+lat.toFixed(2)+'&longitude='+lon.toFixed(2),{signal:AbortSignal.timeout(12000),cache:'no-store'});
        if(!response.ok)throw new Error('weather-unavailable');
        const value=await response.json();
        if(weatherId(value.code)==='unknown'||!Number.isFinite(value.temperature)||!Number.isFinite(value.observedAt)||!Number.isFinite(value.fetchedAt)||Math.abs(now()-value.observedAt)>90*60000||Math.abs(now()-value.fetchedAt)>MAX_AGE||typeof value.timezone!=='string'||!Array.isArray(value.sun))throw new Error('weather-unavailable');
        new Intl.DateTimeFormat('en',{timeZone:value.timezone});
        if(disposed)return;data=value;denied=false;status='ready';
      }catch(error){if(disposed)return;status='unavailable';denied=error.code===1;reason=denied?'location-denied':error.code===2||error.code===3||error.message==='location-unavailable'?'location-unavailable':'network';}
      finally{running=false;emit();}
    }
    function start(){if(disposed||timer!==null)return;void refresh();timer=every(()=>{if(!denied&&now()-lastAttempt>=REFRESH)void refresh();else emit();},60000);}
    return {snapshot,start,retry:refresh,destroy(){disposed=true;if(timer!==null)cancel(timer);timer=null;data=null;}};
  }
  function markup(value, language, escape){
    const en=language==='en',w=value||{status:'unavailable',weatherId:'unknown',timeId:timeId(Date.now()),now:Date.now()},name={clear:['晴朗','Clear'],cloudy:['多云','Cloudy'],fog:['雾','Fog'],rain:['降雨','Rain'],snow:['降雪','Snow'],storm:['雷雨','Thunderstorm'],unknown:['天气暂不可用','Weather unavailable']}[w.weatherId]||['天气暂不可用','Weather unavailable'];
    const time={dawn:['清晨','Dawn'],day:['白昼','Day'],dusk:['黄昏','Dusk'],night:['夜晚','Night']}[w.timeId];
    const clock=new Intl.DateTimeFormat(en?'en-GB':'zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',...(w.timezone?{timeZone:w.timezone}:{})}).format(w.now);
    const detail=w.status==='ready'?(en?'Device location · Updates automatically':'设备定位 · 自动更新'):w.status==='loading'?(en?'Getting local weather…':'正在获取当地天气…'):w.reason==='location-denied'?(en?'Allow location access in system or browser settings':'请在系统或浏览器设置中允许定位'):(en?'Location or network unavailable':'定位或网络暂不可用');
    return '<div class="fishing-live-weather" data-weather-status="'+escape(w.status)+'"><div><strong>'+escape(name[en?1:0])+(w.temperature!==null&&w.temperature!==undefined?' · '+Math.round(w.temperature)+'°C':'')+'</strong><span>'+escape(time[en?1:0]+' · '+clock)+'</span></div><small>'+escape(detail)+'</small>'+(w.status==='unavailable'?'<button type="button" data-fishing-action="refresh-weather">'+(en?'Retry location & weather':'重试定位与天气')+'</button>':'')+'<small class="fishing-weather-source">'+(en?'Weather: ':'天气：')+'<a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a></small></div>';
  }
  return {create,weatherId,timeId,markup};
});
