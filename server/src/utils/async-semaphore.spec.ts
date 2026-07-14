import { R } from '@alliance/common/result';
import { AsyncSemaphore, SemaphoreRejection } from './async-semaphore';

describe('AsyncSemaphore', () => {
  it('runs up to maxActive tasks and queues the rest', async () => {
    const semaphore = new AsyncSemaphore(2, 10);
    let running = 0;
    let peak = 0;
    const finish: Array<() => void> = [];

    const tasks = Array.from({ length: 5 }, () =>
      semaphore.run(() => {
        running++;
        peak = Math.max(peak, running);
        return new Promise<void>((resolve) => {
          finish.push(() => {
            running--;
            resolve();
          });
        });
      }),
    );

    await Promise.resolve();
    expect(peak).toBe(2);

    while (finish.length > 0) {
      finish.shift()!();
      await Promise.resolve();
    }
    await Promise.all(tasks);
    expect(peak).toBe(2);
  });

  it('fails with queue-overflow once the queue is full', async () => {
    const semaphore = new AsyncSemaphore(1, 1);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));

    const active = semaphore.run(() => gate);
    const queued = semaphore.run(() => gate);
    // Shed tasks must be distinguishable from attempted-and-failed ones
    // (which reject) — callers may skip caching only for the shed class.
    await expect(semaphore.run(() => gate)).resolves.toEqual(
      R.failure(SemaphoreRejection.QueueOverflow),
    );

    release();
    await Promise.all([active, queued]);
  });
});
