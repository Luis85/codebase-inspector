import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import { CSV_MIME, MARKDOWN_MIME, useCsvExport } from '../../src/ui/export/use-csv-export';
import { EXPORT_FAILED } from '../../src/ui/inspector-copy';

const host = {} as HTMLElement;

describe('useCsvExport (Part 4 E55)', () => {
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
  it('announces EXPORT_FAILED when the download throws, and nothing is thrown', () => {
    vi.mocked(downloadText).mockImplementation(() => { throw new Error('no window'); });
    const live = ref('');
    expect(() => useCsvExport(ref(host), live)('a.csv', () => 'x')).not.toThrow();
    expect(live.value).toBe(EXPORT_FAILED);
  });
  it('does nothing without a root', () => {
    useCsvExport(ref(null), ref(''))('a.csv', () => 'x');
    expect(downloadText).not.toHaveBeenCalled();
  });
});
