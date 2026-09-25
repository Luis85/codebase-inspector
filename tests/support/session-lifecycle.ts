export interface SessionSteps<T> {
  prepare(): Promise<void>;
  connect(): Promise<T>;
  initialize(session: T): Promise<void>;
  disconnect(session: T): Promise<unknown>;
  cleanup(): Promise<void>;
}

/** One owner for partial startup, cancellation and idempotent teardown. */
export class SessionLifecycle<T> {
  private client: T | undefined;
  private starting: Promise<T> | undefined;
  private closing: Promise<void> | undefined;
  private releasing: Promise<void> | undefined;
  private stopped = false;

  constructor(private readonly steps: SessionSteps<T>) {}

  start(): Promise<T> {
    if (this.stopped) return Promise.reject(new Error('Native session has been closed.'));
    this.starting ??= this.acquire();
    return this.starting;
  }

  close(): Promise<void> {
    this.stopped = true;
    this.closing ??= (async () => {
      // A late connection still belongs to us and must be closed when it arrives.
      await this.starting?.catch(() => undefined);
      await this.release();
    })();
    return this.closing;
  }

  private assertActive(): void {
    if (this.stopped) throw new Error('Native session startup was cancelled.');
  }

  private async acquire(): Promise<T> {
    try {
      await this.steps.prepare();
      this.assertActive();
      this.client = await this.steps.connect();
      this.assertActive();
      await this.steps.initialize(this.client);
      this.assertActive();
      return this.client;
    } catch (error) {
      this.stopped = true;
      try { await this.release(); }
      // oxlint-disable-next-line preserve-caught-error -- both caught errors are kept in AggregateError.errors.
      catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Native startup and cleanup failed.'); }
      throw error;
    }
  }

  private release(): Promise<void> {
    this.releasing ??= (async () => {
      const failures: unknown[] = [];
      if (this.client !== undefined) {
        try { await this.steps.disconnect(this.client); }
        catch (error) { failures.push(error); }
        this.client = undefined;
      }
      // Directory cleanup must run even when session deletion fails.
      try { await this.steps.cleanup(); }
      catch (error) { failures.push(error); }
      if (failures.length) throw new AggregateError(failures, 'Native teardown failed.');
    })();
    return this.releasing;
  }
}

type Outcome<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** Preserve a test/setup failure even when teardown independently fails. */
export async function withSession<T, R>(session: SessionLifecycle<T>, use: (client: T) => Promise<R>): Promise<R> {
  let result: Outcome<R>;
  try { result = { ok: true, value: await use(await session.start()) }; }
  catch (error) { result = { ok: false, error }; }
  try { await session.close(); }
  catch (error) {
    // oxlint-disable-next-line preserve-caught-error -- both caught errors are kept in AggregateError.errors.
    if (!result.ok) throw new AggregateError([result.error, error], 'Native operation and teardown failed.');
    throw error;
  }
  if (!result.ok) throw result.error;
  return result.value;
}
