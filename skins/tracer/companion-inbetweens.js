(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerCompanionInbetweens=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Local block correspondences move articulated details between two registered
  // drawings. No crossfade, whole-image translation, or per-frame fit-to-box.
  function midpoint(a,b,width,height,progress=.5){
    const spacing=8,columns=Math.ceil(width/spacing)+1,rows=Math.ceil(height/spacing)+1;
    const field=new Float32Array(columns*rows*2);
    const value=(data,x,y,c)=>x<0||y<0||x>=width||y>=height?0:data[(y*width+x)*4+c];
    const sample=(data,x,y,c)=>{const alpha=value(data,x,y,3);return c===3?alpha:value(data,x,y,c)*alpha/255;};
    for(let gy=0;gy<rows;gy++)for(let gx=0;gx<columns;gx++){
      const x=Math.min(width-1,gx*spacing),y=Math.min(height-1,gy*spacing);
      let best=Infinity,bx=0,by=0;
      for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++){
        let cost=(dx*dx+dy*dy)*8;
        for(let py=-2;py<=2;py+=2)for(let px=-2;px<=2;px+=2)for(let c=0;c<4;c++)
          cost+=Math.abs(sample(a,x+px,y+py,c)-sample(b,x+px+dx,y+py+dy,c));
        if(cost<best){best=cost;bx=dx;by=dy;}
      }
      const index=(gy*columns+gx)*2;field[index]=bx;field[index+1]=by;
    }
    const out=new Uint8ClampedArray(a.length);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const gx=Math.floor(x/spacing),gy=Math.floor(y/spacing),fx=x/spacing-gx,fy=y/spacing-gy;
      const flow=c=>field[(gy*columns+gx)*2+c]*(1-fx)*(1-fy)+field[(gy*columns+gx+1)*2+c]*fx*(1-fy)+field[((gy+1)*columns+gx)*2+c]*(1-fx)*fy+field[((gy+1)*columns+gx+1)*2+c]*fx*fy;
      const dx=flow(0),dy=flow(1),ax=Math.round(x-dx*progress),ay=Math.round(y-dy*progress),bx=Math.round(x+dx*(1-progress)),by=Math.round(y+dy*(1-progress)),target=(y*width+x)*4;
      // Keep one coherent drawing, including its silhouette. Mixing whichever
      // source is more opaque at each pixel creates stippled faces and halos.
      const useA=progress<=.5,data=useA?a:b,sx=useA?ax:bx,sy=useA?ay:by;
      for(let c=0;c<4;c++)out[target+c]=value(data,sx,sy,c);
    }
    return out;
  }
  function create(doc,image,sheet,scaleBasis){
    const width=192,height=212,ratio=width/160,canvas=doc.createElement('canvas');
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext?.('2d',{willReadFrequently:true});if(!ctx)return null;
    ctx.imageSmoothingEnabled=false;
    const pixels=new Map(),urls=new Map();
    function source(frame){
      if(pixels.has(frame))return pixels.get(frame);
      const cell=sheet.cells[frame],scale=scaleBasis/sheet.width*ratio;
      ctx.clearRect(0,0,width,height);
      ctx.drawImage(image,cell.x,cell.y,cell.w,cell.h,(80+(cell.x-cell.rootX)*scale/ratio)*ratio,(151+(cell.y-cell.rootY)*scale/ratio)*ratio,cell.w*scale,cell.h*scale);
      const data=ctx.getImageData(0,0,width,height).data;pixels.set(frame,data);return data;
    }
    return{url(frame,next,progress=.5){
      const key=frame+':'+next+':'+progress;if(urls.has(key))return urls.get(key);
      const result=ctx.createImageData(width,height);result.data.set(midpoint(source(frame),source(next),width,height,progress));ctx.putImageData(result,0,0);
      const url=canvas.toDataURL('image/png');urls.set(key,url);
      // Only neighboring source arrays are needed; encoded midpoints are shared.
      for(const at of pixels.keys())if(at!==frame&&at!==next)pixels.delete(at);
      return url;
    }};
  }
  return{midpoint,create};
});
