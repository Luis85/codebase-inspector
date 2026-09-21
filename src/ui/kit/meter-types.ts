import type { MetricValue } from '../evidence';

/** One bar in `MeterList.vue`. `ariaLabel` carries the whole reading, sample included. */
export interface MeterItem {
  id: string;
  label: string;
  value: MetricValue;
  tone?: 'success' | 'warning' | 'danger' | 'accent';
  ariaLabel: string;
}
