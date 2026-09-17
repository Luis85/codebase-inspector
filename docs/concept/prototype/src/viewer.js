/*
 * Codebase Inspector — reusable Three.js viewer.
 * Three.js r140 is the pinned demo runtime. No remote assets, loaders, source execution,
 * host globals, analyzer access, or automatic animation loop are used.
 */
(function (root) {
  'use strict';
  const T = root.THREE, M = root.CIModel;
  const PALETTE = {TypeScript:'#79a8dc',JavaScript:'#d7ba76',Vue:'#78c4ad',Tests:'#b19bd7',Styles:'#d9a38c',JSON:'#d0bf8a',Markdown:'#9ba9bc',Other:'#8c98ae'};
  const THEME = {
    dark:{background:'#181c26',floor:'#1c212c',platform:'#2c3443',rim:'#48566b',grid:'#303b4e',dim:'#303747',accent:'#cab5ff'},
    light:{background:'#e9edf3',floor:'#e0e6ee',platform:'#d4dde9',rim:'#adbcd2',grid:'#ccd6e4',dim:'#bec9d8',accent:'#8654d3'}
  };
  const clamp=T.MathUtils.clamp;
  function linear(hex) {return new T.Color(hex).convertSRGBToLinear();}
  function cappedHeight(f,metric) {return Math.min(18,M.heightFor(f,metric));}
  class CityViewer {
    constructor({canvas,labels,onSelect=()=>{},onHover=()=>{},onCameraChange=()=>{},onContextLost=()=>{},onContextRestored=()=>{},onRendered=()=>{}}) {
      if (!(canvas instanceof canvas.ownerDocument.defaultView.HTMLCanvasElement)) throw new Error('A canvas element is required.');
      this.canvas=canvas; this.labels=labels; this.win=canvas.ownerDocument.defaultView;
      this.onSelect=onSelect;this.onHover=onHover;this.onCameraChange=onCameraChange;this.onContextLost=onContextLost;this.onContextRestored=onContextRestored;this.onRendered=onRendered;
      this.disposed=false;this.suspended=false;this.contextLost=false;this.theme='dark';this.mode='3d';this.metric='lines';this.selectedId=null;this.matches=null;this.showLabels=true;this.shadows=true;this.frame=null;this.frameCount=0;this.listeners=[];this.pointers=new Map();this.dragged=false;this.theta=Math.PI*.24;this.phi=Math.PI*.29;this.radius=120;this.target=new T.Vector3(0,1.5,0);this.halfHeight=24;this.saved3d=null;
      // Request WebGL2 explicitly: failure is an honest HTML-inventory fallback.
      const context=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:false});
      if (!context) throw new Error('WebGL 2 is unavailable. Enable graphics acceleration or use the HTML file inventory.');
      this.renderer=new T.WebGLRenderer({canvas,context,antialias:true,alpha:false,powerPreference:'low-power'});
      this.renderer.setPixelRatio(Math.min(this.win.devicePixelRatio||1,1.75));
      this.renderer.outputEncoding=T.sRGBEncoding;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.0;
      this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.shadowMap.autoUpdate=false;
      this.scene=new T.Scene();this.camera=new T.OrthographicCamera(-24,24,24,-24,.1,3000);
      this.world=new T.Group();this.scene.add(this.world);
      this.ambient=new T.HemisphereLight(0xdce8ff,0x3c4664,.8);this.scene.add(this.ambient);
      this.sun=new T.DirectionalLight(0xffffff,1.2);this.sun.position.set(-28,60,28);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);this.sun.shadow.camera.left=-65;this.sun.shadow.camera.right=65;this.sun.shadow.camera.top=65;this.sun.shadow.camera.bottom=-65;this.sun.shadow.camera.near=.1;this.sun.shadow.camera.far=180;this.sun.shadow.bias=-.00015;this.sun.shadow.normalBias=.03;this.scene.add(this.sun);
      this.fill=new T.DirectionalLight(0xb7c8ff,.3);this.fill.position.set(35,16,-20);this.scene.add(this.fill);
      this.raycaster=new T.Raycaster();this.mouse=new T.Vector2();this.tmpMatrix=new T.Matrix4();this.tmpObject=new T.Object3D();this.labelRecords=[];
      this._bind();this.resizeObserver=new this.win.ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);
      this.setTheme('dark');this._pose();this.resize();
    }
    _listen(target,type,handler,options) {target.addEventListener(type,handler,options);this.listeners.push(()=>target.removeEventListener(type,handler,options));}
    _bind() {
      this._listen(this.canvas,'contextmenu',e=>e.preventDefault());
      this._listen(this.canvas,'pointerdown',e=>{
        if (this.suspended||this.contextLost||e.button>2) return;
        this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(e.pointerId);
        this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,button:e.button});
        if (this.pointers.size===1){this.dragged=false;this.multiGesture=false;} else {this.dragged=true;this.multiGesture=true;}
        this.onHover(null);e.preventDefault();
      });
      this._listen(this.canvas,'pointermove',e=>{
        const old=this.pointers.get(e.pointerId);
        if (!old) {if (!this.contextLost&&!this.suspended) this.onHover(this.pick(e.clientX,e.clientY),{x:e.clientX,y:e.clientY});return;}
        const before=[...this.pointers.values()].map(p=>({...p}));const dx=e.clientX-old.x,dy=e.clientY-old.y;
        const distance=Math.hypot(e.clientX-old.sx,e.clientY-old.sy);if(distance>5)this.dragged=true;
        old.x=e.clientX;old.y=e.clientY;
        if(this.pointers.size>=2){
          const after=[...this.pointers.values()];const bdist=Math.hypot(before[0].x-before[1].x,before[0].y-before[1].y),adist=Math.hypot(after[0].x-after[1].x,after[0].y-after[1].y);
          if(bdist>1&&adist>1)this.zoom(adist/bdist);
          this.pan((after[0].x+after[1].x-before[0].x-before[1].x)/2,(after[0].y+after[1].y-before[0].y-before[1].y)/2);
        } else if(this.dragged) {
          if(e.shiftKey||e.ctrlKey||e.metaKey||old.button===2||this.mode==='top')this.pan(dx,dy);
          else if(old.button===1)this.zoom(Math.exp(-dy*.012));
          else this.orbit(-dx*.007,-dy*.006);
        }
      });
      this._listen(this.canvas,'pointerup',e=>{
        const p=this.pointers.get(e.pointerId);if(!p)return;
        if(!this.dragged&&!this.multiGesture&&p.button===0&&Math.hypot(e.clientX-p.sx,e.clientY-p.sy)<=5){const f=this.pick(e.clientX,e.clientY);if(f)this.onSelect(f.id);}
        this.pointers.delete(e.pointerId);if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);
      });
      const cancel=e=>{this.pointers.delete(e.pointerId);this.dragged=true;};
      this._listen(this.canvas,'pointercancel',cancel);this._listen(this.canvas,'lostpointercapture',cancel);
      this._listen(this.canvas,'pointerleave',()=>{if(!this.pointers.size)this.onHover(null);});
      this._listen(this.canvas,'wheel',e=>{
        if(this.canvas.ownerDocument.activeElement!==this.canvas||this.contextLost||this.suspended)return;
        e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?this.height:1;this.zoom(Math.exp(-clamp(e.deltaY*unit,-150,150)*.0035));
      },{passive:false});
      this._listen(this.canvas,'webglcontextlost',e=>{e.preventDefault();this.contextLost=true;if(this.frame!==null)this.win.cancelAnimationFrame(this.frame);this.frame=null;this.onContextLost();});
      this._listen(this.canvas,'webglcontextrestored',()=>{this.contextLost=false;this.renderer.shadowMap.needsUpdate=true;this.onContextRestored();this.invalidate();});
      this._listen(this.canvas.ownerDocument,'visibilitychange',()=>{if(this.canvas.ownerDocument.hidden){if(this.frame!==null)this.win.cancelAnimationFrame(this.frame);this.frame=null;}else this.invalidate();});
    }
    _disposeWorld() {
      const geometries=new Set(),materials=new Set();
      this.world.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
      this.world.clear();this.labelRecords=[];this.labels.replaceChildren();this.buildings=null;
    }
    loadSnapshot(snapshot,{fit=true}={}) {
      this.snapshot=snapshot;this.layout=M.buildLayout(snapshot);this.byId=new Map(snapshot.files.map(f=>[f.id,f]));
      this._disposeWorld();const {width,depth,districts,positions}=this.layout;
      const theme=THEME[this.theme];this.radius=Math.max(120,Math.max(width,depth)*3);this.camera.far=this.radius*6;
      const floorG=new T.PlaneGeometry(Math.max(width+35,75),Math.max(depth+35,75));const floorM=new T.ShadowMaterial({color:0x000000,opacity:this.theme==='light'?.12:.24});
      this.floor=new T.Mesh(floorG,floorM);this.floor.rotation.x=-Math.PI/2;this.floor.position.y=-.39;this.floor.receiveShadow=true;this.world.add(this.floor);
      this.grid=new T.GridHelper(Math.max(width,depth)+22,Math.max(16,Math.round((Math.max(width,depth)+22)/2)),linear(theme.grid),linear(theme.grid));this.grid.position.y=-.38;this.grid.material.transparent=true;this.grid.material.opacity=.3;this.world.add(this.grid);
      const platformG=new T.BoxGeometry(1,1,1);this.platformM=new T.MeshStandardMaterial({color:linear(theme.platform),roughness:.85,metalness:.05});this.rimM=new T.LineBasicMaterial({color:linear(theme.rim),transparent:true,opacity:.65});const edgeG=new T.EdgesGeometry(platformG);
      districts.forEach((g,i)=>{
        const platform=new T.Mesh(platformG,this.platformM);platform.position.set(g.x,-.13,g.z);platform.scale.set(g.width,.35,g.depth);platform.receiveShadow=true;this.world.add(platform);
        const rim=new T.LineSegments(edgeG,this.rimM);rim.position.copy(platform.position);rim.scale.copy(platform.scale);this.world.add(rim);
        const label=this.canvas.ownerDocument.createElement('div');label.className='district-label';label.textContent=g.name;const span=this.canvas.ownerDocument.createElement('span');span.textContent=String(g.files.length);label.append(span);this.labels.append(label);this.labelRecords.push({label,anchor:new T.Vector3(g.x,.08,g.z+g.depth/2-.45)});
      });
      const box=new T.BoxGeometry(1,1,1);
      const material=new T.MeshStandardMaterial({color:0xffffff,roughness:.48,metalness:.12});
      const roofMat=new T.MeshStandardMaterial({color:0xffffff,roughness:.6,metalness:.05});
      this.buildings=new T.InstancedMesh(box,material,snapshot.files.length);this.buildings.instanceMatrix.setUsage(T.DynamicDrawUsage);this.buildings.castShadow=true;this.buildings.receiveShadow=true;
      this.roofs=new T.InstancedMesh(box,roofMat,snapshot.files.length);this.roofs.receiveShadow=true;
      this.instanceFiles=snapshot.files;this.world.add(this.buildings,this.roofs);
      const selMat=new T.LineBasicMaterial({color:linear(theme.accent),depthTest:false,transparent:true,opacity:1});
      this.selectionOutline=new T.LineSegments(new T.EdgesGeometry(box),selMat);this.selectionOutline.renderOrder=20;this.world.add(this.selectionOutline);
      this.selectionDot=new T.Mesh(new T.OctahedronGeometry(.18),new T.MeshBasicMaterial({color:linear(theme.accent),depthTest:false}));this.selectionDot.renderOrder=21;this.world.add(this.selectionDot);
      const stemG=new T.BufferGeometry().setFromPoints([new T.Vector3(0,0,0),new T.Vector3(0,1.2,0)]);this.selectionStem=new T.Line(stemG,new T.LineBasicMaterial({color:linear(theme.accent),depthTest:false,transparent:true,opacity:.7}));this.selectionStem.renderOrder=20;this.world.add(this.selectionStem);
      this._updateHeights();this._recolor();this._selection();this._pose();
      const extent=Math.max(width,depth)/2+8;Object.assign(this.sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,far:this.radius*3});this.sun.shadow.camera.updateProjectionMatrix();this.sun.position.set(-extent,extent*1.65,extent);this.renderer.shadowMap.needsUpdate=true;
      if(fit)this.fit();else this.invalidate();
    }
    _updateHeights() {
      if(!this.snapshot)return;
      this.snapshot.files.forEach((f,i)=>{const p=this.layout.positions.get(f.id),h=cappedHeight(f,this.metric);this.tmpObject.position.set(p.x,h/2+.08,p.z);this.tmpObject.scale.set(1.06,h,1.06);this.tmpObject.updateMatrix();this.buildings.setMatrixAt(i,this.tmpObject.matrix);this.tmpObject.position.y=h+.1;this.tmpObject.scale.set(1.1,.045,1.1);this.tmpObject.updateMatrix();this.roofs.setMatrixAt(i,this.tmpObject.matrix);});
      this.buildings.instanceMatrix.needsUpdate=true;this.roofs.instanceMatrix.needsUpdate=true;
      if(this.buildings.computeBoundingSphere)this.buildings.computeBoundingSphere();
      this.renderer.shadowMap.needsUpdate=true;
    }
    _recolor() {
      if(!this.snapshot||!this.buildings)return;
      const theme=THEME[this.theme];
      this.snapshot.files.forEach((f,i)=>{
        const selected=f.id===this.selectedId,matched=!this.matches||this.matches.has(f.id);
        let c=linear(PALETTE[f.category]||PALETTE.Other);
        if(f[this.metric]===null)c=linear('#798496');
        if(!matched&&!selected)c.lerp(linear(theme.dim),.91);
        if(selected)c=linear(theme.accent);
        this.buildings.setColorAt(i,c);this.roofs.setColorAt(i,c.clone().lerp(linear(this.theme==='light'?'#ffffff':'#dae8ff'),matched?.055:.01));
      });
      if(this.buildings.instanceColor)this.buildings.instanceColor.needsUpdate=true;if(this.roofs.instanceColor)this.roofs.instanceColor.needsUpdate=true;this.invalidate();
    }
    _selection() {
      if(!this.selectionOutline)return;
      const file=this.byId.get(this.selectedId),valid=!!file;[this.selectionOutline,this.selectionDot,this.selectionStem].forEach(o=>o.visible=valid);
      if(valid){const p=this.layout.positions.get(file.id),h=cappedHeight(file,this.metric);this.selectionOutline.position.set(p.x,h/2+.08,p.z);this.selectionOutline.scale.set(1.14,h+.11,1.14);this.selectionStem.position.set(p.x,h+.23,p.z);this.selectionDot.position.set(p.x,h+1.45,p.z);}
      this.invalidate();
    }
    setSelected(id) {this.selectedId=id;this._recolor();this._selection();}
    setMatches(ids) {this.matches=ids;this._recolor();}
    setMetric(metric) {if(!['lines','bytes'].includes(metric))return;this.metric=metric;this._updateHeights();this._recolor();this._selection();this.invalidate();}
    setLabels(show){this.showLabels=show;this.labels.hidden=!show;this.invalidate();}
    setShadows(enabled){this.shadows=enabled;this.renderer.shadowMap.enabled=enabled;if(this.buildings)this.buildings.material.needsUpdate=true;if(this.floor)this.floor.material.needsUpdate=true;this.renderer.shadowMap.needsUpdate=true;this.invalidate();}
    setTheme(name) {
      this.theme=name==='light'?'light':'dark';const c=THEME[this.theme];this.scene.background=new T.Color(c.background);
      if(this.floor)this.floor.material.opacity=this.theme==='light'?.12:.24;if(this.platformM)this.platformM.color.copy(linear(c.platform));if(this.rimM)this.rimM.color.copy(linear(c.rim));
      if(this.grid){const gc=linear(c.grid),a=this.grid.geometry.attributes.color;for(let i=0;i<a.count;i++)a.setXYZ(i,gc.r,gc.g,gc.b);a.needsUpdate=true;}
      if(this.selectionOutline){this.selectionOutline.material.color.copy(linear(c.accent));this.selectionDot.material.color.copy(linear(c.accent));this.selectionStem.material.color.copy(linear(c.accent));}
      this._recolor();this.invalidate();
    }
    _pose() {
      const phi=this.mode==='top'?.00001:this.phi;
      this.camera.position.set(this.target.x+this.radius*Math.sin(phi)*Math.sin(this.theta),this.target.y+this.radius*Math.cos(phi),this.target.z+this.radius*Math.sin(phi)*Math.cos(this.theta));this.camera.up.set(0,1,0);this.camera.lookAt(this.target);this.camera.updateMatrixWorld();this.camera.updateProjectionMatrix();
    }
    getCameraState(){return {theta:this.theta,phi:this.phi,zoom:this.camera.zoom,target:this.target.toArray(),mode:this.mode};}
    restoreCamera(state){this.theta=state.theta;this.phi=state.phi;this.target.fromArray(state.target);this.camera.zoom=state.zoom;this.mode=state.mode||'3d';this._pose();this._changed();}
    _changed(){this._pose();this.onCameraChange(this.getCameraState());this.invalidate();}
    orbit(dx,dy=0){if(this.mode==='top')return;this.theta+=dx;this.phi=clamp(this.phi+dy,.12,Math.PI/2-.09);this._changed();}
    pan(dx,dy){
      const units=(this.halfHeight*2)/(this.camera.zoom*Math.max(1,this.height));
      const right=new T.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0),up=new T.Vector3().setFromMatrixColumn(this.camera.matrixWorld,1);
      this.target.addScaledVector(right,-dx*units).addScaledVector(up,dy*units);this.target.clampScalar(-this.radius*2,this.radius*2);this._changed();
    }
    zoom(factor){this.camera.zoom=clamp(this.camera.zoom*factor,.025,25);this._changed();}
    setMode(mode){
      if(mode===this.mode)return;
      if(mode==='top'){this.saved3d=this.getCameraState();this.mode='top';this.theta=0;this.fit();}
      else {this.mode='3d';if(this.saved3d){const saved=this.saved3d;this.saved3d=null;this.restoreCamera({...saved,mode:'3d'});}else this._changed();}
    }
    fit() {
      if(!this.layout)return;
      let maxH=1;this.snapshot.files.forEach(f=>maxH=Math.max(maxH,cappedHeight(f,this.metric)));
      this.target.set(0,this.mode==='top'?0:maxH*.22,0);this.camera.zoom=1;this._pose();
      let minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity;
      for(const x of [-this.layout.width/2-1,this.layout.width/2+1])for(const y of [0,maxH+1])for(const z of [-this.layout.depth/2-1,this.layout.depth/2+1]){const p=new T.Vector3(x,y,z).applyMatrix4(this.camera.matrixWorldInverse);minx=Math.min(minx,p.x);maxx=Math.max(maxx,p.x);miny=Math.min(miny,p.y);maxy=Math.max(maxy,p.y);}
      const aspect=(this.width||800)/(this.height||500);
      this.camera.zoom=clamp(Math.min(this.halfHeight*2*aspect/(maxx-minx),this.halfHeight*2/(maxy-miny))*.79,.025,8);
      this._changed();
    }
    focusFile(id) {
      const p=this.layout?.positions.get(id),f=this.byId?.get(id);if(!p||!f)return;
      this.target.set(p.x,this.mode==='top'?0:cappedHeight(f,this.metric)*.35,p.z);
      this.camera.zoom=clamp(this.halfHeight*2/20,1,5);this._changed();
    }
    pick(x,y) {
      if(!this.buildings||!this.instanceFiles.length||this.contextLost)return null;
      const rect=this.canvas.getBoundingClientRect();this.mouse.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);
      this.camera.updateMatrixWorld();this.world.updateMatrixWorld(true);this.raycaster.setFromCamera(this.mouse,this.camera);
      const hit=this.raycaster.intersectObject(this.buildings,false)[0];return hit?.instanceId!==undefined?this.instanceFiles[hit.instanceId]:null;
    }
    projectFile(id) {
      const p=this.layout?.positions.get(id),f=this.byId?.get(id);if(!p||!f)return null;
      const point=new T.Vector3(p.x,cappedHeight(f,this.metric)+.13,p.z).project(this.camera),r=this.canvas.getBoundingClientRect();
      return {x:r.left+(point.x+1)*r.width/2,y:r.top+(1-point.y)*r.height/2,visible:Math.abs(point.x)<1&&Math.abs(point.y)<1};
    }
    resize() {
      if(this.disposed)return;const r=this.canvas.parentElement.getBoundingClientRect();if(!r.width||!r.height)return;
      this.width=r.width;this.height=r.height;this.renderer.setSize(r.width,r.height,false);
      const aspect=r.width/r.height;this.camera.left=-this.halfHeight*aspect;this.camera.right=this.halfHeight*aspect;this.camera.top=this.halfHeight;this.camera.bottom=-this.halfHeight;this.camera.updateProjectionMatrix();this.invalidate();
    }
    setSuspended(value){this.suspended=value;if(value){if(this.frame!==null)this.win.cancelAnimationFrame(this.frame);this.frame=null;this.onHover(null);}else{this.resize();this.invalidate();}}
    invalidate(){if(this.disposed||this.contextLost||this.suspended||this.frame!==null||this.canvas.ownerDocument.hidden)return;this.frame=this.win.requestAnimationFrame(()=>{this.frame=null;this.render();});}
    render(){
      if(this.disposed||this.contextLost||this.suspended||!this.width||!this.height)return;
      this.renderer.render(this.scene,this.camera);this.frameCount++;
      this.labelRecords.forEach(({label,anchor})=>{const p=anchor.clone().project(this.camera);const visible=p.z>-1&&p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<.91;label.hidden=!visible;if(visible){label.style.left=((p.x+1)*this.width/2)+'px';label.style.top=((1-p.y)*this.height/2)+'px';}});
      this.onRendered({revision:T.REVISION,frames:this.frameCount,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries});
    }
    capture(){if(this.contextLost||this.disposed)throw new Error('The WebGL viewer is unavailable.');this.render();return this.canvas.toDataURL('image/png');}
    getDiagnostics(){return {revision:T.REVISION,backend:'WebGL2',files:this.instanceFiles?.length||0,frameCount:this.frameCount,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,contextLost:this.contextLost,mode:this.mode};}
    simulateContextLoss(){this.renderer.forceContextLoss();}
    restoreContext(){this.renderer.forceContextRestore();}
    dispose(){if(this.disposed)return;this.disposed=true;if(this.frame!==null)this.win.cancelAnimationFrame(this.frame);this.resizeObserver.disconnect();this.listeners.forEach(f=>f());this.listeners=[];this.pointers.clear();this._disposeWorld();if(this.sun.shadow.map)this.sun.shadow.map.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.labels.replaceChildren();}
  }
  root.CodebaseInspectorViewer={CityViewer,PALETTE,THEME,runtimeRevision:T.REVISION};
})(globalThis);
