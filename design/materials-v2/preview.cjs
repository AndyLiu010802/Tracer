// Local, read-only preview. Run with Node; Ctrl+C closes the server.
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
const server=http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
  if(pathname==='/')pathname='/design/materials-v2/index.html';
  const allowed=pathname==='/design/materials-v2/index.html'||/^\/skins\/tracer\/(wallpaper-(shop\.css|materials\.css|optics\.js)|wallpapers\/dynamic-\d{2}-v2\.png)$/.test(pathname);
  if(!allowed||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end();return;}
  const file=path.join(root,pathname);fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)],'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:bytes);});
});
server.listen(0,'127.0.0.1',()=>console.log('Material preview: http://127.0.0.1:'+server.address().port+'/design/materials-v2/index.html\nCtrl+C to close.'));
