// Part 6 Y32 (C13, R8) and Y35: the two new kit pieces.
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import EvidenceBadge from '../../src/ui/kit/EvidenceBadge.vue';
import NotAnalysed from '../../src/ui/kit/NotAnalysed.vue';
import {
  EVIDENCE_BADGE, FALLOW_IMPORT_ACTION, FALLOW_NOT_ANALYSED_BODY, FALLOW_NOT_ANALYSED_TITLE,
} from '../../src/ui/inspector-copy';

describe('EvidenceBadge (Part 6 Y32, C13)', () => {
  it('names the provider, version, freshness and the unverified source match in text', () => {
    const w = mount(EvidenceBadge, { props: { version: '3.27.0', state: 'imported' } });
    expect(w.text()).toBe('fallow 3.27.0 · Imported · Unverified source match');
    expect(w.text()).toBe(EVIDENCE_BADGE('3.27.0', 'imported'));
    expect(w.classes()).toEqual(['ci-evidence-badge', 'ci-evidence-badge--imported']);
  });
  it('says Stale in words, never in colour alone', () => {
    const w = mount(EvidenceBadge, { props: { version: '3.21.0', state: 'stale' } });
    expect(w.text()).toBe('fallow 3.21.0 · Stale · Unverified source match');
    expect(w.classes()).toContain('ci-evidence-badge--stale');
  });

  it('Part 7 Z26: renders the collected state with its own class, and the untested flag', () => {
    const w = mount(EvidenceBadge, { props: { version: '3.28.0', state: 'collected', origin: 'collected', untested: true } });
    expect(w.text()).toBe(EVIDENCE_BADGE('3.28.0', 'collected', 'collected', true));
    expect(w.classes()).toContain('ci-evidence-badge--collected');
    w.unmount();
  });
});

describe('NotAnalysed (Part 6 Y35)', () => {
  it('says Not analysed, never zero, and emits import from one real button', async () => {
    const w = mount(NotAnalysed);
    expect(w.find('.ci-not-analysed__title').text()).toBe(FALLOW_NOT_ANALYSED_TITLE);
    expect(w.find('.ci-not-analysed__body').text()).toBe(FALLOW_NOT_ANALYSED_BODY);
    const button = w.find('button.ci-not-analysed__import');
    expect(button.attributes('type')).toBe('button');
    expect(button.text()).toBe(FALLOW_IMPORT_ACTION);
    await button.trigger('click');
    expect(w.emitted('import')).toHaveLength(1);
  });
});
