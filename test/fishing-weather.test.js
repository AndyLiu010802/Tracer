'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const W=require('../skins/tracer/fishing-weather'),{createWeatherService}=require('../lib/fishing-weather');
const at=Date.parse('2026-10-09T03:00:00Z');
const data=()=>({code:61,temperature:17.4,isDay:true,observedAt:at,fetchedAt:at,timezone:'Australia/Hobart',sun:[{rise:at-6*3600000,set:at+7*3600000}]});
test('WMO conditions retain rain, snow, fog and thunderstorms without inventing sunny weather',()=>{
  for(const [code,id]of [[0,'clear'],[3,'cloudy'],[45,'fog'],[65,'rain'],[75,'snow'],[99,'storm'],[-1,'unknown']])assert.equal(W.weatherId(code),id);
});
test('time follows local sunrise and sunset, including midnight and polar day',()=>{
  const d=data(),rise=d.sun[0].rise,set=d.sun[0].set;
  assert.equal(W.timeId(rise,d),'dawn');assert.equal(W.timeId(at,d),'day');assert.equal(W.timeId(set,d),'dusk');assert.equal(W.timeId(set+2*3600000,d),'night');
  assert.equal(W.timeId(at,{...d,sun:[{rise:null,set:null}]}),'day');
});
test('service validates coordinates, uses a fixed provider, rounds location and caches concurrent requests',async()=>{
  const calls=[];const service=createWeatherService({now:()=>at,fetch:async url=>{calls.push(url);return{ok:true,json:async()=>({current:{temperature_2m:12,weather_code:3,is_day:1,time:at/1000},timezone:'Australia/Hobart',daily:{sunrise:[at/1000-20000],sunset:[at/1000+20000]}})};}});
  for(const pair of [[null,0],['',0],[91,0],[0,181],['http://localhost',0]])await assert.rejects(service(...pair),/invalid-location/);
  const [a,b]=await Promise.all([service(-42.88245,147.3278),service(-42.88245,147.3278)]);assert.deepEqual(a,b);assert.equal(calls.length,1);
  assert.equal(calls[0].origin,'https://api.open-meteo.com');assert.equal(calls[0].searchParams.get('latitude'),'-42.88');assert.equal(a.code,3);
});
test('provider failures are not cached and stale observations are rejected',async()=>{
  let calls=0;const service=createWeatherService({now:()=>at,fetch:async()=>{calls++;return{ok:true,json:async()=>({current:{temperature_2m:12,weather_code:3,is_day:1,time:at/1000-7200},timezone:'UTC',daily:{sunrise:[],sunset:[]}})};}});
  await assert.rejects(service(0,0),/weather-stale/);await assert.rejects(service(0,0),/weather-stale/);assert.equal(calls,2);
});
function fixture({deny=false,fail=false}={}){
  let now=at,callback,locations=0,requests=0,cleared=0;const updates=[];
  const client=W.create({now:()=>now,onChange:w=>updates.push(w),setInterval:fn=>{callback=fn;return 1;},clearInterval:()=>cleared++,geolocation:{getCurrentPosition(ok,bad){locations++;if(deny)bad({code:1});else ok({coords:{latitude:-42.8824,longitude:147.3278}});}},fetch:async url=>{requests++;assert.match(url,/latitude=-42.88&longitude=147.33/);if(fail)throw Error('offline');return{ok:true,json:async()=>({...data(),observedAt:now,fetchedAt:now})};}});
  return{client,updates,advance:ms=>{now+=ms;callback();},stats:()=>({locations,requests,cleared}),fail:()=>fail=true};
}
const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
test('location weather and time refresh automatically; shutdown stops updates',async()=>{
  const f=fixture();f.client.start();await settle();assert.equal(f.client.snapshot().weatherId,'rain');assert.equal(f.stats().locations,1);
  f.advance(60000);assert.equal(f.stats().requests,1);assert.equal(f.client.snapshot().now,at+60000);
  f.advance(15*60000);await settle();assert.equal(f.stats().requests,2);f.client.destroy();assert.equal(f.stats().cleared,1);
});
test('denied location does not loop permission prompts, and unavailable weather is neutral',async()=>{
  const f=fixture({deny:true});f.client.start();await settle();const w=f.client.snapshot();assert.equal(w.status,'unavailable');assert.equal(w.reason,'location-denied');assert.equal(w.weatherId,'unknown');
  f.advance(60*60000);await settle();assert.equal(f.stats().locations,1);assert.equal(f.stats().requests,0);f.client.destroy();
});
test('losing the network stops presenting old conditions as current',async()=>{
  const f=fixture();await f.client.retry();assert.equal(f.client.snapshot().status,'ready');f.fail();await f.client.retry();assert.equal(f.client.snapshot().weatherId,'unknown');assert.equal(f.client.snapshot().temperature,null);
});
test('weather display has a real clock and no time or weather selectors',()=>{
  const html=W.markup({...data(),status:'ready',timeId:'day',weatherId:'rain',now:at},'zh',s=>String(s).replaceAll('<','&lt;'));
  assert.match(html,/降雨/);assert.match(html,/17°C/);assert.match(html,/14:00/);assert.doesNotMatch(html,/<select|set-expedition|weatherId=/);
});
