/* Dependency-free interaction simulator. NOT the production Three.js renderer.
 * Orthographic projection is used only to review interaction behavior offline.
 * Keep the production renderer behind the supplied renderer-port.ts interface.
 */
(function () {
  'use strict';
  const categories = { TypeScript: '#769fbc', Vue: '#76b5a4', Tests: '#a294bd', Test: '#a294bd' };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function tint(hex, amount) {
    const rgb = hex.match(/[0-9a-f]{2}/gi).map(n => parseInt(n, 16));
    return `rgb(${rgb.map(n => clamp(Math.round(n * amount), 0, 255)).join(',')})`;
  }
  function inside(x, y, points) {
    let hit = false;
    for (let i=0,j=points.length-1;i<points.length;j=i++) {
      const a=points[i], b=points[j];
      if ((a.y>y)!==(b.y>y) && x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) hit=!hit;
    }
    return hit;
  }
  class ReviewCity {
    constructor(canvas, files, getState, onCamera, onSelect) {
      this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.files=files;
      this.getState=getState; this.onCamera=onCamera; this.onSelect=onSelect;
      this.abort=new AbortController(); this.hitFaces=[]; this.pending=0; this.disposed=false;
      const groups=[...new Set(files.map(f=>f.group))];
      this.groups=groups.map((name,index)=>({name,x:(index%3-1)*18,z:(Math.floor(index/3)-.5)*16}));
      this.positions=new Map(files.map(f=>{const g=this.groups.find(g=>g.name===f.group);
        return [f.id,{ x:g.x+(f.j%6-2.5)*2.45, z:g.z+(Math.floor(f.j/6)-1.5)*2.45,
          h:.18+Math.sqrt(Math.max(0,f.lines||0))*.25 }]; }));
      const listen=(type, fn, options={})=>canvas.addEventListener(type,fn,{...options,signal:this.abort.signal});
      listen('pointerdown',e=>{
        if(e.button!==0&&e.button!==2)return; canvas.focus({preventScroll:true});
        this.down={x:e.clientX,y:e.clientY,camera:{...getState().camera},button:e.button,
          pan:e.button===2||e.shiftKey||e.ctrlKey||e.metaKey,moved:false};
        canvas.setPointerCapture(e.pointerId);
      });
      listen('pointermove',e=>{
        if(!this.down)return;
        const dx=e.clientX-this.down.x,dy=e.clientY-this.down.y;
        if(Math.hypot(dx,dy)>5)this.down.moved=true;
        if(!this.down.moved)return;
        const c=this.down.camera;
        if(this.down.pan||getState().mode==='top') {
          const scale=this.scale||10;
          onCamera({x:c.x-dx/scale*Math.cos(c.yaw)+dy/scale*Math.sin(c.yaw),
            z:c.z+dx/scale*Math.sin(c.yaw)+dy/scale*Math.cos(c.yaw)});
        } else onCamera({yaw:c.yaw-dx*.006,pitch:clamp(c.pitch+dy*.005,.28,1.42)});
      });
      listen('pointerup',e=>{
        if(!this.down)return;
        const click=!this.down.moved&&this.down.button===0;
        this.down=null;
        if(click){const r=canvas.getBoundingClientRect();const hit=this.pick(e.clientX-r.left,e.clientY-r.top);if(hit)onSelect(hit);}
      });
      listen('pointercancel',()=>{this.down=null;});
      listen('lostpointercapture',()=>{this.down=null;});
      listen('contextmenu',e=>e.preventDefault());
      listen('wheel',e=>{
        if(canvas.ownerDocument.activeElement!==canvas)return;
        e.preventDefault();onCamera({zoom:clamp(getState().camera.zoom*(e.deltaY<0?1.12:1/1.12),.3,6)});
      },{passive:false});
      this.observer=new ResizeObserver(()=>this.invalidate());this.observer.observe(canvas);
      this.invalidate();
    }
    invalidate(){if(!this.disposed&&!this.pending)this.pending=requestAnimationFrame(()=>{this.pending=0;this.draw();});}
    pick(x,y){for(let i=this.hitFaces.length-1;i>=0;i--){if(inside(x,y,this.hitFaces[i].points))return this.hitFaces[i].id;}return null;}
    position(id){const p=this.positions.get(id);return p?{x:p.x,y:p.h/2,z:p.z}:null;}
    project(p,c,w,h) {
      const x=p.x-c.x,y=p.y-c.y,z=p.z-c.z;
      const cy=Math.cos(c.yaw),sy=Math.sin(c.yaw),cp=Math.cos(c.pitch),sp=Math.sin(c.pitch);
      return {x:w/2+(x*cy-z*sy)*this.scale,
        y:h*.51-(-x*sy*sp+y*cp-z*cy*sp)*this.scale,
        depth:x*sy*cp+y*sp+z*cy*cp};
    }
    draw() {
      const rect=this.canvas.getBoundingClientRect(),w=rect.width,h=rect.height;
      if(w<=0||h<=0||this.disposed)return;
      const dpr=Math.min(devicePixelRatio||1,2);
      if(this.canvas.width!==Math.round(w*dpr)||this.canvas.height!==Math.round(h*dpr)){
        this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);
      }
      const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
      const state=this.getState(),c=state.camera;
      this.scale=Math.min(w/64,h/48)*c.zoom;
      const light=document.body.dataset.theme==='light';
      const project=p=>this.project(p,c,w,h);
      const polygon=(pts,fill,stroke=null)=>{ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}};
      for(const g of this.groups){
        const points=[[-8,-6],[8,-6],[8,6],[-8,6]].map(([x,z])=>project({x:x+g.x,y:-.15,z:z+g.z}));
        polygon(points,light?'#e2e5ed':'#303137',light?'#ced3dd':'#41434c');
      }
      const faces=[];
      for(const f of this.files){
        const p=this.positions.get(f.id),a=.87;
        const verts=[[-a,0,-a],[a,0,-a],[a,0,a],[-a,0,a],[-a,p.h,-a],[a,p.h,-a],[a,p.h,a],[-a,p.h,a]].map(([x,y,z])=>project({x:x+p.x,y,z:z+p.z}));
        const dim=!CIModel.matches(f,state.query);let color=categories[f.category]||'#92a0ad';
        if(dim)color=light?'#d8dae0':'#363a43';
        const faceDefs=[[[4,5,6,7],1.13],[[0,1,5,4],.67],[[1,2,6,5],.88],[[2,3,7,6],.79],[[3,0,4,7],.91]];
        for(const [indices,shade] of faceDefs){const points=indices.map(i=>verts[i]);faces.push({id:f.id,points,depth:points.reduce((s,p)=>s+p.depth,0)/4,fill:tint(color,shade)});}
      }
      faces.sort((a,b)=>a.depth-b.depth);this.hitFaces=faces;
      for(const f of faces)polygon(f.points,f.fill);
      if(state.selectedId&&this.positions.has(state.selectedId)){
        const p=this.positions.get(state.selectedId),roof=[[-.98,-.98],[.98,-.98],[.98,.98],[-.98,.98]].map(([x,z])=>project({x:x+p.x,y:p.h+.1,z:z+p.z}));
        ctx.beginPath();roof.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.lineWidth=2.5;ctx.strokeStyle=light?'#634698':'#d4bdff';ctx.stroke();
        const pin=project({x:p.x,y:p.h+.65,z:p.z});ctx.beginPath();ctx.arc(pin.x,pin.y,4,0,Math.PI*2);ctx.fillStyle=light?'#634698':'#d4bdff';ctx.fill();
      }
      ctx.textAlign='center';ctx.font='11px system-ui';
      for(const g of this.groups){const p=project({x:g.x,y:.05,z:g.z+7.15});const tw=ctx.measureText(g.name).width;
        if(p.x<-tw||p.x>w+tw||p.y<0||p.y>h)continue;
        ctx.fillStyle=light?'#ffffffed':'#202125ee';ctx.fillRect(p.x-tw/2-7,p.y-10,tw+14,22);
        ctx.fillStyle=light?'#393642':'#d3d3de';ctx.fillText(g.name,p.x,p.y+5);
      }
      this.frames=(this.frames||0)+1;
    }
    dispose(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.pending);this.abort.abort();this.observer.disconnect();this.hitFaces=[];}
  }
  window.CIReviewCity=ReviewCity;
})();
