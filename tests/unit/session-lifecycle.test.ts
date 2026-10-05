import { describe, expect, it, vi } from 'vitest';
import { SessionLifecycle, withSession, type SessionSteps } from '../support/session-lifecycle';

function setup() {
  const client = { id: 'owned-session' };
  const order: string[] = [];
  const steps = {
    prepare: vi.fn(async () => { order.push('prepare'); }),
    connect: vi.fn(async () => { order.push('connect'); return client; }),
    initialize: vi.fn(async (_client: typeof client) => { order.push('initialize'); }),
    disconnect: vi.fn(async (_client: typeof client) => { order.push('disconnect'); }),
    cleanup: vi.fn(async () => { order.push('cleanup'); }),
  } satisfies SessionSteps<typeof client>;
  return { client, steps, order, session: new SessionLifecycle(steps) };
}

describe('native session ownership', () => {
  it('starts only once and disconnects before removing owned directories', async () => {
    const { session, client, steps, order } = setup();
    const first = session.start();
    expect(session.start()).toBe(first);
    expect(await first).toBe(client);
    const closing = session.close();
    expect(session.close()).toBe(closing);
    await closing;
    expect(order).toEqual(['prepare', 'connect', 'initialize', 'disconnect', 'cleanup']);
    expect(steps.disconnect).toHaveBeenCalledWith(client);
    await expect(session.start()).rejects.toThrow('closed');
  });

  it.each(['prepare', 'connect', 'initialize'] as const)('cleans partial startup when %s rejects', async stage => {
    const { session, steps } = setup();
    steps[stage].mockRejectedValueOnce(new Error(`${stage} failed`));
    await expect(session.start()).rejects.toThrow(`${stage} failed`);
    await session.close();
    expect(steps.cleanup).toHaveBeenCalledTimes(1);
    expect(steps.disconnect).toHaveBeenCalledTimes(stage === 'initialize' ? 1 : 0);
  });

  it('cleans directories even when disconnect fails and reports both errors', async () => {
    const { session, steps } = setup();
    await session.start();
    const driverError = new Error('driver failed');
    const directoryError = new Error('directory failed');
    steps.disconnect.mockRejectedValueOnce(driverError);
    steps.cleanup.mockRejectedValueOnce(directoryError);
    await expect(session.close()).rejects.toMatchObject({ errors: [driverError, directoryError] });
    expect(steps.cleanup).toHaveBeenCalledTimes(1);
    await expect(session.close()).rejects.toThrow('teardown');
    expect(steps.disconnect).toHaveBeenCalledTimes(1);
  });

  it('releases a late connection when cancellation happens during startup', async () => {
    const { session, steps, client } = setup();
    let connect: ((value: typeof client) => void) | undefined;
    steps.connect.mockImplementationOnce(() => new Promise(resolve => { connect = resolve; }));
    const starting = session.start();
    const rejection = expect(starting).rejects.toThrow('cancelled');
    await Promise.resolve();
    const closing = session.close();
    connect?.(client);
    await rejection;
    await closing;
    expect(steps.initialize).not.toHaveBeenCalled();
    expect(steps.disconnect).toHaveBeenCalledWith(client);
    expect(steps.cleanup).toHaveBeenCalledTimes(1);
  });

  it('does not acquire a connection when cancellation happens during preparation', async () => {
    const { session, steps } = setup();
    let finish: (() => void) | undefined;
    steps.prepare.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const starting = session.start();
    const rejection = expect(starting).rejects.toThrow('cancelled');
    const closing = session.close();
    finish?.();
    await rejection;
    await closing;
    expect(steps.connect).not.toHaveBeenCalled();
    expect(steps.cleanup).toHaveBeenCalledTimes(1);
  });

  it('permits close before start without opening a process', async () => {
    const { session, steps } = setup();
    await session.close();
    expect(steps.connect).not.toHaveBeenCalled();
    await expect(session.start()).rejects.toThrow('closed');
  });

  it('releases the session after a successful operation and returns its value', async () => {
    const { session, steps } = setup();
    expect(await withSession(session, async client => client.id)).toBe('owned-session');
    expect(steps.disconnect).toHaveBeenCalledTimes(1);
  });

  it('preserves a rejected operation while still disposing the session', async () => {
    const { session, steps } = setup();
    const failure = new Error('test assertion failed');
    await expect(withSession(session, async () => { throw failure; })).rejects.toBe(failure);
    expect(steps.disconnect).toHaveBeenCalledTimes(1);
    expect(steps.cleanup).toHaveBeenCalledTimes(1);
  });

  it('reports the primary operation and independent teardown failure together', async () => {
    const { session, steps } = setup();
    const failure = new Error('test assertion failed');
    steps.disconnect.mockRejectedValueOnce(new Error('disconnect failed'));
    await expect(withSession(session, async () => { throw failure; })).rejects.toMatchObject({
      errors: [failure, expect.objectContaining({ message: 'Native teardown failed.' })],
    });
    expect(steps.cleanup).toHaveBeenCalledTimes(1);
  });
});
