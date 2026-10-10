(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerFishingVFXInbetweens=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Build once, outside the animation thread. The original six paintings remain
  // the endpoints; bidirectional registration moves their contours in between.
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function sample(data,n,x,y,out){
    if(x<0||y<0||x>n-1||y>n-1){out.fill(0);return out;}
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    const a=(iy*n+ix)*4,b=(iy*n+Math.min(n-1,ix+1))*4,c=(Math.min(n-1,iy+1)*n+ix)*4,d=(Math.min(n-1,iy+1)*n+Math.min(n-1,ix+1))*4;
    for(let k=0;k<4;k++)out[k]=data[a+k]*(1-fx)*(1-fy)+data[b+k]*fx*(1-fy)+data[c+k]*(1-fx)*fy+data[d+k]*fx*fy;
    return out;
  }
  function features(data,n,size){
    const out=new Float32Array(size*size*4),v=new Float32Array(4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      sample(data,n,(x+.5)*n/size-.5,(y+.5)*n/size-.5,v);
      const j=(y*size+x)*4;out[j]=v[3];out[j+1]=v[0]*.45;out[j+2]=v[1]*.45;out[j+3]=v[2]*.45;
    }return out;
  }
  function moments(data,n){
    let mass=0,x=0,y=0,xx=0,yy=0;
    for(let i=0;i<n*n;i++){const a=data[i*4+3],px=i%n,py=Math.floor(i/n);mass+=a;x+=px*a;y+=py*a;xx+=px*px*a;yy+=py*py*a;}
    if(mass<.001)return{x:(n-1)/2,y:(n-1)/2,sx:n/6,sy:n/6,mass};
    x/=mass;y/=mass;return{x,y,sx:Math.sqrt(Math.max(4,xx/mass-x*x)),sy:Math.sqrt(Math.max(4,yy/mass-y*y)),mass};
  }
  function flow(a,b,n){
    const size=40,grid=11,fa=features(a,n,size),fb=features(b,n,size),ma=moments(fa,size),mb=moments(fb,size);
    const sx=clamp(mb.sx/ma.sx,.65,1.55),sy=clamp(mb.sy/ma.sy,.65,1.55),field=new Float32Array(grid*grid*2);
    for(let gy=0;gy<grid;gy++)for(let gx=0;gx<grid;gx++){
      const x=gx*(size-1)/(grid-1),y=gy*(size-1)/(grid-1),baseX=clamp(mb.x+(x-ma.x)*sx-x,-size*.35,size*.35),baseY=clamp(mb.y+(y-ma.y)*sy-y,-size*.35,size*.35);
      let best=Infinity,dx=baseX,dy=baseY;
      // Small patches retain the silhouette while regularization keeps fingers,
      // blades and thin trails from folding around unrelated bright pixels.
      for(let oy=-5;oy<=5;oy++)for(let ox=-5;ox<=5;ox++){
        const tx=baseX+ox,ty=baseY+oy;let cost=(ox*ox+oy*oy)*.0028;
        for(let py=-2;py<=2;py++)for(let px=-2;px<=2;px++){
          const ax=Math.round(x+px),ay=Math.round(y+py),bx=Math.round(x+px+tx),by=Math.round(y+py+ty);
          const ia=(ay*size+ax)*4,ib=(by*size+bx)*4,insideA=ax>=0&&ay>=0&&ax<size&&ay<size,insideB=bx>=0&&by>=0&&bx<size&&by<size;
          for(let k=0;k<4;k++){const delta=(insideA?fa[ia+k]:0)-(insideB?fb[ib+k]:0);cost+=delta*delta;}
        }
        if(cost<best){best=cost;dx=tx;dy=ty;}
      }
      const i=(gy*grid+gx)*2;field[i]=dx*n/size;field[i+1]=dy*n/size;
    }
    for(let pass=0;pass<2;pass++){
      const copy=field.slice();
      for(let y=0;y<grid;y++)for(let x=0;x<grid;x++)for(let k=0;k<2;k++){
        let sum=copy[(y*grid+x)*2+k]*4,weight=4;
        for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]])if(x+dx>=0&&x+dx<grid&&y+dy>=0&&y+dy<grid){sum+=copy[((y+dy)*grid+x+dx)*2+k];weight++;}
        field[(y*grid+x)*2+k]=sum/weight;
      }
    }
    return{field,grid,n};
  }
  function vector(f,x,y,out){
    const {field,grid,n}=f,px=clamp(x/(n-1)*(grid-1),0,grid-1),py=clamp(y/(n-1)*(grid-1),0,grid-1),ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy;
    const a=(iy*grid+ix)*2,b=(iy*grid+Math.min(grid-1,ix+1))*2,c=(Math.min(grid-1,iy+1)*grid+ix)*2,d=(Math.min(grid-1,iy+1)*grid+Math.min(grid-1,ix+1))*2;
    for(let k=0;k<2;k++)out[k]=field[a+k]*(1-fx)*(1-fy)+field[b+k]*fx*(1-fy)+field[c+k]*(1-fx)*fy+field[d+k]*fx*fy;
  }
  function morph(a,b,n,t,forward,backward){
    if(t<=0)return a.slice();if(t>=1)return b.slice();
    const out=new Float32Array(a.length),va=new Float32Array(4),vb=new Float32Array(4),v=new Float32Array(2);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      let ax=x,ay=y,bx=x,by=y;
      // Invert each deformation rather than forward-splatting: no holes.
      for(let k=0;k<3;k++){vector(forward,ax,ay,v);ax=x-t*v[0];ay=y-t*v[1];vector(backward,bx,by,v);bx=x-(1-t)*v[0];by=y-(1-t)*v[1];}
      sample(a,n,ax,ay,va);sample(b,n,bx,by,vb);
      const i=(y*n+x)*4;for(let k=0;k<4;k++)out[i+k]=va[k]*(1-t)+vb[k]*t;
    }return out;
  }
  function constrainJoint(field,from,to){
    if(!from||!to)return;
    const {grid,n}=field,ratio=to[2]/from[2];
    for(let gy=0;gy<grid;gy++)for(let gx=0;gx<grid;gx++){
      const u=gx/(grid-1),v=gy/(grid-1),distance=Math.max(Math.max(0,u-from[0])/.25,Math.abs(v-from[1])/.23),weight=1-clamp((distance-.60)/.65,0,1),i=(gy*grid+gx)*2;
      const dx=(to[0]-from[0])*n,dy=((to[1]-from[1])+(v-from[1])*(ratio-1))*n;
      field.field[i]=field.field[i]*(1-weight)+dx*weight;field.field[i+1]=field.field[i+1]*(1-weight)+dy*weight;
    }
  }
  function bake({data,width,height,size=192,steps=6,joints}){
    if(!data||width%3||height%2||width/3!==height/2||data.length!==width*height*4)throw Error('Expected a six-cell RGBA effect atlas');
    if(!Number.isInteger(size)||size<16||size>256||!Number.isInteger(steps)||steps<2||steps>12)throw Error('Invalid inbetween resolution');
    const sourceSize=width/3,frames=[],pixel=new Float32Array(4);
    for(let f=0;f<6;f++){
      const source=new Float32Array(sourceSize*sourceSize*4);
      for(let y=0;y<sourceSize;y++)for(let x=0;x<sourceSize;x++){
        const i=(y*sourceSize+x)*4,j=((Math.floor(f/3)*sourceSize+y)*width+(f%3)*sourceSize+x)*4,alpha=data[j+3]/255;
        source[i]=data[j]/255*alpha;source[i+1]=data[j+1]/255*alpha;source[i+2]=data[j+2]/255*alpha;source[i+3]=alpha;
      }
      const frame=new Float32Array(size*size*4);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){sample(source,sourceSize,(x+.5)*sourceSize/size-.5,(y+.5)*sourceSize/size-.5,pixel);frame.set(pixel,(y*size+x)*4);}
      frames.push(frame);
    }
    const count=5*steps+1,columns=8,rows=Math.ceil(count/columns),outWidth=columns*size,outHeight=rows*size,output=new Uint8ClampedArray(outWidth*outHeight*4);
    function write(frame,index){
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const i=(y*size+x)*4,j=((Math.floor(index/columns)*size+y)*outWidth+(index%columns)*size+x)*4,a=frame[i+3];
        if(a>1/510){output[j]=frame[i]/a*255;output[j+1]=frame[i+1]/a*255;output[j+2]=frame[i+2]/a*255;output[j+3]=a*255;}
      }
    }
    for(let f=0;f<5;f++){
      const a=frames[f],b=frames[f+1],forward=flow(a,b,size),backward=flow(b,a,size);
      constrainJoint(forward,joints?.[f],joints?.[f+1]);constrainJoint(backward,joints?.[f+1],joints?.[f]);
      for(let i=0;i<steps;i++)write(morph(a,b,size,i/steps,forward,backward),f*steps+i);
    }
    write(frames[5],count-1);return{data:output,width:outWidth,height:outHeight,size,steps,count,columns};
  }
  return{bake,flow,morph,moments};
});
