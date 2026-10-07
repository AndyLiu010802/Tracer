'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'../..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
const server=http.createServer((req,res)=>{
  let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  if(url==='/')url='/design/dynamic-wallpapers-v2/index.html';
  const allowed=/^\/design\/dynamic-wallpapers-v2\/(index\.html|catalog\.js)$/.test(url)||/^\/skins\/tracer\/(wallpaper-(flow|motion)\.js|wallpapers\/dynamic-\d{2}-v2\.png)$/.test(url);
  if(!allowed||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end();return;}
  fs.readFile(path.join(root,url),(error,bytes)=>{if(error){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(url)],'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:bytes);});
});server.listen(0,'127.0.0.1',()=>console.log('Preview: http://127.0.0.1:'+server.address().port+'/design/dynamic-wallpapers-v2/index.html\nCtrl+C to close.'));
