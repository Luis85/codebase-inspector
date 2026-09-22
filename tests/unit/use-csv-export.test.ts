import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import { CSV_MIME, MARKDOWN_MIME, useCsvExport } from '../../src/ui/export/use-csv-export';
import { reannounce } from '../../src/ui/kit/reannounce';
import { EXPORT_FAILED } from '../../src/ui/inspector-copy';

const host = {} as HTMLElement;
const failDownloads = () => { vi.mocked(downloadText).mockImplementation(() => { throw new Error('no window'); }); };

describe('useCsvExport (E55, Part 5 V22)', () => {
  beforeEach(() => { vi.mocked(downloadText).mockReset(); });

  it('hands the built text to downloadText through the root, CSV by default', () => {
    const live = ref('');
    useCsvExport(ref(host), live)('a.csv', () => 'x');
    expect(downloadText).toHaveBeenCalledWith(host, 'a.csv', 'x', CSV_MIME);
    expect(live.value).toBe('');
  });
  it('passes another MIME type through', () => {
    useCsvExport(ref(host), ref(''))('r.md', () => '# r', MARKDOWN_MIME);
    expect(downloadText).toHaveBeenCalledWith(host, 'r.md', '# r', MARKDOWN_MIME);
  });
  it('announces EXPORT_FAILED when the download throws, and nothing is thrown', async () => {
    failDownloads();
    const live = ref('');
    expect(() => useCsvExport(ref(host), live)('a.csv', () => 'x')).not.toThrow();
    await nextTick();
    expect(live.value).toBe(EXPORT_FAILED);
  });
  it('E17-style repeat: two consecutive failures both end with EXPORT_FAILED, clearing the message in between', async () => {
    failDownloads();
    const live = ref('');
    const run = useCsvExport(ref(host), live);
    run('a.csv', () => 'x');
    expect(live.value).toBe('');
    await nextTick();
    expect(live.value).toBe(EXPORT_FAILED);
    run('a.csv', () => 'x');
    expect(live.value).toBe('');
    await nextTick();
    expect(live.value).toBe(EXPORT_FAILED);
  });
  it('V22: a builder that throws is a real error: it propagates, nothing is downloaded or announced', async () => {
    const live = ref('');
    const run = useCsvExport(ref(host), live);
    expect(() => run('a.csv', () => { throw new Error('builder bug'); })).toThrow('builder bug');
    await nextTick();
    expect(downloadText).not.toHaveBeenCalled();
    expect(live.value).toBe('');
  });
  it('V22: a direct write between a failure and the tick is not overwritten', async () => {
    failDownloads();
    const live = ref('');
    useCsvExport(ref(host), live)('a.csv', () => 'x');
    live.value = 'Tests planned for a.ts.';
    await nextTick();
    expect(live.value).toBe('Tests planned for a.ts.');
  });
  it('V22: a later reannounce on the same region wins over a pending failure', async () => {
    failDownloads();
    const live = ref('');
    useCsvExport(ref(host), live)('a.csv', () => 'x');
    await reannounce(live, 'Plan saved.');
    await nextTick();
    expect(live.value).toBe('Plan saved.');
  });
  it('does nothing without a root', () => {
    useCsvExport(ref(null), ref(''))('a.csv', () => 'x');
    expect(downloadText).not.toHaveBeenCalled();
  });
});
