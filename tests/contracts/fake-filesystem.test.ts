import { runContractSuite } from './source-filesystem-port.contract';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import type { FakeTree } from '../fixtures/fake-source-filesystem';

function buildFixture(): FakeTree {
  return {
    'src/a.ts': 'export const a = 1;\n',
    'excluded/secret.txt': 'top secret',
    'oversized.ts': { oversizedBytes: 500 },
    'binary.dat': { binary: true },
    'unreadable.ts': { unreadable: true },
    linked: { symlinkTo: 'src' },
  };
}

runContractSuite('fake (in-memory)', () => Promise.resolve(createFakeSourceFileSystem(buildFixture())));
