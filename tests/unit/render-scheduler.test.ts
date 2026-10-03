// Task 10 step 1. Rendering is ON DEMAND ONLY (spec G5): the scheduler is the single
// thing that decides whether a frame happens at all, so every "nothing draws while X"
// acceptance criterion is testable here, in plain Node, with no WebGL anywhere.
//
// The injected `win` is the whole point of the double below: acceptance criterion 10
// forbids a bare `requestAnimationFrame`/`document` in src/visualization/**, and a bare
// one would still pass a test that only counted draws — so the last test asserts the
// INJECTED window's rAF was the one called, which a bare global cannot satisfy.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { createScheduler } from '../../src/visualization/render-scheduler';

interface WinDouble {
  win: Window;
  requestAnimationFrame: ReturnType<typeof vi.fn>;
  cancelAnimationFrame: ReturnType<typeof vi.fn>;
  runFrames: () => void;
  setHidden: (hidden: boolean) => void;
}

/** A window double whose rAF queues callbacks instead of running them, so a test can
 *  say exactly when "the next frame" happens — `await tick()` alone would make
 *  "coalesces 50 invalidations into ONE frame" pass for the wrong reason. */
function makeWin(): WinDouble {
  let nextHandle = 1;
  const pending = new Map<number, FrameRequestCallback>();
  const doc = { hidden: false };
  const requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
    const handle = nextHandle++;
    pending.set(handle, cb);
    return handle;
  });
  const cancelAnimationFrame = vi.fn((handle: number) => { pending.delete(handle); });
  const win = { requestAnimationFrame, cancelAnimationFrame, document: doc } as unknown as Window;
  return {
    win, requestAnimationFrame, cancelAnimationFrame,
    runFrames: () => {
      const due = [...pending.entries()];
      pending.clear();
      for (const [, cb] of due) cb(0);
    },
    setHidden: (hidden: boolean) => { doc.hidden = hidden; },
  };
}

const tick = async (): Promise<void> => { await Promise.resolve(); };

describe('render scheduler', () => {
  let w: WinDouble;
  let drawSpy: Mock<() => void>;

  beforeEach(() => {
    w = makeWin();
    drawSpy = vi.fn<() => void>();
  });

  const nextFrame = (): void => { w.runFrames(); };

  it('draws nothing while idle', async () => {
    createScheduler(w.win, drawSpy);
    await tick();
    nextFrame();
    expect(drawSpy).not.toHaveBeenCalled();
  });

  it('coalesces many invalidations into ONE frame', () => {
    const s = createScheduler(w.win, drawSpy);
    for (let i = 0; i < 50; i++) s.invalidate();
    expect(w.requestAnimationFrame).toHaveBeenCalledTimes(1);
    nextFrame();
    expect(drawSpy).toHaveBeenCalledTimes(1);
  });

  it('schedules again once the coalesced frame has been drawn', () => {
    const s = createScheduler(w.win, drawSpy);
    s.invalidate();
    nextFrame();
    s.invalidate();
    nextFrame();
    expect(drawSpy).toHaveBeenCalledTimes(2);
  });

  it('draws nothing while paused', () => {
    const s = createScheduler(w.win, drawSpy);
    s.setSuspended(true);
    s.invalidate();
    nextFrame();
    expect(drawSpy).not.toHaveBeenCalled();
  });

  it('cancels an already-pending frame when it is suspended', () => {
    const s = createScheduler(w.win, drawSpy);
    s.invalidate();
    s.setSuspended(true);
    expect(w.cancelAnimationFrame).toHaveBeenCalled();
    nextFrame();
    expect(drawSpy).not.toHaveBeenCalled();
  });

  it('draws again once it is resumed', () => {
    const s = createScheduler(w.win, drawSpy);
    s.setSuspended(true);
    s.invalidate();
    s.setSuspended(false);
    s.invalidate();
    nextFrame();
    expect(drawSpy).toHaveBeenCalledTimes(1);
  });

  it('draws nothing while the context is lost', () => {
    const s = createScheduler(w.win, drawSpy);
    s.setContextLost(true);
    s.invalidate();
    nextFrame();
    expect(drawSpy).not.toHaveBeenCalled();
  });

  it('draws nothing while the owning document is hidden', () => {
    const s = createScheduler(w.win, drawSpy);
    w.setHidden(true);
    s.invalidate();
    expect(w.requestAnimationFrame).not.toHaveBeenCalled();
    nextFrame();
    expect(drawSpy).not.toHaveBeenCalled();
  });

  it('draws nothing after dispose', () => {
    const s = createScheduler(w.win, drawSpy);
    s.dispose();
    s.invalidate();
    nextFrame();
    expect(drawSpy).not.toHaveBeenCalled();
  });

  it("uses the INJECTED window's requestAnimationFrame, never a bare one", () => {
    createScheduler(w.win, drawSpy).invalidate();
    expect(w.requestAnimationFrame).toHaveBeenCalled();
  });

  it('cancels its pending frame on dispose, leaving no orphan rAF handle', () => {
    const s = createScheduler(w.win, drawSpy);
    s.invalidate();
    s.dispose();
    expect(w.cancelAnimationFrame).toHaveBeenCalled();
    nextFrame();
    expect(drawSpy).not.toHaveBeenCalled();
  });

  it('does not draw when the frame fires after dispose, even if the handle survived', () => {
    const s = createScheduler(w.win, drawSpy);
    s.invalidate();
    const queued = w.requestAnimationFrame.mock.calls[0]?.[0] as FrameRequestCallback;
    s.dispose();
    queued(0);                       // a frame the host had already committed to
    expect(drawSpy).not.toHaveBeenCalled();
  });

  it('is idempotent on dispose', () => {
    const s = createScheduler(w.win, drawSpy);
    s.dispose();
    expect(() => { s.dispose(); }).not.toThrow();
  });
});
