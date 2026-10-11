(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TracerGardenTerrain3D=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TAU=Math.PI*2,regions=['meadow','coast','sakura','alpine','dunes','cyber'],roots=[[-1.03,.22],[-.02,.28],[.99,.35],[-1.02,.88],[-.04,.94],[.93,.95]],rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
  function add(b,farm){
    const region=Math.max(0,regions.indexOf(farm));let seed=8147+region*193;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;},rim=a=>1+.052*Math.sin(a*5)+.022*Math.cos(a*9);
    function heightAt(x,z){const pond=Math.hypot((x+.99)/.74,(z+.49)/.49),house=Math.hypot((x-.87)/.48,(z+.76)/.4);let h=.045+.018*Math.sin(x*3.4+z*2.1)+.018*Math.cos(z*5-x);if(pond<1.05)h=.029;if(house<1.1)h=.047;return h;}
    const rad=(a,r,y)=>[Math.cos(a)*2*r*rim(a),y,Math.sin(a)*1.37*r*rim(a)],surface=(a,r)=>{const p=rad(a,r,0);p[1]=heightAt(p[0],p[2]);return p;};
    // Dense, gently undulating ground uses a continuous painterly material. Its
    // irregular boundary is shared with the cliff, so there is no visible seam.
    const n=96,steps=24;
    for(let j=0;j<steps;j++)for(let i=0;i<n;i++){const a=i/n*TAU,d=(i+1)/n*TAU,r=j/steps,s=(j+1)/steps,c=[-7-region,1,0],v=surface(a,r),w=surface(d,r),x=surface(a,s),y=surface(d,s);b.tri(v,w,x,c);b.tri(w,y,x,c);}
    const layers=[[1,0],[1.012,-.14],[.95,-.38],[.78,-.63],[.32,-.82]];
    for(let k=0;k<layers.length-1;k++)for(let i=0;i<n;i++){const a=i/n*TAU,d=(i+1)/n*TAU,point=(a,k)=>{const [r,h]=layers[k],p=rad(a,r,k?h+Math.sin(a*7+k)*.018:0);if(!k)p[1]=heightAt(p[0],p[2]);return p;},v=point(a,k),w=point(d,k),x=point(a,k+1),y=point(d,k+1),c=[-13,.96-k*.025,region];b.tri(v,x,w,c);b.tri(w,x,y,c);}
    // Pond edge varies in width, elevation and stone spacing rather than a ring
    // of identical beads. Grass and moss overlap the shore in small groups.
    const pond=(a,r)=>[-.99+Math.cos(a)*.61*r*(1+.07*Math.sin(a*3)),.055,-.49+Math.sin(a)*.355*r*(1+.07*Math.cos(a*5))];
    for(let i=0;i<64;i++){const a=i/64*TAU,d=(i+1)/64*TAU;b.tri([-.99,.055,-.49],pond(a,1),pond(d,1),[-14,.9,region]);}
    for(let i=0;i<27;i++){const a=i/27*TAU,q=pond(a,1.08);if(i%6===2)continue;const size=.034+rnd()*.052;b.ellipsoid([q[0],.043+rnd()*.03,q[2]],[size,.025+rnd()*.02,size*(.7+rnd()*.4)],[-5,.88+rnd()*.18,0],9,5);}
    for(const [x,z,s]of [[-1.15,-.62,.055],[-.87,-.3,.065],[-.73,-.56,.037]]){b.ellipsoid([x,.065,z],[s,.005,s*.78],rgb('#83a789'),12,3);if(s>.06)b.ellipsoid([x+.009,.08,z],[.023,.015,.023],rgb('#e2c1bc'),8,4);}
    for(let i=0;i<11;i++){const z=1.12-i*.17,x=.4+.07*Math.sin(i*.8);b.ellipsoid([x,heightAt(x,z)+.006,z],[.087+rnd()*.02,.015,.065],[-5,.96+rnd()*.08,0],7,3);}for(let i=0;i<3;i++){const x=.52+i*.13,z=-.43-i*.025;b.ellipsoid([x,heightAt(x,z)+.01,z],[.068,.019,.07],[-5,1,0],7,3);}
    for(let i=0;i<180;i++){const a=rnd()*TAU,r=.80+rnd()*.18,x=Math.cos(a)*2*r*rim(a),z=Math.sin(a)*1.37*r*rim(a),y=heightAt(x,z);if(farm==='dunes'&&i%4)continue;const c=rgb(farm==='alpine'?'#a6bdb0':farm==='coast'?'#8a9f68':farm==='cyber'?'#648784':'#76985d');for(let j=0;j<2;j++)b.leaf([x,y,z],[x+(rnd()-.5)*.09,y+.055+rnd()*.055,z+(rnd()-.5)*.08],.013,c);if(i%13===0)b.ellipsoid([x,y+.10,z],[.023,.012,.023],rgb(farm==='sakura'?'#e8b9c4':'#d6c99b'),6,3);}
    for(let i=0;i<15;i++){const a=i/15*TAU+rnd()*.19;let prev=rad(a,1,-.015);for(let j=0;j<5;j++){const q=rad(a+Math.sin(j)*.01,1-j*.027,-.06-j*.078);b.stem(prev,q,.006,.005,rgb('#6e8760'),5);b.leaf(q,[q[0]+.048,q[1]-.04,q[2]+.025],.029,rgb(farm==='alpine'?'#8caaa0':'#76936b'));prev=q;}}
    return{heightAt,roots:roots.map(([x,z])=>[x,heightAt(x,z)+.01,z])};
  }
  return{add,regions,texture:'/garden-art/terrain-materials-v1.png'};
});
