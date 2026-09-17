(function () {
  'use strict';
  const $=id=>document.getElementById(id), root=$('inspector-app');
  const files=CIFiles, byId=new Map(files.map(f=>[f.id,f]));
  const links=CIRelationships, colors=['#5f9cf4','#ac83ee','#42c7cb','#7086ef','#f2ac70','#6dcca5'];
  const groups=[...new Set(files.map(f=>f.group))];
  const icon=name=>CIIcons[name]||'';
  let detailsTab='overview', connectionSelection=null;
  let state=CIModel.createState(), renderer=null, fallback=false, destroyed=false;
  let toastTimer=0, announceTimer=0, scanTimers=[], dialogTriggers=new Map();
  const eventHistory=[];
  const esc=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dispatch=event=>{
    if(destroyed)return;
    state=CIModel.transition(state,event);eventHistory.push({type:event.type,runId:event.runId??null});
    if(eventHistory.length>100)eventHistory.shift();
    if(event.type==='QUERY_CHANGED')renderLists();
    updateUI();renderer?.invalidate();
  };
  function announce(text){clearTimeout(announceTimer);announceTimer=setTimeout(()=>{$('announcer').textContent=text;},130);}
  function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>{$('toast').hidden=true;},4500);}
  function renderLists(){
    const matches=files.filter(f=>CIModel.matches(f,state.query));
    const visibleGroups=[...new Set(matches.map(f=>f.group))];
    $('file-list').innerHTML=visibleGroups.length?visibleGroups.map(g=>`<details ${state.query||g==='src/visualization'?'open':''}><summary><span class="chevron">${icon('chevron')}</span><i class="directory-dot" style="--district-color:${colors[groups.indexOf(g)%6]}"></i>${esc(g.replace(/^src\//,''))}<span>${matches.filter(f=>f.group===g).length}</span></summary><ul>${matches.filter(f=>f.group===g).map(f=>`<li><button class="file-row" data-file-id="${esc(f.id)}" aria-pressed="${state.selectedId===f.id}" aria-label="Select ${esc(f.path)}"><span class="file-icon" aria-hidden="true">${f.category==='Vue'?'V':f.category==='Tests'?'T':'TS'}</span><span class="file-name">${esc(f.name)}</span></button></li>`).join('')}</ul></details>`).join(''):'<p class="empty-list">No matching files.<br>Try another path or clear the search.</p>';
    $('table-body').innerHTML=matches.map(f=>`<tr data-selected="${state.selectedId===f.id}" data-row-id="${esc(f.id)}"><td><button data-file-id="${esc(f.id)}" aria-label="Select ${esc(f.path)}">${esc(f.path)}</button></td><td>${esc(f.category)}</td><td>${f.lines.toLocaleString('en')}</td><td>${f.bytes.toLocaleString('en')}</td></tr>`).join('');
    $('table-empty').hidden=matches.length>0;
    $('match-count').textContent=state.query?`${matches.length} / ${files.length}`:String(files.length);
    $('city-summary').textContent=state.query?`${matches.length} matches · other files dimmed in place`:`${files.length} files across ${groups.length} directory districts. See how it all fits together.`;
    announce(`${matches.length} included files match the current search.`);
  }
  function updateUI(){
    const selected=byId.get(state.selectedId),isList=state.mode==='list';
    root.dataset.list=String(isList);root.dataset.inspector=state.inspectorOpen?'open':'closed';
    $('city-panel').hidden=isList;$('list-panel').hidden=!isList;
    $('files-toggle').setAttribute('aria-pressed',String(isList));
    $('files-toggle').innerHTML=icon(isList?'cube':'table')+(isList?' City':' Files');
    $('details-toggle').disabled=!selected;
    $('details-toggle').setAttribute('aria-expanded',String(state.inspectorOpen));
    $('inspector').hidden=!(selected&&state.inspectorOpen);
    $('overview-panel').hidden=Boolean(selected&&state.inspectorOpen);
    $('top-toggle').setAttribute('aria-pressed',String(state.mode==='top'));
    $('top-toggle').innerHTML=icon(state.mode==='top'?'cube':'layers')+(state.mode==='top'?' 3D city':' Top view');
    $('view-label').textContent=state.mode==='top'?'Top view':'3D city';
    $('snapshot-status').textContent=`${files.length} files · ${groups.length} districts · ${state.snapshotId}`;
    $('selection-status').textContent=selected?`Selected: ${selected.name}`:'No file selected';
    $('filter-warning').hidden=!(selected&&!CIModel.matches(selected,state.query));
    root.querySelectorAll('[data-file-id]').forEach(el=>{
      if(el.classList.contains('file-row'))el.setAttribute('aria-pressed',String(el.dataset.fileId===state.selectedId));
    });
    root.querySelectorAll('[data-row-id]').forEach(el=>{el.dataset.selected=String(el.dataset.rowId===state.selectedId);});
    if(selected){
      $('inspector-title').textContent=selected.name;$('inspector-path').textContent=selected.path;
      $('inspector-category').textContent=selected.category;
      $('inspector-lines').textContent=selected.lines.toLocaleString('en');
      $('inspector-bytes').textContent=`${(selected.bytes/1024).toFixed(1)} KiB`;
      $('inspector-directory').textContent=selected.group;
      const total=files.filter(f=>f.group===selected.group).reduce((n,f)=>n+f.lines,0);
      const percent=total?selected.lines/total*100:0;
      $('file-percent').textContent=percent.toFixed(1)+'%';$('file-percent-bar').style.width=percent+'%';
      if(connectionSelection!==selected.id){connectionSelection=selected.id;renderConnections(selected);}
      $('focus-file').disabled=fallback;
    }
    $('banner').hidden=!state.banner;$('banner-text').textContent=state.banner||'';
    const running=state.run.status==='running';
    $('scan-progress').hidden=!running;$('scan-trigger').disabled=running;$('source-trigger').disabled=running;
    $('progress-label').textContent=`${state.run.processed} / ${files.length} synthetic records · not a real scan`;
    $('progress-meter').value=state.run.processed;
    $('return-city').disabled=fallback;
    $('files-toggle').disabled=fallback;
    $('ribbon-city').disabled=fallback;
    $('ribbon-city').classList.toggle('active',!isList);$('ribbon-files').classList.toggle('active',isList);
  }
  function selectFile(id){
    if(!byId.has(id))return;
    dispatch({type:'FILE_SELECTED',id});$('copy-fallback').hidden=true;
    const selected=byId.get(id);announce(`${selected.path} selected. Camera unchanged.`);
  }
  function changeCamera(camera){dispatch({type:'CAMERA_CHANGED',camera});}
  function focusSelected(){
    if(!state.selectedId||fallback)return;
    if(state.mode==='list')dispatch({type:'CITY_REQUESTED'});
    dispatch({type:'FOCUS_REQUESTED',position:renderer.position(state.selectedId)});
    announce('Camera focused on the selected file.');
  }
  function showDialog(id,trigger){
    dialogTriggers.set(id,trigger||document.activeElement);
    if(id==='scope-dialog'){$('scope-consent').checked=false;$('start-scan').disabled=true;}
    $(id).showModal();
  }
  for(const id of ['scope-dialog','help-dialog']){
    $(id).addEventListener('keydown',e=>{
      if(e.key!=='Tab')return;
      const focusable=[...$(id).querySelectorAll('button,input,select,textarea,a[href],[tabindex]')]
        .filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length);
      const first=focusable[0],last=focusable.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    });
    $(id).addEventListener('close',()=>{const trigger=dialogTriggers.get(id);if(trigger?.isConnected&&!trigger.disabled)trigger.focus();else $('inspector-app').focus();});
  }
  root.addEventListener('click',e=>{const button=e.target.closest('[data-file-id]');if(button){selectFile(button.dataset.fileId);}});
  $('file-search').addEventListener('input',e=>dispatch({type:'QUERY_CHANGED',query:e.target.value}));
  $('file-search').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){const f=files.find(f=>CIModel.matches(f,state.query));if(f){selectFile(f.id);e.preventDefault();}}});
  $('source-trigger').onclick=()=>showDialog('scope-dialog',$('source-trigger'));
  $('scan-trigger').onclick=()=>showDialog('scope-dialog',$('scan-trigger'));
  $('scope-consent').onchange=()=>{$('start-scan').disabled=!$('scope-consent').checked;};
  $('start-scan').onclick=()=>{
    if(!$('scope-consent').checked||state.run.status==='running')return;
    const outcome=$('scan-outcome').value;
    $('scope-dialog').close();dispatch({type:'SCAN_STARTED'});
    const runId=state.run.id;
    scanTimers.forEach(clearTimeout);scanTimers=[];
    for(let step=1;step<=8;step++)scanTimers.push(setTimeout(()=>{
      dispatch({type:'SCAN_PROGRESS',runId,processed:step*18});
      if(step===8){dispatch(outcome==='failed'?{type:'SCAN_FAILED',runId}:{type:'SCAN_COMPLETED',runId,total:files.length});announce(state.banner||'Demo scan ended.');}
    },step*420));
  };
  $('cancel-scan').onclick=()=>{dispatch({type:'SCAN_CANCELLED'});announce(state.banner);$('scan-trigger').focus();};
  $('dismiss-banner').onclick=()=>{dispatch({type:'BANNER_DISMISSED'});$('scan-trigger').focus();};
  $('files-toggle').onclick=()=>{dispatch({type:state.mode==='list'?'CITY_REQUESTED':'LIST_REQUESTED'});};
  $('return-city').onclick=()=>{dispatch({type:'CITY_REQUESTED'});$('files-toggle').focus();};
  $('details-toggle').onclick=()=>{dispatch({type:state.inspectorOpen?'INSPECTOR_CLOSED':'INSPECTOR_OPENED'});if(state.inspectorOpen&&root.clientWidth<=820)$('close-inspector').focus();};
  $('close-inspector').onclick=()=>{dispatch({type:'INSPECTOR_CLOSED'});$('details-toggle').focus();};
  $('clear-selection').onclick=()=>{dispatch({type:'SELECTION_CLEARED'});$('file-search').focus();};
  $('focus-file').onclick=focusSelected;
  $('reveal-selection').onclick=()=>{$('file-search').value='';dispatch({type:'QUERY_CHANGED',query:''});$('file-search').focus();};
  $('copy-path').onclick=async()=>{
    const f=byId.get(state.selectedId);if(!f)return;
    try {if(!navigator.clipboard?.writeText)throw new Error('Clipboard is unavailable.');await navigator.clipboard.writeText(f.path);toast('Relative path copied.');}
    catch { $('copy-fallback').hidden=false;$('copy-path-text').value=f.path;$('copy-path-text').focus();$('copy-path-text').select(); }
  };
  $('zoom-in').onclick=()=>changeCamera({zoom:Math.min(6,state.camera.zoom*1.15)});
  $('zoom-out').onclick=()=>changeCamera({zoom:Math.max(.3,state.camera.zoom/1.15)});
  $('fit-city').onclick=()=>dispatch({type:'FIT_REQUESTED'});
  $('top-toggle').onclick=()=>dispatch({type:'TOP_TOGGLED'});
  $('help-trigger').onclick=()=>showDialog('help-dialog',$('help-trigger'));
  function stepCamera(step){
    const c=state.camera;
    const dx=Math.cos(c.yaw)*2,dz=Math.sin(c.yaw)*2;
    if(step==='left')changeCamera({x:c.x-dx,z:c.z+dz});if(step==='right')changeCamera({x:c.x+dx,z:c.z-dz});
    if(step==='up')changeCamera({x:c.x-dz,z:c.z-dx});if(step==='down')changeCamera({x:c.x+dz,z:c.z+dx});
    if(state.mode!=='top'&&step==='rotate-left')changeCamera({yaw:c.yaw-.16});
    if(state.mode!=='top'&&step==='rotate-right')changeCamera({yaw:c.yaw+.16});
  }
  document.querySelectorAll('[data-camera-step]').forEach(b=>{b.onclick=()=>stepCamera(b.dataset.cameraStep);});
  root.addEventListener('keydown',e=>{
    if(e.defaultPrevented||e.isComposing||e.keyCode===229)return;
    const target=e.target,editable=Boolean(target.closest('input,textarea,select,[contenteditable="true"]'));
    const inCanvas=target===$('city-canvas');
    if(e.key==='Escape'){
      const action=CIModel.escapeIntent({inSearch:target===$('file-search'),query:state.query,
        inInspector:$('inspector').contains(target),narrowDrawer:root.clientWidth<=820,inCanvas,selected:Boolean(state.selectedId)});
      if(action==='clear-query'){$('file-search').value='';dispatch({type:'QUERY_CHANGED',query:''});e.preventDefault();e.stopPropagation();}
      if(action==='close-inspector'){$('close-inspector').click();e.preventDefault();e.stopPropagation();}
      if(action==='clear-selection'){dispatch({type:'SELECTION_CLEARED'});e.preventDefault();e.stopPropagation();}
      return;
    }
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.key==='/'&&!editable){$('file-search').focus();e.preventDefault();return;}
    if(!inCanvas||editable)return;
    let handled=true;
    switch(e.key.toLowerCase()){
      case 'f':dispatch({type:'FIT_REQUESTED'});break;
      case 't':dispatch({type:'TOP_TOGGLED'});break;
      case '+':case '=':$('zoom-in').click();break;
      case '-':$('zoom-out').click();break;
      case 'enter':focusSelected();break;
      case 'arrowleft':stepCamera(e.shiftKey?'rotate-left':'left');break;
      case 'arrowright':stepCamera(e.shiftKey?'rotate-right':'right');break;
      case 'arrowup':if(e.shiftKey&&state.mode!=='top')changeCamera({pitch:Math.min(1.42,state.camera.pitch+.08)});else stepCamera('up');break;
      case 'arrowdown':if(e.shiftKey&&state.mode!=='top')changeCamera({pitch:Math.max(.28,state.camera.pitch-.08)});else stepCamera('down');break;
      default:handled=false;
    }
    if(handled){e.preventDefault();e.stopPropagation();}
  });
  $('theme-select').onchange=e=>{document.body.dataset.theme=e.target.value;renderer?.setTheme(e.target.value);};
  $('host-note-toggle').onclick=()=>{$('host-note').hidden=!$('host-note').hidden;$('host-note-toggle').setAttribute('aria-pressed',String(!$('host-note').hidden));};
  $('simulate-fallback').onclick=()=>{
    fallback=!fallback;$('simulate-fallback').setAttribute('aria-pressed',String(fallback));
    $('list-reason').textContent=fallback?'Simulated renderer failure. The list retains every file, measurement, query, and selection.':'The same snapshot, selection, and search — without a 3D viewport.';
    if(fallback){dispatch({type:'LIST_REQUESTED'});$('files-toggle').disabled=true;announce('Simulated renderer unavailable. File inventory remains usable.');}
    else {$('files-toggle').disabled=false;dispatch({type:'CITY_REQUESTED'});announce('3D view restored.');}
  };

  function renderOverview(){
    $('stat-files').textContent=files.length;
    $('stat-districts').textContent=groups.length;
    $('stat-lines').textContent=files.reduce((n,f)=>n+f.lines,0).toLocaleString('en');
    $('stat-bytes').textContent=(files.reduce((n,f)=>n+f.bytes,0)/1048576).toFixed(2)+' MiB';
    $('district-list').innerHTML=groups.map((g,i)=>`<button class="district-row" data-district="${esc(g)}" title="Focus ${esc(g)}" style="--district-color:${colors[i%6]}"><span class="district-dot"></span><span class="district-name">${esc(g)}</span><small>${files.filter(f=>f.group===g).length}</small></button>`).join('');
    $('largest-files').innerHTML=files.slice().sort((a,b)=>b.lines-a.lines).slice(0,4).map(f=>`<button class="largest-row" data-file-id="${esc(f.id)}" title="Inspect ${esc(f.path)}"><span>${icon('file')}${esc(f.name)}</span><span>${f.lines}</span></button>`).join('');
    $('district-list').onclick=e=>{const b=e.target.closest('[data-district]');if(b&&renderer){if(state.mode==='list')dispatch({type:'CITY_REQUESTED'});renderer.focusDistrict(b.dataset.district);announce('Camera focused on '+b.dataset.district);}};
  }
  function renderConnections(file){
    const out=links.filter(e=>e.source===file.id),incoming=links.filter(e=>e.target===file.id);
    $('connection-count').textContent=out.length+incoming.length;
    function section(label,edges,inbound){return `<div class="connection-heading">${label} · ${edges.length}</div>`+(edges.length?edges.map(e=>{const f=byId.get(inbound?e.source:e.target);return `<button class="connection-row" data-file-id="${esc(f.id)}">${icon(inbound?'back':'arrow')}<span>${esc(f.name)}<small>${esc(f.path)}</small></span></button>`;}).join(''):'<p class="no-connections">None recorded in this example.</p>');}
    $('connection-list').innerHTML='<div class="connection-legend"><span><i style="background:#a88bff"></i>Outgoing</span><span><i style="background:#62ceea"></i>Incoming</span></div>'+section('OUTGOING',out,false)+section('INCOMING',incoming,true);
  }
  function renderLegend(){
    const pairs=$('lens-select').value==='directory'?groups.map((g,i)=>[g.replace(/^src\//,''),colors[i%6]]):[['TypeScript','#689ffe'],['Vue','#51cdb4'],['Tests','#b095ee']];
    $('legend-types').innerHTML=pairs.map(([label,color])=>`<span><i style="--swatch:${color}"></i>${esc(label)}</span>`).join('');
  }
  function setTab(name){
    detailsTab=name;
    for(const n of ['overview','connections']){$('tab-'+n).setAttribute('aria-selected',String(n===name));$('tab-'+n).tabIndex=n===name?0:-1;$('file-'+n).hidden=n!==name;}
  }
  $('tab-overview').onclick=()=>setTab('overview');$('tab-connections').onclick=()=>setTab('connections');setTab('overview');
  document.querySelector('.inspector-tabs').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();setTab(e.key==='Home'?'overview':e.key==='End'?'connections':detailsTab==='overview'?'connections':'overview');$('tab-'+detailsTab).focus();}});
  $('ribbon-city').onclick=()=>{if(!fallback)dispatch({type:'CITY_REQUESTED'});};
  $('ribbon-files').onclick=()=>dispatch({type:'LIST_REQUESTED'});
  $('ribbon-search').onclick=()=>$('file-search').focus();
  $('ribbon-help').onclick=()=>showDialog('help-dialog',$('ribbon-help'));

  renderLists();renderOverview();renderLegend();updateUI();
  try {
    renderer=new CodebaseInspector3D.ThreeCity($('city-canvas'),files,()=>state,changeCamera,selectFile,{
      relationships:links,minimap:$('minimap'),
      onStats:s=>{$('engine-status').textContent=`Three.js r${s.revision} · WebGL2 · ${s.drawCalls} draw calls`;
        $('relation-summary').textContent=!renderer?.showLinks?'Connections hidden · structural view':state.selectedId?`${s.displayedLinks} example file connections · not source analysis`:`${s.displayedLinks} district routes · ${links.length} sample connections`;
        document.querySelector('.scene-orientation .icon').style.transform=`rotate(${-state.camera.yaw}rad)`;},
      onContextLost:()=>{fallback=true;dispatch({type:'LIST_REQUESTED'});$('list-reason').textContent='Graphics context lost. File inventory is retained.';},
      onContextRestored:()=>{fallback=false;dispatch({type:'CITY_REQUESTED'});}
    });
  } catch(error) {
    window.__CI_STARTUP_ERROR__=String(error);fallback=true;
    dispatch({type:'LIST_REQUESTED'});$('simulate-fallback').disabled=true;
    $('list-reason').textContent='WebGL2 is unavailable in this browser. The complete file inventory remains usable.';
    $('engine-status').textContent='WebGL2 unavailable · HTML inventory';
  }
  $('lens-select').onchange=e=>{renderer?.setLens(e.target.value);renderLegend();};
  $('links-toggle').onchange=e=>renderer?.setLinks(e.target.checked);
  $('labels-toggle').onchange=e=>renderer?.setLabels(e.target.checked);
  $('detail-toggle').onchange=e=>renderer?.setDetail(e.target.checked);
  $('save-view').onclick=()=>{if(!renderer)return;const a=document.createElement('a');a.href=renderer.capture();a.download='codebase-inspector-concept-city.png';a.click();toast('City PNG exported. Interface and HTML labels are not included.');};
  function dispose(){if(destroyed)return;destroyed=true;renderer?.dispose();scanTimers.forEach(clearTimeout);clearTimeout(announceTimer);clearTimeout(toastTimer);}
  window.addEventListener('pagehide',dispose,{once:true});
  // Review-only inspection hook. Do not include in the production plugin.
  window.__CI_REVIEW__={state:()=>JSON.parse(JSON.stringify(state)),events:()=>eventHistory.slice(),
    frames:()=>renderer?.frames||0,stats:()=>renderer?.stats(),renderer:()=>renderer,select:selectFile,dispatch,dispose,
    projectedCenter:id=>{const p=renderer.positions.get(id),r=$('city-canvas').getBoundingClientRect();if(!p)return null;const q=renderer.project({x:p.x,y:p.h,z:p.z},state.camera,r.width,r.height);return {x:q.x+r.left,y:q.y+r.top};},
    positions:()=>Object.fromEntries([...renderer.positions].map(([id,p])=>[id,{...p}]))};
})();
