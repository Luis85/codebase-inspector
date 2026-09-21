import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadText } from '../../src/ui/export/download';

describe('downloadText (P8)', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('clicks a transient download anchor in the host\'s own document and revokes the URL later', () => {
    vi.useFakeTimers();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const blobs: Blob[] = [];
    const create = vi.fn((b: Blob) => { blobs.push(b); return 'blob:ci-test'; });
    const revoke = vi.fn();
    Object.assign(window.URL, { createObjectURL: create, revokeObjectURL: revoke });
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this); });

    downloadText(host, 'codebase-hotspots.csv', 'a,b\r\n');

    expect(clicked[0]?.download).toBe('codebase-hotspots.csv');
    expect(clicked[0]?.getAttribute('href')).toBe('blob:ci-test');
    expect(blobs[0]?.type).toBe('text/csv;charset=utf-8');
    expect(host.querySelector('a')).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:ci-test');
    host.remove();
  });
});
