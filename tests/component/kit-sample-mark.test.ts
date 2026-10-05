import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import '../mocks/obsidian';
import MetricCard from '../../src/ui/kit/MetricCard.vue';
import CiDialog from '../../src/ui/kit/Dialog.vue';
import { collected, sample, sumEvidence, unknown } from '../../src/ui/evidence';

describe('MetricCard sample mark (E55)', () => {
  it('marks a partial aggregate that includes sample inputs as Sample as well as Partial', () => {
    const value = sumEvidence([collected(3, 'inventory'), sample(4), unknown('x')]);
    const w = mount(MetricCard, { props: { label: 'L', icon: 'code', value } });
    expect(w.find('.ci-provenance--partial').exists()).toBe(true);
    expect(w.find('.ci-metric-card__sample').text()).toBe('Sample');
    w.unmount();
  });
  it('does not double-mark a plain sample value, nor mark a collected one', () => {
    const a = mount(MetricCard, { props: { label: 'L', icon: 'code', value: sample(4) } });
    expect(a.findAll('.ci-provenance')).toHaveLength(1);
    expect(a.find('.ci-metric-card__sample').exists()).toBe(false);
    a.unmount();
    const b = mount(MetricCard, { props: { label: 'L', icon: 'code', value: collected(4, 'inventory') } });
    expect(b.find('.ci-provenance').exists()).toBe(false);
    b.unmount();
  });
});

describe('CiDialog status region (E55)', () => {
  it('renders a role=status region inside the modal and updates its text', async () => {
    const w = mount(CiDialog, { props: { label: 'D', status: '' }, slots: { default: '<button>x</button>' }, attachTo: document.body });
    const region = w.find('[role="dialog"] .ci-dialog__status');
    expect(region.attributes('role')).toBe('status');
    await w.setProps({ status: 'Saved.' });
    expect(w.find('[role="dialog"] .ci-dialog__status').text()).toBe('Saved.');
    w.unmount();
  });
  it('renders no region without the prop', () => {
    const w = mount(CiDialog, { props: { label: 'D' }, slots: { default: '<button>x</button>' }, attachTo: document.body });
    expect(w.find('.ci-dialog__status').exists()).toBe(false);
    w.unmount();
  });
});
