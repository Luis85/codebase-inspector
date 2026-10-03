// GRD1 step 7 / GCN7: Node 24.15.0 (libuv 1.51.0) crashes the Vitest worker with 0xC0000409 in the Windows
// TCP-connect path (uv_tcp_connect, a GS stack-cookie failure); libuv 1.52+ (Node >= 24.16.0) rewrote that code.
function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/u.exec(version);
  return match === null ? null : [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** True when `version` (major.minor.patch, numeric comparison, any suffix ignored) is at least `min`. */
export function libuvAtLeast(version, min) {
  const have = parseVersion(version);
  const need = parseVersion(min);
  if (have === null || need === null) return false;
  for (let part = 0; part < 3; part += 1) {
    if (have[part] !== need[part]) return have[part] > need[part];
  }
  return true;
}
