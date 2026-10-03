// Part 7 Z4/Z22: a scriptable ExecutableInspectorPort. By default every path is a native
// executable with fixed facts; a test replaces `answer` to model a changed or vanished file.
import type { ExecutableFacts, ExecutableInspection, ExecutableInspectorPort } from '../../src/application/ports/executable-inspector';

export function factsFor(executablePath: string, overrides: Partial<ExecutableFacts> = {}): ExecutableFacts {
  return { executablePath, realPath: executablePath, size: 12_400_000, mtimeMs: 1_758_600_000_000, format: 'pe', insideRoot: false, ...overrides };
}

export interface FakeExecutableInspector extends ExecutableInspectorPort {
  readonly calls: { executablePath: string; rootPath: string }[];
  answer: (executablePath: string) => ExecutableInspection;
}

export function createFakeExecutableInspector(executableName: 'fallow.exe' | 'fallow' = 'fallow.exe'): FakeExecutableInspector {
  const inspector: FakeExecutableInspector = {
    calls: [],
    executableName,
    answer: (executablePath) => ({ ok: true, facts: factsFor(executablePath) }),
    inspect(executablePath, rootPath) {
      inspector.calls.push({ executablePath, rootPath });
      return Promise.resolve(inspector.answer(executablePath));
    },
  };
  return inspector;
}
