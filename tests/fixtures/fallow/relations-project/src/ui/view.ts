import { runA } from '../core/a';
import type { Row } from '../data/types';
import { db } from '../data/db';

export const render = (r: Row): number => runA(0) + db.size + r.id;
