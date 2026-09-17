/** Optional loopback-only static server. No runtime packages or analysis execution. */
import {createServer} from 'node:http';
import {readFile,realpath,stat} from 'node:fs/promises';
import {dirname,resolve,relative,extname,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=await realpath(dirname(fileURLToPath(import.meta.url)));
const port=Number(process.env.PORT || 4173);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be an integer from 1 to 65535.');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const within=p=>{const r=relative(root,p);return r===''||(!r.startsWith('..')&&!isAbsolute(r));};
const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-store');
  const host=(req.headers.host||'').split(':')[0];
  if(!['localhost','127.0.0.1'].includes(host)){res.writeHead(403);res.end('Loopback host required.');return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end('Read-only server.');return;}
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    if(pathname.includes('\0'))throw new Error('Invalid path');
    const candidate=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!within(candidate)){res.writeHead(403);res.end('Outside the demo directory.');return;}
    const file=await realpath(candidate);
    if(!within(file)||!(await stat(file)).isFile()){res.writeHead(403);res.end('Not an allowed file.');return;}
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
  }catch{res.writeHead(404);res.end('File not found.');}
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Codebase Inspector demo: http://127.0.0.1:${port}\nLocal assets only. Stop with Ctrl+C.`));
process.on('SIGINT',()=>server.close());
process.on('SIGTERM',()=>server.close());
