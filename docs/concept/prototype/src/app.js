/* Browser demo host. Replace this host with an Obsidian ItemView + Vue/Pinia in production. */
(function () {
  'use strict';
  const $=id=>document.getElementById(id),M=window.CIModel,V=window.CodebaseInspectorViewer;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shortKind={TypeScript:'TS',JavaScript:'JS',Vue:'V',Tests:'TEST',Styles:'CSS',JSON:'{}',Markdown:'MD',Other:'FILE'};
  const state={snapshot:M.validateSnapshot(window.CI_DEMO_SNAPSHOT),selected:null,query:'',category:'all',view:'3d',metric:'lines',theme:'dark',inspector:window.innerWidth>960,labels:true,shadows:true};
  let viewer=null,webglError=null,lastStats=null,toastTimer=null,importGeneration=0;
  function icons(scope=document){scope.querySelectorAll('[data-icon]').forEach(el=>{const name=el.dataset.icon;el.innerHTML=`<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;});}
  function announce(text){$('announcer').textContent=text;}
  function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3800);}
  function fmt(n){return n==null?'Unavailable':n.toLocaleString('en-US');}
  function size(n){if(n==null)return 'Unavailable';if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KiB';return (n/1048576).toFixed(2)+' MiB';}
  function showError(message,title='Cannot load snapshot'){$('error-title').textContent=title;$('error-description').textContent=message;$('error-dialog').showModal();}
  function matching(){return M.filterFiles(state.snapshot.files,state.query,state.category);}
  function selected(){return state.snapshot.files.find(f=>f.id===state.selected)||null;}
  function setInspector(show){state.inspector=show;$('workspace').classList.toggle('inspector-hidden',!show);$('details-button').setAttribute('aria-expanded',String(show));if(show)renderInspector();}
  function selectFile(id){if(!state.snapshot.files.some(f=>f.id===id))return;state.selected=id;viewer?.setSelected(id);setInspector(true);renderSelection();renderInspector();announce('Selected '+selected().path);}
  function clearSelection(){state.selected=null;viewer?.setSelected(null);renderSelection();renderInspector();announce('Selection cleared.');}
  function renderTree(){
    const matches=matching(),open=new Set([...$('tree').querySelectorAll('details[open]')].map(d=>d.dataset.group));
    if(!open.size&&!$('tree').childElementCount)open.add('src/visualization');
    const matchingIds=new Set(matches.map(f=>f.id));
    $('file-count').textContent=matches.length===state.snapshot.files.length?fmt(matches.length):`${fmt(matches.length)} / ${fmt(state.snapshot.files.length)}`;
    const fragment=document.createDocumentFragment();let rendered=0;
    M.groups(state.snapshot).forEach(g=>{
      const fs=g.files.filter(f=>matchingIds.has(f.id));if(!fs.length||rendered>=600)return;
      const details=document.createElement('details');details.className='tree-group';details.dataset.group=g.name;details.open=state.query.trim().length>0||open.has(g.name);
      const summary=document.createElement('summary');summary.innerHTML='<span class="chevron">›</span><span class="gname"></span><span class="gcount"></span>';summary.querySelector('.gname').textContent=g.name;summary.querySelector('.gcount').textContent=fmt(fs.length);details.append(summary);
      fs.slice(0,600-rendered).forEach(f=>{const btn=document.createElement('button');btn.className='file-row';btn.dataset.file=f.id;btn.title=f.path;btn.setAttribute('aria-label',f.path);btn.style.setProperty('--kind',V.PALETTE[f.category]);const kind=document.createElement('span');kind.className='kind-mark';kind.textContent=shortKind[f.category];const name=document.createElement('span');name.className='filename';name.textContent=f.name;btn.append(kind,name);btn.addEventListener('click',()=>selectFile(f.id));details.append(btn);rendered++;});
      fragment.append(details);
    });
    if(!matches.length){const empty=document.createElement('p');empty.className='empty-list';empty.textContent='No files match. Your snapshot and selection are unchanged.';fragment.append(empty);}
    if(matches.length>rendered){const note=document.createElement('p');note.className='empty-list';note.textContent=`Showing ${fmt(rendered)} of ${fmt(matches.length)} files. Refine search to find another file.`;fragment.append(note);}
    $('tree').replaceChildren(fragment);renderSelection();
  }
  function renderSelection(){
    document.querySelectorAll('[data-file]').forEach(el=>{const yes=el.dataset.file===state.selected;el.classList.toggle('selected',yes);if(el.tagName==='BUTTON')el.setAttribute('aria-pressed',String(yes));});
    const f=selected(),matches=new Set(matching().map(f=>f.id));$('selection-filter-warning').hidden=!f||matches.has(f.id);
    $('status-selection').textContent=f?f.path:'Select a building to inspect its file';
  }
  function renderInspector(){
    const f=selected(),s=M.summary(state.snapshot),isDemo=state.snapshot.source==='synthetic';
    $('inspector-heading').textContent=f?'FILE INSPECTOR':'SNAPSHOT';
    if(!f){
      const counts=M.categories.map(k=>({k,n:state.snapshot.files.filter(f=>f.category===k).length})).filter(v=>v.n);
      $('inspector-content').innerHTML=`<div class="file-emblem" style="--kind:var(--accent)"><span data-icon="cubes"></span></div><h2>A place for every file.</h2><p class="welcome-description">Explore the structure. Select a building to see the file behind it.</p><div class="summary-number">${fmt(s.files)}</div><div class="summary-sub">files in this snapshot</div><div class="distribution">${counts.map(({k,n})=>`<span style="background:${V.PALETTE[k]};flex:${n}"></span>`).join('')}</div><div class="distribution-list">${counts.map(({k,n})=>`<div><span class="kind-label"><i style="background:${V.PALETTE[k]}"></i>${k}</span><span>${fmt(n)}</span></div>`).join('')}</div><div class="section-label">INVENTORY TOTALS</div><dl class="metrics"><div><dt>Directory groups</dt><dd>${fmt(s.directories)}</dd></div><div><dt>Known physical lines</dt><dd>${fmt(s.lines)}</dd></div><div><dt>Known file bytes</dt><dd>${size(s.bytes)}</dd></div>${s.unknownLines?`<div><dt>Unmeasured lines</dt><dd>${fmt(s.unknownLines)} files</dd></div>`:''}</dl><div class="evidence-card"><strong>${isDemo?'Synthetic data, real rendering':'Imported measurements'}</strong><p>${isDemo?'This city illustrates the interaction design. It is not an analysis of your repository.':'Values come from the loaded JSON snapshot. They have not been checked against source files.'}</p></div>`;
    }else{
      const outside=!matching().some(x=>x.id===f.id),height=f[state.metric];
      $('inspector-content').innerHTML=`<div class="file-emblem" style="--kind:${V.PALETTE[f.category]}">${shortKind[f.category]}</div><h2>${esc(f.name)}</h2><div class="inspector-path" tabindex="0" aria-label="Relative file path">${esc(f.path)}</div><div class="tags"><span class="tag selected-tag">Selected file</span><span class="tag">${f.category}</span>${outside?'<span class="tag">Outside filter</span>':''}</div><div class="section-label">FILE MEASUREMENTS</div><dl class="metrics"><div><dt>Physical lines</dt><dd>${fmt(f.lines)}</dd></div><div><dt>File size</dt><dd>${size(f.bytes)}</dd></div><div><dt>Exact bytes</dt><dd>${fmt(f.bytes)}</dd></div><div><dt>Directory group</dt><dd>${esc(M.groupOf(f))}</dd></div></dl><p class="inspection-note">Physical lines include comments and blank lines. Height is a structural measurement, not a quality or complexity score.${height==null?' This height measurement is unavailable; the minimal lot height does not mean zero.':''}${height!=null&&M.heightFor(f,state.metric)>18?' This building reached the visual height cap; the exact value above is unchanged.':''}</p><div class="inspector-actions"><button class="button primary" id="focus-file"><span data-icon="fit"></span>Focus in city</button><button class="button" id="copy-path"><span data-icon="copy"></span>Copy relative path</button><button class="link-button" id="clear-selection">Clear selection</button></div><div class="evidence-card"><strong>${isDemo?'Illustrative snapshot':'Imported snapshot'}</strong><p>No source file was read or executed. No complexity, dependencies, coverage, or deletion-safety claims are inferred from this view.</p></div>`;
      $('focus-file').addEventListener('click',()=>{if(state.view==='list')setView('3d');if(viewer&&!viewer.contextLost){viewer.focusFile(f.id);$('city-canvas').focus({preventScroll:true});}else toast('WebGL is unavailable. The file remains accessible in the inventory.');});
      $('clear-selection').addEventListener('click',clearSelection);
      $('copy-path').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(f.path);toast('Relative path copied.');}catch{toast('Clipboard is unavailable here. Select and copy the path in Details.');$('inspector-content').querySelector('.inspector-path').focus();}});
    }
    icons($('inspector-content'));
  }
  function renderInventory(){
    const fs=matching(),frag=document.createDocumentFragment();
    fs.slice(0,500).forEach(f=>{const tr=document.createElement('tr');tr.dataset.file=f.id;const td=document.createElement('td'),b=document.createElement('button');b.textContent=f.path;b.addEventListener('click',()=>selectFile(f.id));td.append(b);tr.append(td);[f.category,fmt(f.lines),size(f.bytes)].forEach(text=>{const cell=document.createElement('td');cell.textContent=text;tr.append(cell);});frag.append(tr);});
    if(!fs.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=4;td.textContent='No files match this filter.';tr.append(td);frag.append(tr);}
    $('inventory-body').replaceChildren(frag);
    $('inventory-note').textContent=webglError?webglError:fs.length>500?`Showing 500 of ${fmt(fs.length)} matches. Refine the search; the complete snapshot remains loaded.`:'Search and selection stay synchronized with the city.';renderSelection();
  }
  function updateFilter(){const matches=matching();viewer?.setMatches(state.query.trim()||state.category!=='all'?new Set(matches.map(f=>f.id)):null);renderTree();renderInspector();if(state.view==='list')renderInventory();announce(`${matches.length} matching files.`);}
  function setView(mode){
    if(mode==='list'){state.view='list';$('viewport').hidden=true;$('inventory-panel').hidden=false;viewer?.setSuspended(true);renderInventory();}
    else if(webglError||!viewer||viewer.contextLost){
      if(viewer?.contextLost){viewer.restoreContext();toast('Requesting restoration of the WebGL context…');}
      else toast('WebGL is unavailable. Use the HTML inventory in Files.');
      state.view='list';$('viewport').hidden=true;$('inventory-panel').hidden=false;renderInventory();
    }else{state.view=mode;$('inventory-panel').hidden=true;$('viewport').hidden=false;viewer.setSuspended(false);viewer.setMode(mode);}
    ['3d','top','list'].forEach(k=>{const b=$('mode-'+k);b.classList.toggle('active',state.view===k);b.setAttribute('aria-pressed',String(state.view===k));});
  }
  function renderMeta(){
    const s=M.summary(state.snapshot),isDemo=state.snapshot.source==='synthetic';$('project-name').textContent=state.snapshot.name;$('source-description').textContent=isDemo?'Synthetic example · read-only snapshot':'Imported JSON · not source-verified';
    $('city-description').textContent=`${fmt(s.files)} files. ${fmt(s.directories)} directory groups. One navigable model.`;$('status-left').textContent=`${fmt(s.files)} files · ${fmt(s.directories)} groups · ${isDemo?'synthetic data':'imported snapshot'}`;
    $('empty-scene').hidden=s.files!==0;
    if(s.directories>30)$('city-description').textContent+=` Displayed in 30 districts; overflow is grouped.`;
    const cats=M.categories.filter(k=>state.snapshot.files.some(f=>f.category===k));
    $('legend').innerHTML=cats.map(k=>`<span class="legend-item"><i style="background:${V.PALETTE[k]}"></i>${k}</span>`).join('');
  }
  function publishSnapshot(input){
    const next=M.validateSnapshot(input);state.snapshot=next;state.selected=null;state.query='';state.category='all';$('search').value='';$('category-filter').value='all';
    if(viewer){viewer.selectedId=null;viewer.matches=null;viewer.saved3d=null;viewer.loadSnapshot(next);}
    renderMeta();renderTree();renderInspector();if(state.view==='list')renderInventory();announce(`Loaded ${next.files.length} files from ${next.name}.`);
  }
  function download(data,type,filename){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  function showHover(file,point){const card=$('hover-card');if(!file||!point){card.hidden=true;return;}card.innerHTML=`<strong>${esc(file.name)}</strong><span>${esc(file.path)}</span><span>${fmt(file.lines)} physical lines · ${size(file.bytes)}</span>`;card.hidden=false;const r=$('viewport').getBoundingClientRect();card.style.left=Math.max(12,Math.min(point.x-r.left+17,r.width-card.offsetWidth-12))+'px';card.style.top=Math.max(12,Math.min(point.y-r.top-15,r.height-card.offsetHeight-70))+'px';}
  icons();M.categories.forEach(k=>{const o=document.createElement('option');o.value=k;o.textContent=k;$('category-filter').append(o);});
  try{
    viewer=new V.CityViewer({canvas:$('city-canvas'),labels:$('district-labels'),onSelect:selectFile,onHover:showHover,onRendered:s=>{lastStats=s;$('engine-status').textContent='WebGL2 · local';$('diagnostics-button').textContent=`r${s.revision} · instanced · ${s.drawCalls} draws`;},onContextLost:()=>{webglError='The WebGL context was lost. The snapshot and selection are preserved. Return to 3D requests recovery.';$('engine-status').textContent='Context lost';setView('list');toast('WebGL context lost. Your data remains available in Files.');},onContextRestored:()=>{webglError=null;$('engine-status').textContent='WebGL2 · local';setView('3d');toast('WebGL context restored.');}});
    viewer.loadSnapshot(state.snapshot);
  }catch(error){webglError=error.message;$('engine-status').textContent='HTML fallback';state.view='list';}
  renderMeta();renderTree();renderInspector();setInspector(state.inspector);if(state.view==='list')setView('list');
  $('search').addEventListener('input',e=>{state.query=e.target.value;updateFilter();});
  $('search').addEventListener('keydown',e=>{if(e.isComposing)return;if(e.key==='Escape'&&state.query){e.preventDefault();e.stopPropagation();state.query='';$('search').value='';updateFilter();}else if(e.key==='Enter'){const first=matching()[0];if(first){e.preventDefault();selectFile(first.id);}}});
  $('category-filter').addEventListener('change',e=>{state.category=e.target.value;updateFilter();});
  $('clear-filter').addEventListener('click',()=>{state.query='';state.category='all';$('search').value='';$('category-filter').value='all';updateFilter();});
  $('height-metric').addEventListener('change',e=>{state.metric=e.target.value;viewer?.setMetric(state.metric);$('height-description').textContent=`Height = ${state.metric==='lines'?'physical lines':'file bytes'} · square-root scale · equal file footprints`;renderInspector();});
  ['3d','top','list'].forEach(k=>$('mode-'+k).addEventListener('click',()=>setView(k)));
  $('restore-3d').addEventListener('click',()=>setView('3d'));
  $('zoom-in').addEventListener('click',()=>viewer?.zoom(1.2));$('zoom-out').addEventListener('click',()=>viewer?.zoom(1/1.2));$('fit-button').addEventListener('click',()=>viewer?.fit());$('rotate-left').addEventListener('click',()=>{if(state.view==='top')setView('3d');viewer?.orbit(Math.PI/8);});
  $('labels-button').addEventListener('click',()=>{state.labels=!state.labels;viewer?.setLabels(state.labels);$('labels-button').setAttribute('aria-pressed',String(state.labels));});
  $('shadows-button').addEventListener('click',()=>{state.shadows=!state.shadows;viewer?.setShadows(state.shadows);$('shadows-button').setAttribute('aria-pressed',String(state.shadows));});
  $('close-inspector').addEventListener('click',()=>{setInspector(false);$('details-button').focus();});$('details-button').addEventListener('click',()=>setInspector(!state.inspector));
  $('explorer-button').addEventListener('click',()=>$('workspace').classList.toggle('explorer-open'));
  $('theme-button').addEventListener('click',()=>{state.theme=state.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=state.theme;viewer?.setTheme(state.theme);$('theme-button').dataset.icon=state.theme==='dark'?'sun':'moon';$('theme-button').setAttribute('aria-label',`Switch to ${state.theme==='dark'?'light':'dark'} theme`);icons($('theme-button').parentElement);});
  $('reset-demo').addEventListener('click',()=>{importGeneration++;publishSnapshot(window.CI_DEMO_SNAPSHOT);toast('Restored the included synthetic snapshot.');});
  $('import-button').addEventListener('click',()=>$('snapshot-input').click());
  $('snapshot-input').addEventListener('change',async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;const gen=++importGeneration;
    if(file.size>10*1024*1024){showError('The snapshot is larger than the 10 MiB import limit.');return;}
    try{const text=await file.text();if(gen!==importGeneration)return;const next=M.validateSnapshot(JSON.parse(text));publishSnapshot(next);toast(`Loaded ${next.files.length} files. Nothing was uploaded.`);}catch(error){if(gen===importGeneration)showError(error.message);}
  });
  $('export-button').addEventListener('click',()=>download(JSON.stringify(state.snapshot,null,2),'application/json','codebase-inspector.snapshot.json'));
  const openHelp=()=>$('help-dialog').showModal();$('help-button').addEventListener('click',openHelp);$('diagnostics-button').addEventListener('click',openHelp);$('help-done').addEventListener('click',()=>$('help-dialog').close());document.querySelector('.dialog-close').addEventListener('click',()=>$('help-dialog').close());$('error-done').addEventListener('click',()=>$('error-dialog').close());document.querySelector('.error-close').addEventListener('click',()=>$('error-dialog').close());
  $('context-test-button').addEventListener('click',()=>{$('help-dialog').close();if(viewer&&!viewer.contextLost)viewer.simulateContextLoss();else toast('No active WebGL context is available to test.');});
  $('city-canvas').addEventListener('keydown',e=>{
    if(e.isComposing||e.ctrlKey||e.metaKey||e.altKey||e.defaultPrevented)return;let handled=true;
    switch(e.key.toLowerCase()){
      case'f':viewer?.fit();break;case't':setView(state.view==='top'?'3d':'top');break;
      case'+':case'=':viewer?.zoom(1.15);break;case'-':viewer?.zoom(1/1.15);break;
      case'enter':if(state.selected)viewer?.focusFile(state.selected);break;
      case'escape':clearSelection();break;
      case'arrowleft':e.shiftKey||state.view==='top'?viewer?.pan(30,0):viewer?.orbit(.12);break;
      case'arrowright':e.shiftKey||state.view==='top'?viewer?.pan(-30,0):viewer?.orbit(-.12);break;
      case'arrowup':e.shiftKey||state.view==='top'?viewer?.pan(0,30):viewer?.orbit(0,-.08);break;
      case'arrowdown':e.shiftKey||state.view==='top'?viewer?.pan(0,-30):viewer?.orbit(0,.08);break;
      default:handled=false;
    }
    if(handled){e.preventDefault();e.stopPropagation();}
  });
  $('app').addEventListener('keydown',e=>{if(e.isComposing||e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey)return;const editable=e.target.matches('input,textarea,select,[contenteditable=true]');if(e.key==='/'&&!editable){e.preventDefault();$('search').focus();}else if(e.key==='Escape'&&window.innerWidth<=960&&$('inspector').contains(e.target)){e.preventDefault();setInspector(false);$('details-button').focus();}});
  window.addEventListener('pagehide',e=>{if(!e.persisted)viewer?.dispose();});
  // Introspection and host seam for the supplied automated tests and integration examples.
  // No user source content or ambient filesystem capabilities are exposed.
  window.CIDemo={get viewer(){return viewer;},getState:()=>({...state,snapshot:state.snapshot,stats:lastStats}),selectFile,clearSelection,setView,publishSnapshot,matching,exportCityImage:()=>{if(!viewer)throw new Error('WebGL unavailable');const a=document.createElement('a');a.href=viewer.capture();a.download='codebase-city.png';a.click();},dispose:()=>viewer?.dispose()};
})();
