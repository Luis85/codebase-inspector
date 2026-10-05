// Part 7 Z35: "Run fallow analysis" is offered only with a snapshot and no analysis in
// flight, and its body only raises a request; "Cancel fallow analysis" only while probing or
// running (M36's rule). A new file: commands.test.ts keeps the Part 1–6 commands.
import { describe, expect, it, vi } from 'vitest';
import { registerCommands } from '../../src/host/commands';

interface AddedCommand { id: string; name?: string; checkCallback?: (checking: boolean) => boolean }
interface ViewDouble {
  hasSnapshot: () => boolean; isAnalysisActive: () => boolean; isAnalysisCancellable: () => boolean;
  requestFallowRun: ReturnType<typeof vi.fn>; cancelAnalysis: ReturnType<typeof vi.fn>;
}
const view = (snapshot: boolean, active: boolean, cancellable: boolean): ViewDouble => ({
  hasSnapshot: () => snapshot, isAnalysisActive: () => active, isAnalysisCancellable: () => cancellable,
  requestFallowRun: vi.fn(), cancelAnalysis: vi.fn(),
});
function commandFor(id: string, activeView: object | null): AddedCommand {
  const addCommand = vi.fn();
  registerCommands({ app: { workspace: { getActiveViewOfType: vi.fn(() => activeView) } }, addCommand } as never);
  const found = (addCommand.mock.calls as [AddedCommand][]).find(([c]) => c.id === id);
  if (!found) throw new Error(`test setup: no command "${id}"`);
  return found[0];
}

describe('run-fallow-analysis (Z35)', () => {
  it('is named "Run fallow analysis"', () => {
    expect(commandFor('run-fallow-analysis', null).name).toBe('Run fallow analysis');
  });

  it('is hidden without a city view, without a snapshot, or while an analysis is in flight', () => {
    expect(commandFor('run-fallow-analysis', null).checkCallback!(true)).toBe(false);
    expect(commandFor('run-fallow-analysis', view(false, false, false)).checkCallback!(true)).toBe(false);
    expect(commandFor('run-fallow-analysis', view(true, true, false)).checkCallback!(true)).toBe(false);
  });

  it('is offered with a snapshot and nothing in flight, and only raises the request when invoked', () => {
    const v = view(true, false, false);
    const command = commandFor('run-fallow-analysis', v);
    expect(command.checkCallback!(true)).toBe(true);
    expect(v.requestFallowRun).not.toHaveBeenCalled();
    expect(command.checkCallback!(false)).toBe(true);
    expect(v.requestFallowRun).toHaveBeenCalledTimes(1);
  });
});

describe('cancel-fallow-analysis (Z35, M36)', () => {
  it('is named "Cancel fallow analysis" and hidden unless the analysis is probing or running', () => {
    expect(commandFor('cancel-fallow-analysis', null).name).toBe('Cancel fallow analysis');
    expect(commandFor('cancel-fallow-analysis', null).checkCallback!(true)).toBe(false);
    expect(commandFor('cancel-fallow-analysis', view(true, true, false)).checkCallback!(true)).toBe(false);
  });

  it('cancels when invoked while cancellable', () => {
    const v = view(true, true, true);
    const command = commandFor('cancel-fallow-analysis', v);
    expect(command.checkCallback!(true)).toBe(true);
    expect(v.cancelAnalysis).not.toHaveBeenCalled();
    command.checkCallback!(false);
    expect(v.cancelAnalysis).toHaveBeenCalledTimes(1);
  });
});
