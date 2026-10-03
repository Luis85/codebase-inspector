import { spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import { breadcrumb } from './breadcrumbs';
import { runDirectory } from './diagnostics';

/** GRD1 / GCO25: opt-in. With NATIVE_PROCDUMP set to procdump64.exe, every forked worker gets a ProcDump attached to it, so an
 *  uncatchable 0xC0000409 leaves a full dump in <run>/dumps. ProcDump ends by itself when the worker ends. Unset: does nothing. */
const procdump = process.env.NATIVE_PROCDUMP;
if (procdump) {
  const dumps = path.join(runDirectory(), 'dumps');
  mkdirSync(dumps, { recursive: true });
  const log = openSync(path.join(dumps, `procdump-${process.pid}.log`), 'a');
  try {
    const child = spawn(procdump, ['-accepteula', '-ma', '-e', String(process.pid), dumps], {
      detached: false, windowsHide: true, stdio: ['ignore', log, log],
    });
    child.on('error', (error) => breadcrumb('procdump:error', { message: error.message }));
    child.unref();
    breadcrumb('procdump:attached', { pid: process.pid, procdumpPid: child.pid });
  } finally {
    closeSync(log);
  }
}
