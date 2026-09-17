/* Codebase Inspector demo model. No renderer, host, filesystem, or network dependencies. */
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  else root.CIModel = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MAX_FILES = 10000;
  const categories = ['TypeScript', 'JavaScript', 'Vue', 'Tests', 'Styles', 'JSON', 'Markdown', 'Other'];
  function inferCategory(path) {
    if (/(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[^.]+$/i.test(path)) return 'Tests';
    const ext = path.split('.').pop().toLowerCase();
    return ({ts:'TypeScript',tsx:'TypeScript',js:'JavaScript',jsx:'JavaScript',mjs:'JavaScript',cjs:'JavaScript',vue:'Vue',css:'Styles',scss:'Styles',less:'Styles',json:'JSON',md:'Markdown',mdx:'Markdown'})[ext] || 'Other';
  }
  function normalizePath(value) {
    if (typeof value !== 'string' || !value.length || value.length > 1024 || /[\x00-\x1f\x7f]/.test(value)) throw new Error('Every file needs a nonempty relative path, at most 1024 characters.');
    const path = value.replace(/\\/g, '/');
    if (/^(\/|[A-Za-z]:)/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Use relative paths without empty segments, . or .. .');
    return path;
  }
  function measure(v, name) {
    if (v === undefined || v === null) return null;
    if (!Number.isSafeInteger(v) || v < 0 || v > 1e12) throw new Error(`${name} must be a nonnegative integer or null.`);
    return v;
  }
  function validateSnapshot(input) {
    if (!input || input.schemaVersion !== 1 || !Array.isArray(input.files)) throw new Error('Expected a version 1 Codebase Inspector demo snapshot with a files array. Raw fallow reports need an adapter first.');
    if (input.files.length > MAX_FILES) throw new Error(`This demo accepts at most ${MAX_FILES.toLocaleString()} files.`);
    const paths = new Set(), ids = new Set();
    const files = input.files.map((f) => {
      if (!f || typeof f !== 'object') throw new Error('Invalid file record.');
      const path = normalizePath(f.path);
      const id = f.id == null ? path : String(f.id);
      if (!id || id.length > 2048 || paths.has(path) || ids.has(id)) throw new Error('Duplicate or invalid file identity. Paths and IDs must be unique.');
      paths.add(path); ids.add(id);
      return Object.freeze({id, path, name: path.split('/').pop(), category:categories.includes(f.category) ? f.category : inferCategory(path), lines:measure(f.lines, 'lines'), bytes:measure(f.bytes, 'bytes')});
    }).sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    return Object.freeze({schemaVersion:1, name:typeof input.name === 'string' ? input.name.slice(0,120) : 'Imported codebase', source:input.source === 'synthetic' ? 'synthetic' : 'imported', files:Object.freeze(files)});
  }
  function groupOf(file) {
    const p = file.path.split('/');
    if (p.length === 1) return '(root)';
    return ['src','packages','apps'].includes(p[0]) && p.length > 2 ? p.slice(0,2).join('/') : p[0];
  }
  function groups(snapshot) {
    const map = new Map();
    snapshot.files.forEach(f => { const k=groupOf(f); if (!map.has(k)) map.set(k,[]); map.get(k).push(f); });
    return [...map].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([name,files]) => ({name,files}));
  }
  function filterFiles(files, query, category='all') {
    const q=query.trim().toLocaleLowerCase();
    return files.filter(f => (!q || f.path.toLocaleLowerCase().includes(q)) && (category === 'all' || f.category === category));
  }
  function buildLayout(snapshot) {
    let gs=groups(snapshot);
    // Bound DOM labels and platform count. Overflow is explicitly labeled in the interface.
    if (gs.length > 30) gs=[...gs.slice(0,29),{name:'Other directories',files:gs.slice(29).flatMap(g=>g.files)}];
    const columns=Math.max(1,Math.ceil(Math.sqrt(gs.length*1.45)));
    const gap=3.1, pitch=1.65, padding=2.0;
    const districts=gs.map(g=>{
      const cols=Math.max(1,Math.ceil(Math.sqrt(g.files.length*1.4)));
      const rows=Math.ceil(g.files.length/cols);
      return {...g,cols,rows,width:cols*pitch+padding,depth:rows*pitch+3.4};
    });
    const widths=Array(columns).fill(0), depths=Array(Math.ceil(gs.length/columns)).fill(0);
    districts.forEach((g,i)=>{widths[i%columns]=Math.max(widths[i%columns],g.width);depths[Math.floor(i/columns)]=Math.max(depths[Math.floor(i/columns)],g.depth)});
    const totalW=widths.reduce((a,b)=>a+b,0)+Math.max(0,widths.length-1)*gap;
    const totalD=depths.reduce((a,b)=>a+b,0)+Math.max(0,depths.length-1)*gap;
    const positions=new Map();
    districts.forEach((g,i)=>{
      const col=i%columns,row=Math.floor(i/columns);
      g.x=-totalW/2+widths.slice(0,col).reduce((a,b)=>a+b,0)+gap*col+widths[col]/2;
      g.z=-totalD/2+depths.slice(0,row).reduce((a,b)=>a+b,0)+gap*row+depths[row]/2;
      g.files.forEach((f,j)=>positions.set(f.id,{x:g.x+(j%g.cols-(g.cols-1)/2)*pitch,z:g.z+(Math.floor(j/g.cols)-(g.rows-1)/2)*pitch-.35,district:g.name}));
    });
    return {districts,positions,width:Math.max(totalW,10),depth:Math.max(totalD,10)};
  }
  function heightFor(file, metric='lines') {const v=file[metric]; return v==null ? .28 : .28 + Math.sqrt(v/(metric==='bytes'?40:1))*.235;}
  function summary(snapshot) {
    return {files:snapshot.files.length,directories:new Set(snapshot.files.map(groupOf)).size,lines:snapshot.files.reduce((n,f)=>n+(f.lines||0),0),bytes:snapshot.files.reduce((n,f)=>n+(f.bytes||0),0),unknownLines:snapshot.files.filter(f=>f.lines===null).length,unknownBytes:snapshot.files.filter(f=>f.bytes===null).length};
  }
  return {MAX_FILES,categories,inferCategory,normalizePath,validateSnapshot,groupOf,groups,filterFiles,buildLayout,heightFor,summary};
});
