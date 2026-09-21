import { describe, expect, it } from 'vitest';
import { csvCell, metricColumns, toCsv } from '../../src/ui/export/csv';
import { sample, unknown, type MetricValue } from '../../src/ui/evidence';

describe('csv', () => {
  it('guards formulas in strings only, and quotes per RFC 4180', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell(-1)).toBe('-1');
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell(undefined)).toBe('');
  });
  it('writes a BOM, a header, CRLF rows and a value/state pair per metric; unknown is an empty cell', () => {
    interface Row { name: string; m: MetricValue }
    const rows: Row[] = [{ name: 'a', m: sample(3) }, { name: 'b', m: unknown('no data') }];
    const text = toCsv<Row>([{ header: 'name', value: (r) => r.name }, ...metricColumns<Row>('m', (r) => r.m)], rows);
    expect(text).toBe('﻿name,m,m_state\r\na,3,sample\r\nb,,unknown\r\n');
  });
});
