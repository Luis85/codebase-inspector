// Part 7 Z1–Z3: the durable AnalyzerBindingStore, data.json `analyzers[profileId]`. Every
// write is ONE writePluginDataSlice under the plugin-wide data lock, and the rule is
// applied to the entry found INSIDE the lock, so a concurrent write is never overwritten.
// No cache: every read goes to data.json, so a Sync or hand edit is seen at the next check.
import type { Plugin } from 'obsidian';
import { applyAnalyzerWrite, decodeAnalyzerRecord, type AnalyzerWrite } from '../../application/analysis/analyzer-record';
import type { AnalyzerBindingStore } from '../../application/ports/analyzer-binding-store';
import { readPluginData, writePluginDataSlice } from './plugin-data-shape';

export function createPluginDataAnalyzerStore(plugin: Plugin, machineId: string): AnalyzerBindingStore {
  const write = (profileId: string, change: AnalyzerWrite): Promise<void> =>
    writePluginDataSlice(plugin, 'analyzers', (current) => applyAnalyzerWrite(current, profileId, machineId, change));
  return {
    async read(profileId) {
      const data = await readPluginData(plugin);
      return decodeAnalyzerRecord(data.analyzers, profileId, machineId);
    },
    bind: (profileId, executablePath) => write(profileId, { op: 'bind', executablePath }),
    setTimeoutSeconds: (profileId, seconds) => write(profileId, { op: 'timeout', seconds }),
    grantTrust: (profileId, trust, expectedPath) => write(profileId, { op: 'grant', trust, expectedPath }),
    revokeTrust: (profileId) => write(profileId, { op: 'revoke' }),
    forget: (profileId) => write(profileId, { op: 'forget' }),
    purge: (profileId) => write(profileId, { op: 'purge' }),
  };
}
