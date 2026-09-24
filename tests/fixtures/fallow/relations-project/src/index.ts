import { runA } from './core/a';
import { render } from './ui/view';
import { helper } from './barrel/index';
import './does-not-exist';

export function main(): number {
  return runA(0) + render({ id: helper() });
}
