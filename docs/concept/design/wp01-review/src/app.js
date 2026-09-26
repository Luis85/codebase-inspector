(function () {
  'use strict';
  const $=id=>document.getElementById(id), root=$('inspector-app');
  const files=CIFiles, byId=new Map(files.map(f=>[f.id,f]));
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
    const groups=[...new Set(matches.map(f=>f.group))];
    $('file-list').innerHTML=groups.length?groups.map(g=>`<details ${state.query||g==='src/visualization'?'open':''}><summary>${esc(g)} <span>· ${matches.filter(f=>f.group===g).length}</span></summary><ul>${matches.filter(f=>f.group===g).map(f=>`<li><button class="file-row" data-file-id="${esc(f.id)}" aria-pressed="${state.selectedId===f.id}" aria-label="Select ${esc(f.path)}"><span class="file-icon" aria-hidden="true">${f.category==='Vue'?'V':f.category==='Tests'?'T':'TS'}</span><span class="file-name">${esc(f.name)}</span></button></li>`).join('')}</ul></details>`).join(''):'<p class="empty-list">No matching files.<br>Try another path or clear the search.</p>';
    $('table-body').innerHTML=matches.map(f=>`<tr data-selected="${state.selectedId===f.id}" data-row-id="${esc(f.id)}"><td><button data-file-id="${esc(f.id)}" aria-label="Select ${esc(f.path)}">${esc(f.path)}</button></td><td>${esc(f.category)}</td><td>${f.lines.toLocaleString('en')}</td><td>${f.bytes.toLocaleString('en')}</td></tr>`).join('');
    $('table-empty').hidden=matches.length>0;
    $('match-count').textContent=state.query?`${matches.length} / ${files.length}`:String(files.length);
    $('city-summary').textContent=state.query?`${matches.length} matches · other files dimmed in place`:`${files.length} files grouped into 6 directory districts`;
    announce(`${matches.length} included files match the current search.`);
  }
  function updateUI(){
    const selected=byId.get(state.selectedId),isList=state.mode==='list';
    root.dataset.list=String(isList);root.dataset.inspector=state.inspectorOpen?'open':'closed';
    $('city-panel').hidden=isList;$('list-panel').hidden=!isList;
    $('files-toggle').setAttribute('aria-pressed',String(isList));
    $('files-toggle').textContent=isList?'City':'Files';
    $('details-toggle').disabled=!selected;
    $('details-toggle').setAttribute('aria-expanded',String(state.inspectorOpen));
    $('inspector').hidden=!(selected&&state.inspectorOpen);
    $('top-toggle').setAttribute('aria-pressed',String(state.mode==='top'));
    $('top-toggle').textContent=state.mode==='top'?'◇ 3D':'⊞ Top';
    $('snapshot-status').textContent=`${files.length} included files · 6 districts · ${state.snapshotId}`;
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
      $('focus-file').disabled=fallback;
    }
    $('banner').hidden=!state.banner;$('banner-text').textContent=state.banner||'';
    const running=state.run.status==='running';
    $('scan-progress').hidden=!running;$('scan-trigger').disabled=running;$('source-trigger').disabled=running;
    $('progress-label').textContent=`${state.run.processed} / ${files.length} synthetic records · not a real scan`;
    $('progress-meter').value=state.run.processed;
    $('return-city').disabled=fallback;
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
    if(step==='left')changeCamera({x:c.x-2});if(step==='right')changeCamera({x:c.x+2});
    if(step==='up')changeCamera({z:c.z-2});if(step==='down')changeCamera({z:c.z+2});
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
  $('theme-select').onchange=e=>{document.body.dataset.theme=e.target.value;renderer.invalidate();};
  $('host-note-toggle').onclick=()=>{$('host-note').hidden=!$('host-note').hidden;$('host-note-toggle').setAttribute('aria-pressed',String(!$('host-note').hidden));};
  $('simulate-fallback').onclick=()=>{
    fallback=!fallback;$('simulate-fallback').setAttribute('aria-pressed',String(fallback));
    $('list-reason').textContent=fallback?'Simulated renderer failure. The list retains every file, measurement, query, and selection.':'The same snapshot, selection, and search — without a 3D viewport.';
    if(fallback){dispatch({type:'LIST_REQUESTED'});$('files-toggle').disabled=true;announce('Simulated renderer unavailable. File inventory remains usable.');}
    else {$('files-toggle').disabled=false;dispatch({type:'CITY_REQUESTED'});announce('Rendering restored in the simulator.');}
  };
  renderLists();updateUI();
  renderer=new CIReviewCity($('city-canvas'),files,()=>state,changeCamera,selectFile);
  function dispose(){if(destroyed)return;destroyed=true;renderer.dispose();scanTimers.forEach(clearTimeout);clearTimeout(announceTimer);clearTimeout(toastTimer);}
  window.addEventListener('pagehide',dispose,{once:true});
  // Review-only inspection hook. Do not include in the production plugin.
  window.__CI_REVIEW__={state:()=>JSON.parse(JSON.stringify(state)),events:()=>eventHistory.slice(),
    frames:()=>renderer.frames||0,select:selectFile,dispatch,dispose,
    projectedCenter:id=>{const p=renderer.positions.get(id),r=$('city-canvas').getBoundingClientRect();if(!p)return null;const q=renderer.project({x:p.x,y:p.h,z:p.z},state.camera,r.width,r.height);return {x:q.x+r.left,y:q.y+r.top};},
    positions:()=>Object.fromEntries([...renderer.positions].map(([id,p])=>[id,{...p}]))};
})();
