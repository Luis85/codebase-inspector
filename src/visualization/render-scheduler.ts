// Rendering is ON DEMAND ONLY (spec G5): there is no animation loop in this plugin.
// Every visible change calls invalidate(), which coalesces into at most ONE frame, and
// nothing draws while the view is suspended, the context is lost, the owning document
// is hidden, or the renderer has been disposed.
//
// Ported from docs/concept/prototype/src/viewer.js:203 — the SHAPE of its invalidate()
// and its four guards, never its code (spec 0 rank 6: the prototype vendors r140
// against our 0.186.0 pin and is not behavioural evidence). Deliberately NOT ported:
// its `webglcontextrestored` self-healing partner (viewer.js:78). Spec 4.2 forbids a
// restore partner, and the prototype's own recorded run logged 33
// "WebGL: INVALID_OPERATION: delete: object does not belong to this context" warnings
// in exactly that path.
//
// `win` is injected, never a bare global (acceptance criterion 10, spec 4.4's
// cross-window rule): after a pop-out migration a bare requestAnimationFrame belongs
// to the wrong window and its `document.hidden` answers for the wrong document.

export interface RenderScheduler {
  /** Requests exactly one frame. Idempotent while a frame is already pending. */
  invalidate(): void;
  /** Hidden leaves suspend drawing (spec 4.2's pause/resume). Cancels a pending frame. */
  setSuspended(suspended: boolean): void;
  /** A lost context can draw nothing; the view disposes and reconstructs (spec 4.2). */
  setContextLost(lost: boolean): void;
  dispose(): void;
}

export function createScheduler(win: Window, draw: () => void): RenderScheduler {
  let frame: number | null = null;
  let disposed = false;
  let suspended = false;
  let contextLost = false;

  const cancelPending = (): void => {
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = null;
  };

  const invalidate = (): void => {
    if (disposed || contextLost || suspended || frame !== null || win.document.hidden) return;
    frame = win.requestAnimationFrame(() => {
      frame = null;
      // Re-checked inside the callback, not only before scheduling: a frame the host
      // has already committed to still fires after dispose()/setSuspended(true) if the
      // cancellation lost the race, and drawing there is exactly the "orphan frame"
      // acceptance criterion 2 forbids.
      if (disposed || contextLost || suspended) return;
      draw();
    });
  };

  return {
    invalidate,
    setSuspended(next: boolean): void {
      suspended = next;
      if (next) cancelPending();
    },
    setContextLost(next: boolean): void {
      contextLost = next;
      if (next) cancelPending();
    },
    dispose(): void {
      disposed = true;
      cancelPending();
    },
  };
}
