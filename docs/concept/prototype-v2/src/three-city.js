/** Codebase Inspector — concept-city renderer.
 * Real, locally bundled Three.js. The scene consumes structural records only.
 * Facade ornament is illustrative. Connections are explicit supplied records.
 * No source access, network use, analyzer execution, or inferred quality scores.
 */
class ThreeCity {
  constructor(canvas, files, getState, onCamera, onSelect, options = {}) {
    this.canvas=canvas; this.files=files; this.getState=getState; this.onCamera=onCamera; this.onSelect=onSelect; this.options=options;
    this.win=canvas.ownerDocument.defaultView; this.doc=canvas.ownerDocument;
    this.abort=new this.win.AbortController(); this.resources=new Set(); this.instances=new Set();
    this.positions=new Map(); this.frames=0; this.pending=0; this.disposed=false; this.contextLost=false;
    this.lens='directory'; this.showLabels=true; this.detail=true; this.showLinks=true; this.hoverId=null;
    this.links=options.relationships||[]; this.byId=new Map(files.map(f=>[f.id,f]));
    this.palette=[0x5f9cf4,0xac83ee,0x42c7cb,0x7086ef,0xf2ac70,0x6dcca5];
    this.color=new THREE.Color(); this.temp=new THREE.Object3D(); this.ray=new THREE.Raycaster(); this.pointer=new THREE.Vector2();
    this.scene=new THREE.Scene(); this.camera=new THREE.OrthographicCamera(-42,42,30,-30,.1,600);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(this.win.devicePixelRatio||1,2)); this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.2;
    this.renderer.shadowMap.enabled=true; this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate=false; this.renderer.shadowMap.needsUpdate=true;
    this.renderer.setClearColor(0x000000,0);
    this.ambient=new THREE.HemisphereLight(0xc9dfff,0x17263b,2.5); this.scene.add(this.ambient);
    this.sun=new THREE.DirectionalLight(0xc3d9ff,3.1); this.sun.position.set(-28,65,35); this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(1536,1536); this.sun.shadow.bias=-.0003; this.sun.shadow.normalBias=.05;
    Object.assign(this.sun.shadow.camera,{left:-60,right:60,top:55,bottom:-55,near:1,far:150});this.scene.add(this.sun);
    const rim=new THREE.DirectionalLight(0x7b87ff,1.7);rim.position.set(35,22,-40);this.scene.add(rim);
    const names=[...new Set(files.map(f=>f.group))]; const columns=Math.ceil(Math.sqrt(names.length*1.5));
    this.groups=names.map((name,i)=>({name,index:i,x:(i%columns-(columns-1)/2)*21,z:(Math.floor(i/columns)-(Math.ceil(names.length/columns)-1)/2)*21,color:this.palette[i%6],files:files.filter(f=>f.group===name)}));
    this.bounds={width:columns*21+5,depth:Math.ceil(names.length/columns)*21+6};
    this.box=this.track(new THREE.BoxGeometry(1,1,1));
    this.setupGround(); this.setupDistricts(); this.setupBuildings(); this.setupSelection(); this.setupLabels(); this.setupMiniMap();
    this.linkGroup=new THREE.Group();this.linkResources=[];this.scene.add(this.linkGroup);
    this.bindInputs(); this.observer=new this.win.ResizeObserver(()=>this.invalidate());this.observer.observe(canvas);
    canvas.addEventListener('webglcontextlost',e=>{
      e.preventDefault();this.contextLost=true;
      this.win.cancelAnimationFrame(this.pending);this.pending=0;
      // Release GPU ownership/listeners while the context is lost. CPU-side
      // geometry survives dispose(), so Three can upload it again after restore.
      // This prevents stale onDispose callbacks retaining the previous context.
      for(const m of this.instances)m.dispose();
      for(const r of this.linkResources)r.dispose();
      this.sun.shadow.dispose();this.sun.shadow.map=null;this.sun.shadow.mapPass=null;
      for(const r of this.resources)r.dispose();
      this.options.onContextLost?.();
    },{signal:this.abort.signal});
    canvas.addEventListener('webglcontextrestored',()=>{this.contextLost=false;this.renderer.shadowMap.needsUpdate=true;this.options.onContextRestored?.();this.invalidate();},{signal:this.abort.signal});
    this.doc.addEventListener('visibilitychange',()=>{if(!this.doc.hidden)this.invalidate();},{signal:this.abort.signal});
    this.invalidate();
  }
  track(resource){this.resources.add(resource);return resource;}
  instance(geometry,material,count){const m=new THREE.InstancedMesh(geometry,material,Math.max(1,count));m.count=count;this.instances.add(m);this.scene.add(m);return m;}
  transform(mesh,i,x,y,z,sx,sy,sz){this.temp.position.set(x,y,z);this.temp.rotation.set(0,0,0);this.temp.scale.set(sx,sy,sz);this.temp.updateMatrix();mesh.setMatrixAt(i,this.temp.matrix);}
  roundedShape(w,d,r){const x=-w/2,y=-d/2,s=new THREE.Shape();s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+d-r);s.quadraticCurveTo(x+w,y+d,x+w-r,y+d);s.lineTo(x+r,y+d);s.quadraticCurveTo(x,y+d,x,y+d-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;}
  setupGround(){
    this.groundMaterial=this.track(new THREE.MeshStandardMaterial({color:0x0c1728,metalness:.4,roughness:.85,transparent:true,opacity:.65}));
    const ground=new THREE.Mesh(this.track(new THREE.PlaneGeometry(220,180)),this.groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.y=-1.25;ground.receiveShadow=true;this.scene.add(ground);
    this.grid=new THREE.GridHelper(200,100,0x24425e,0x24425e);this.grid.position.y=-1.24;this.grid.material.transparent=true;this.grid.material.opacity=.2;this.track(this.grid.geometry);this.track(this.grid.material);this.scene.add(this.grid);
  }
  setupDistricts(){
    const shape=this.roundedShape(17.1,14.3,.8);
    const geometry=this.track(new THREE.ExtrudeGeometry(shape,{depth:.54,bevelEnabled:true,bevelThickness:.12,bevelSize:.12,bevelSegments:2,steps:1,curveSegments:8}));geometry.rotateX(-Math.PI/2);
    this.baseMaterial=this.track(new THREE.MeshStandardMaterial({color:0x142438,metalness:.65,roughness:.55}));
    this.topMaterial=this.track(new THREE.MeshStandardMaterial({color:0x263b50,metalness:.45,roughness:.6}));
    this.padMaterial=this.track(new THREE.MeshStandardMaterial({color:0xffffff,roughness:.7,metalness:.4}));
    this.districtObjects=[];
    for(const g of this.groups){
      const base=new THREE.Mesh(geometry,this.baseMaterial);base.position.set(g.x,-.74,g.z);base.receiveShadow=true;base.castShadow=true;this.scene.add(base);
      const surface=new THREE.Mesh(this.box,this.topMaterial);surface.scale.set(15.9,.13,13.2);surface.position.set(g.x,-.04,g.z);surface.receiveShadow=true;this.scene.add(surface);
      const pts=shape.getPoints(52).map(p=>new THREE.Vector3(p.x,-.22,-p.y));
      const contour=new THREE.LineLoop(this.track(new THREE.BufferGeometry().setFromPoints(pts)),this.track(new THREE.LineBasicMaterial({color:g.color,transparent:true,opacity:.8})));contour.position.set(g.x,0,g.z);this.scene.add(contour);
      const lower=contour.clone();lower.material=this.track(contour.material.clone());lower.material.opacity=.22;lower.position.y=-.42;this.scene.add(lower);
      const glowMaterial=this.track(new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{tint:{value:new THREE.Color(g.color)},strength:{value:.14}},vertexShader:'varying vec2 p; void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 p;uniform vec3 tint;uniform float strength;void main(){vec2 q=abs(p-.5)*2.;float a=pow(max(0.,1.-max(q.x,q.y)),1.7)*strength;gl_FragColor=vec4(tint,a);}'}));
      const glow=new THREE.Mesh(this.track(new THREE.PlaneGeometry(23,20)),glowMaterial);glow.rotation.x=-Math.PI/2;glow.position.set(g.x,-1.18,g.z);this.scene.add(glow);
      const roadPositions=[];
      for(let i=0;i<6;i++){const x=g.x+(i-2.5)*2.38-1.18;roadPositions.push(x,.043,g.z-5.2,x,.043,g.z+5.2);}
      for(let i=0;i<5;i++){const z=g.z+(i-2)*2.6;roadPositions.push(g.x-7.15,.043,z,g.x+7.15,.043,z);}
      const rg=this.track(new THREE.BufferGeometry());rg.setAttribute('position',new THREE.Float32BufferAttribute(roadPositions,3));
      const roads=new THREE.LineSegments(rg,this.track(new THREE.LineBasicMaterial({color:g.color,transparent:true,opacity:.15})));this.scene.add(roads);
      this.districtObjects.push({g,contour,lower,glow,roads});
    }
    // Low street markers are decorative, not extra file records.
    const n=this.groups.length*32;
    this.streetMaterial=this.track(new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}));
    this.streetLights=this.instance(this.box,this.streetMaterial,n);let k=0;
    for(const g of this.groups)for(let side=0;side<2;side++)for(let j=0;j<16;j++){this.transform(this.streetLights,k,g.x-7.45+j*.99,.08,g.z+(side?6.65:-6.65),.19,.045,.055);this.streetLights.setColorAt(k++,new THREE.Color(g.color));}
    this.streetLights.instanceMatrix.needsUpdate=true;
  }
  setupBuildings(){
    const count=this.files.length;const geometry=this.track(new THREE.BoxGeometry(1,1,1));
    this.sizeAttr=new THREE.InstancedBufferAttribute(new Float32Array(count*3),3);
    this.seedAttr=new THREE.InstancedBufferAttribute(new Float32Array(count),1);
    this.dimAttr=new THREE.InstancedBufferAttribute(new Float32Array(count).fill(1),1);
    this.tintAttr=new THREE.InstancedBufferAttribute(new Float32Array(count*3),3);
    geometry.setAttribute('aSize',this.sizeAttr);geometry.setAttribute('aSeed',this.seedAttr);geometry.setAttribute('aDim',this.dimAttr);geometry.setAttribute('aTint',this.tintAttr);
    this.buildingMaterial=this.track(new THREE.MeshStandardMaterial({color:0xffffff,metalness:.38,roughness:.48}));
    this.facadeUniforms={uNight:{value:1},uDetail:{value:1}};
    this.buildingMaterial.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,this.facadeUniforms);
      shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\nattribute vec3 aSize;attribute float aSeed;attribute float aDim;attribute vec3 aTint;varying vec3 vBuilding;varying vec3 vBNormal;varying vec3 vBTint;varying float vBSeed;varying float vBDim;`);
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nvBuilding=(position+vec3(.5))*aSize;vBNormal=normal;vBSeed=aSeed;vBDim=aDim;vBTint=aTint;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 vBuilding;varying vec3 vBNormal;varying vec3 vBTint;varying float vBSeed;varying float vBDim;uniform float uNight;uniform float uDetail;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        float side=1.-step(.5,abs(vBNormal.y));
        float horizontal=abs(vBNormal.x)>.5?vBuilding.z:vBuilding.x;
        vec2 cell=vec2(horizontal/.34,vBuilding.y/.65);
        vec2 u=fract(cell);float windowMask=step(.20,u.x)*step(u.x,.77)*step(.27,u.y)*step(u.y,.70)*side;
        float seed=fract(sin(dot(floor(cell),vec2(12.9898,78.233))+vBSeed*19.)*43758.5453);
        float lit=step(.44,seed);float floorLine=(1.-step(.035,fract(vBuilding.y/.55)))*side;
        diffuseColor.rgb*=mix(1.,mix(.65,1.05,windowMask),uDetail);
        vec3 lamp=mix(vBTint,vec3(.87,.95,1.),.66);
        totalEmissiveRadiance+=lamp*windowMask*lit*.30*uNight*uDetail*vBDim;
        totalEmissiveRadiance+=vBTint*floorLine*.10*uNight*uDetail*vBDim;
      `);
    };
    this.buildings=this.instance(geometry,this.buildingMaterial,count);this.buildings.castShadow=true;this.buildings.receiveShadow=true;
    this.roofMaterial=this.track(new THREE.MeshStandardMaterial({color:0xffffff,metalness:.48,roughness:.48}));
    this.roofs=this.instance(this.box,this.roofMaterial,count);
    this.roofTopMaterial=this.track(new THREE.MeshStandardMaterial({color:0xffffff,metalness:.4,roughness:.6}));
    this.roofTops=this.instance(this.box,this.roofTopMaterial,count);
    this.lots=this.instance(this.box,this.padMaterial,count);this.lots.receiveShadow=true;
    this.beacons=this.instance(this.box,this.streetMaterial,count);
    const edgePoints=[],edgeColors=[];
    this.files.forEach((f,i)=>{
      const g=this.groups.find(g=>g.name===f.group), j=g.files.indexOf(f), columns=6;
      const rows=Math.ceil(g.files.length/columns), cellX=14.28/columns, cellZ=10.4/Math.max(4,rows);
      const width=Math.min(1.64,cellX*.69,cellZ*.69);
      const p={x:g.x+(j%columns-2.5)*cellX,z:g.z+(Math.floor(j/columns)-(rows-1)/2)*cellZ,h:.30+Math.sqrt(Math.max(0,f.lines))*.34,index:i,group:g.index,w:width};
      this.positions.set(f.id,p);this.sizeAttr.setXYZ(i,width,p.h,width);this.seedAttr.setX(i,i+1);
      this.transform(this.buildings,i,p.x,p.h/2+.17,p.z,width,p.h,width);
      this.transform(this.lots,i,p.x,.10,p.z,Math.min(width+.22,cellX*.95),.13,Math.min(width+.22,cellZ*.95));
      this.transform(this.roofs,i,p.x,p.h+.22,p.z,width+.055,.105,width+.055);
      this.transform(this.roofTops,i,p.x,p.h+.36,p.z,width*.40,.25,width*.42);
      this.transform(this.beacons,i,p.x,p.h+.49,p.z,width*.19,.023,width*.19);
      // A shared line buffer outlines tower corners and roofs without per-file objects.
      const x=p.x,z=p.z,a=width/2+.011,y=.18,h=p.h+.22;
      const segments=[[-a,y,-a,-a,h,-a],[a,y,-a,a,h,-a],[-a,y,a,-a,h,a],[a,y,a,a,h,a],[-a,h,-a,a,h,-a],[a,h,-a,a,h,a],[a,h,a,-a,h,a],[-a,h,a,-a,h,-a]];
      for(const seg of segments){edgePoints.push(seg[0]+x,seg[1],seg[2]+z,seg[3]+x,seg[4],seg[5]+z);edgeColors.push(1,1,1,1,1,1);}
    });
    const eg=this.track(new THREE.BufferGeometry());eg.setAttribute('position',new THREE.Float32BufferAttribute(edgePoints,3));eg.setAttribute('color',new THREE.Float32BufferAttribute(edgeColors,3));
    this.edgeMaterial=this.track(new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.55,toneMapped:false}));
    this.edges=new THREE.LineSegments(eg,this.edgeMaterial);this.scene.add(this.edges);
    for(const m of this.instances){m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();}
  }
  setupSelection(){
    this.selection=new THREE.LineSegments(this.track(new THREE.EdgesGeometry(this.box)),this.track(new THREE.LineBasicMaterial({color:0xe1f5ff,depthTest:false,transparent:true,opacity:.95,toneMapped:false})));this.selection.visible=false;this.selection.renderOrder=10;this.scene.add(this.selection);
    this.hover=new THREE.LineSegments(this.track(new THREE.EdgesGeometry(this.box)),this.track(new THREE.LineBasicMaterial({color:0xbce5ff,depthTest:false,transparent:true,opacity:.55})));this.hover.visible=false;this.scene.add(this.hover);
    this.marker=new THREE.Mesh(this.track(new THREE.OctahedronGeometry(.20)),this.track(new THREE.MeshBasicMaterial({color:0xe5f8ff,depthTest:false,toneMapped:false})));this.marker.visible=false;this.marker.renderOrder=11;this.scene.add(this.marker);
    this.selectionRing=new THREE.Mesh(this.track(new THREE.RingGeometry(1.03,1.10,40)),this.track(new THREE.MeshBasicMaterial({color:0xb4d6ff,side:THREE.DoubleSide,transparent:true,opacity:.8,depthTest:false,toneMapped:false})));this.selectionRing.rotation.x=-Math.PI/2;this.selectionRing.visible=false;this.scene.add(this.selectionRing);
  }
  setupLabels(){
    this.labels=this.doc.createElement('div');this.labels.className='three-labels';this.labels.setAttribute('aria-hidden','true');this.canvas.parentElement.append(this.labels);
    this.groupLabels=this.groups.map(g=>{const el=this.doc.createElement('div');el.className='district-label';el.style.setProperty('--district-color','#'+g.color.toString(16).padStart(6,'0'));
      const name=this.doc.createElement('strong');name.textContent=g.name;
      const caption=this.doc.createElement('span');caption.textContent=`${g.files.length} files · ${g.files.reduce((n,f)=>n+f.lines,0).toLocaleString('en')} lines`;
      el.append(name,caption);this.labels.append(el);return {el,g};});
    this.tooltip=this.doc.createElement('div');this.tooltip.className='city-tooltip';this.tooltip.hidden=true;this.tooltip.setAttribute('aria-hidden','true');this.canvas.parentElement.append(this.tooltip);
  }
  setupMiniMap(){
    if(!this.options.minimap)return;this.mini=this.options.minimap;
    this.mini.addEventListener('click',e=>{const r=this.mini.getBoundingClientRect();const x=(e.clientX-r.left)/r.width,z=(e.clientY-r.top)/r.height;
      let best=null,d=Infinity;for(const g of this.groups){const gx=.5+g.x/this.bounds.width,gz=.5+g.z/this.bounds.depth,v=(x-gx)**2+(z-gz)**2;if(v<d){d=v;best=g;}}
      if(best)this.focusDistrict(best.name);
    },{signal:this.abort.signal});
  }
  drawMini(light){if(!this.mini)return;const c=this.mini.getContext('2d');if(!c)return;const w=this.mini.width,h=this.mini.height;
    c.clearRect(0,0,w,h);for(const g of this.groups){const x=(.5+g.x/this.bounds.width)*w,z=(.5+g.z/this.bounds.depth)*h,gw=17.1/this.bounds.width*w,gh=14.3/this.bounds.depth*h;
      c.fillStyle=light?'#dee5f1':'#18273c';c.fillRect(x-gw/2,z-gh/2,gw,gh);c.strokeStyle='#'+g.color.toString(16).padStart(6,'0');c.globalAlpha=.45;c.strokeRect(x-gw/2,z-gh/2,gw,gh);c.globalAlpha=1;
    }for(const f of this.files){const p=this.positions.get(f.id);c.fillStyle=f.id===this.getState().selectedId?(light?'#172d4e':'#ffffff'):'#'+this.palette[p.group%6].toString(16);c.globalAlpha=this.match(f)?.9:.12;c.fillRect((.5+p.x/this.bounds.width)*w-1,(.5+p.z/this.bounds.depth)*h-1,2,2);}
    c.globalAlpha=1;const camera=this.getState().camera;c.strokeStyle=light?'#334a72':'#c1d8ff';c.setLineDash([3,3]);c.strokeRect((.5+camera.x/this.bounds.width)*w-28/camera.zoom,(.5+camera.z/this.bounds.depth)*h-17/camera.zoom,56/camera.zoom,34/camera.zoom);c.setLineDash([]);
  }
  match(f){return f.path.toLowerCase().includes(this.getState().query.trim().toLowerCase());}
  focusDistrict(name){const g=this.groups.find(g=>g.name===name);if(g)this.onCamera({x:g.x,y:2,z:g.z,zoom:1.8});}
  clearLinks(){this.displayedLinks=0;for(const r of this.linkResources)r.dispose();this.linkResources=[];this.linkGroup.clear();}
  updateLinks(){
    this.clearLinks();if(!this.showLinks)return;
    const selected=this.getState().selectedId,query=this.getState().query;
    let paths=[];
    if(selected){for(const e of this.links){if(e.source!==selected&&e.target!==selected)continue;
      const a=this.positions.get(e.source),b=this.positions.get(e.target);if(!a||!b)continue;
      paths.push({from:new THREE.Vector3(a.x,a.h+.65,a.z),to:new THREE.Vector3(b.x,b.h+.65,b.z),color:e.source===selected?0xa88bff:0x62ceea});}}
    else {const pairs=new Map();for(const e of this.links){const a=this.byId.get(e.source),b=this.byId.get(e.target);if(!a||!b||a.group===b.group)continue;if(query&&!this.match(a)&&!this.match(b))continue;
      const ai=this.positions.get(a.id).group,bi=this.positions.get(b.id).group,key=ai+'>'+bi;if(!pairs.has(key))pairs.set(key,{a:this.groups[ai],b:this.groups[bi]});}
      for(const {a,b}of pairs.values())paths.push({from:new THREE.Vector3(a.x,1.0,a.z-6.4),to:new THREE.Vector3(b.x,1.0,b.z-6.4),color:a.color});
    }
    for(const [i,p]of paths.slice(0,40).entries()){
      const dist=p.from.distanceTo(p.to);const mid=p.from.clone().lerp(p.to,.5);mid.y+=Math.max(4,dist*.27);mid.z-=1+i*.06;
      const curve=new THREE.QuadraticBezierCurve3(p.from,mid,p.to);
      for(const [radius,opacity]of [[.075,.94],[.23,.09]]){const geo=new THREE.TubeGeometry(curve,44,radius,5,false);const mat=new THREE.MeshBasicMaterial({color:p.color,transparent:true,opacity,depthWrite:false,toneMapped:false});this.linkResources.push(geo,mat);this.linkGroup.add(new THREE.Mesh(geo,mat));}
      const arrowGeo=new THREE.ConeGeometry(.18,.52,7);const arrowMat=new THREE.MeshBasicMaterial({color:p.color,toneMapped:false});this.linkResources.push(arrowGeo,arrowMat);const arrow=new THREE.Mesh(arrowGeo,arrowMat);arrow.position.copy(curve.getPoint(.80));arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),curve.getTangent(.80).normalize());this.linkGroup.add(arrow);
    }
    this.displayedLinks=paths.length;
  }
  bindInputs(){
    const listen=(n,fn,opts={})=>this.canvas.addEventListener(n,fn,{...opts,signal:this.abort.signal});
    listen('pointerdown',e=>{if(e.button!==0&&e.button!==2)return;this.canvas.focus({preventScroll:true});this.canvas.setPointerCapture(e.pointerId);this.down={x:e.clientX,y:e.clientY,camera:{...this.getState().camera},button:e.button,pan:e.button===2||e.shiftKey||e.ctrlKey||e.metaKey,moved:false};this.tooltip.hidden=true;this.canvas.classList.add('is-dragging');});
    listen('pointermove',e=>{if(!this.down){const r=this.canvas.getBoundingClientRect(),id=this.pick(e.clientX-r.left,e.clientY-r.top);if(id!==this.hoverId){this.hoverId=id;this.invalidate();}this.canvas.style.cursor=id?'pointer':'grab';this.tooltip.hidden=!id;
      if(id){const f=this.byId.get(id);this.tooltip.textContent=`${f.path} · ${f.lines.toLocaleString('en')} physical lines`;this.tooltip.style.left=Math.max(8,Math.min(e.clientX-r.left+15,r.width-315))+'px';this.tooltip.style.top=Math.max(8,e.clientY-r.top-49)+'px';}return;}
      const dx=e.clientX-this.down.x,dy=e.clientY-this.down.y;if(Math.hypot(dx,dy)>5)this.down.moved=true;if(!this.down.moved)return;const c=this.down.camera;
      if(this.down.pan||this.getState().mode==='top'){const scale=this.scale||10,cp=Math.max(.3,Math.sin(c.pitch));this.onCamera({x:c.x-dx/scale*Math.cos(c.yaw)+dy/scale*Math.sin(c.yaw)/cp,z:c.z+dx/scale*Math.sin(c.yaw)+dy/scale*Math.cos(c.yaw)/cp});}
      else this.onCamera({yaw:c.yaw-dx*.006,pitch:Math.max(.25,Math.min(1.45,c.pitch+dy*.005))});
    });
    listen('pointerup',e=>{if(!this.down)return;const click=!this.down.moved&&this.down.button===0;this.down=null;this.canvas.classList.remove('is-dragging');if(click){const r=this.canvas.getBoundingClientRect(),id=this.pick(e.clientX-r.left,e.clientY-r.top);if(id)this.onSelect(id);}});
    const release=()=>{this.down=null;this.canvas.classList.remove('is-dragging');};listen('pointercancel',release);listen('lostpointercapture',release);
    listen('pointerleave',()=>{this.hoverId=null;this.tooltip.hidden=true;this.invalidate();});listen('contextmenu',e=>e.preventDefault());
    listen('wheel',e=>{if(this.doc.activeElement!==this.canvas)return;e.preventDefault();this.onCamera({zoom:Math.max(.3,Math.min(6,this.getState().camera.zoom*Math.exp(-e.deltaY*.0018)))});},{passive:false});
  }
  invalidate(){if(this.disposed||this.contextLost||this.pending||this.doc.hidden)return;this.pending=this.win.requestAnimationFrame(()=>{this.pending=0;this.draw();});}
  position(id){const p=this.positions.get(id);return p?{x:p.x,y:p.h/2,z:p.z}:null;}
  pick(x,y){if(this.disposed||this.contextLost)return null;const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return null;this.pointer.set(x/r.width*2-1,1-y/r.height*2);this.ray.setFromCamera(this.pointer,this.camera);const hit=this.ray.intersectObject(this.buildings,false)[0];return hit&&hit.instanceId!==undefined?this.files[hit.instanceId].id:null;}
  project(p,_c,w,h){const v=new THREE.Vector3(p.x,p.y,p.z).project(this.camera);return {x:(v.x+1)*w/2,y:(1-v.y)*h/2,depth:v.z};}
  setLens(v){if(!['category','directory'].includes(v))throw new Error('Unknown lens');this.lens=v;this.invalidate();}
  setLabels(v){this.showLabels=Boolean(v);this.invalidate();}
  setDetail(v){this.detail=Boolean(v);this.invalidate();}
  setLinks(v){this.showLinks=Boolean(v);this.invalidate();}
  setTheme(v){if(!['light','dark'].includes(v))throw new Error('Unknown theme');this.theme=v;this.invalidate();}
  updateColors(light){
    this.groundMaterial.color.set(light?0xc5d3e2:0x0b192b);this.groundMaterial.opacity=light?.65:.6;
    this.baseMaterial.color.set(light?0x91a7be:0x112238);this.topMaterial.color.set(light?0xbacbdd:0x263d56);
    this.grid.material.color.set(light?0x91a7be:0x264664);this.grid.material.opacity=light?.26:.20;
    this.facadeUniforms.uNight.value=light?.10:1;this.edgeMaterial.opacity=light?.24:.52;
    this.renderer.toneMappingExposure=light?1.10:1.2;
    const categories={TypeScript:0x689ffe,Vue:0x51cdb4,Tests:0xb095ee,Test:0xb095ee};
    const edges=this.edges.geometry.attributes.color;
    for(const [i,f]of this.files.entries()){
      const p=this.positions.get(f.id),matched=this.match(f);let value=this.lens==='directory'?this.palette[p.group%6]:(categories[f.category]||0x8eabc8);
      const c=new THREE.Color(value);if(light)c.multiplyScalar(.83);
      const tint=c.clone();if(!matched)c.lerp(new THREE.Color(light?0xc4cddc:0x14243a),.88);
      this.buildings.setColorAt(i,c);this.roofs.setColorAt(i,c.clone().lerp(new THREE.Color(0xe4f3ff),.20));this.roofTops.setColorAt(i,c.clone().multiplyScalar(.48));this.lots.setColorAt(i,new THREE.Color(light?0x8197b0:0x1c334d));
      this.beacons.setColorAt(i,matched?tint.clone().lerp(new THREE.Color(0xffffff),.25):c);this.tintAttr.setXYZ(i,tint.r,tint.g,tint.b);this.dimAttr.setX(i,matched?1:.06);
      for(let j=0;j<16;j++)edges.setXYZ(i*16+j,c.r,c.g,c.b);
    }
    for(const m of [this.buildings,this.roofs,this.roofTops,this.lots,this.beacons])m.instanceColor.needsUpdate=true;
    edges.needsUpdate=true;this.tintAttr.needsUpdate=true;this.dimAttr.needsUpdate=true;
    for(const {glow,contour}of this.districtObjects){glow.material.uniforms.strength.value=light?.05:.16;contour.material.opacity=light?.6:.85;}
  }
  draw(){
    if(this.disposed||this.contextLost)return;const r=this.canvas.getBoundingClientRect(),w=r.width,h=r.height;if(!w||!h)return;
    const s=this.getState(),c=s.camera,light=(this.theme||this.doc.body.dataset.theme)==='light';
    const size=this.renderer.getSize(new THREE.Vector2());if(size.x!==Math.round(w)||size.y!==Math.round(h))this.renderer.setSize(w,h,false);
    this.scale=Math.min(w/(this.bounds.width+9),h/(this.bounds.depth+10))*c.zoom;
    Object.assign(this.camera,{left:-w/(2*this.scale),right:w/(2*this.scale),top:h/(2*this.scale),bottom:-h/(2*this.scale)});
    const pitch=Math.min(Math.PI/2-.0001,c.pitch);this.camera.position.set(c.x+120*Math.sin(c.yaw)*Math.cos(pitch),c.y+120*Math.sin(pitch),c.z+120*Math.cos(c.yaw)*Math.cos(pitch));this.camera.lookAt(c.x,c.y,c.z);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    const visual=JSON.stringify([s.query,light,this.lens]);if(this.lastVisual!==visual){this.lastVisual=visual;this.updateColors(light);}
    const links=JSON.stringify([s.selectedId,s.query,this.showLinks]);if(this.lastLinks!==links){this.lastLinks=links;this.updateLinks();}
    for(const [overlay,id]of [[this.selection,s.selectedId],[this.hover,this.hoverId]]){const p=this.positions.get(id);overlay.visible=Boolean(p);if(p){overlay.position.set(p.x,p.h/2+.2,p.z);overlay.scale.set(p.w+.12,p.h+.18,p.w+.12);}}
    const selected=this.positions.get(s.selectedId);this.marker.visible=this.selectionRing.visible=Boolean(selected);if(selected){this.marker.position.set(selected.x,selected.h+1,selected.z);this.selectionRing.position.set(selected.x,.21,selected.z);}
    this.facadeUniforms.uDetail.value=this.detail?1:0;this.roofTops.visible=this.detail;this.beacons.visible=this.detail;this.edges.visible=this.detail;this.streetLights.visible=this.detail;
    this.labels.hidden=!this.showLabels;
    // Labels attach to actual district rims, never invented off-map buildings.
    const occupied=[];for(const {el,g}of this.groupLabels){const q=this.project({x:g.x,y:.08,z:g.z+7.6},c,w,h),a={x:q.x,y:q.y};let hidden=q.x<50||q.x>w-50||q.y<12||q.y>h-18||q.depth>1;
      if(occupied.some(b=>Math.abs(a.x-b.x)<145&&Math.abs(a.y-b.y)<42))hidden=true;if(!hidden)occupied.push(a);el.hidden=hidden;el.style.transform=`translate(${q.x}px,${q.y}px) translate(-50%,0)`;}
    this.renderer.render(this.scene,this.camera);this.frames++;this.drawMini(light);this.options.onStats?.(this.stats());
  }
  capture(){
    this.draw();const out=this.doc.createElement('canvas');out.width=this.canvas.width;out.height=this.canvas.height;
    const ctx=out.getContext('2d');if(!ctx)return this.canvas.toDataURL('image/png');
    const light=(this.theme||this.doc.body.dataset.theme)==='light';const gradient=ctx.createRadialGradient(out.width*.52,out.height*.48,0,out.width*.52,out.height*.48,Math.max(out.width,out.height)*.65);
    gradient.addColorStop(0,light?'#ffffff':'#17355c');gradient.addColorStop(.5,light?'#e9f0fa':'#0e213b');gradient.addColorStop(1,light?'#dce7f5':'#091322');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(this.canvas,0,0);return out.toDataURL('image/png');
  }
  stats(){return {engine:'THREE.WebGLRenderer',revision:THREE.REVISION,webgl2:true,buildings:this.files.length,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,frames:this.frames,displayedLinks:this.displayedLinks||0,disposed:this.disposed,contextLost:this.contextLost};}
  dispose(){if(this.disposed)return;this.disposed=true;this.win.cancelAnimationFrame(this.pending);this.pending=0;this.abort.abort();this.observer.disconnect();this.labels.remove();this.tooltip.remove();this.clearLinks();for(const m of this.instances)m.dispose();this.instances.clear();this.sun.shadow.dispose();for(const r of this.resources)r.dispose();this.resources.clear();this.scene.clear();this.renderer.dispose();this.renderer.forceContextLoss();}
}
