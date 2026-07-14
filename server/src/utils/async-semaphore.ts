import { R, type Result } from '@alliance/common/result';

/** The task was rejected by the limiter, not attempted and failed. */
export enum SemaphoreRejection {
  QueueOverflow = 'queue-overflow',
}

export class AsyncSemaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(
    private readonly maxActive: number,
    private readonly maxQueued: number,
  ) {}

  /**
   * Runs `fn` under the concurrency cap. Failure means the queue was full
   * and `fn` was never invoked (load shedding); a rejection from `fn`
   * itself still propagates as a rejection — shed and attempted-but-failed
   * are deliberately separate channels.
   */
  async run<T>(fn: () => Promise<T>): Promise<Result<T, SemaphoreRejection>> {
    const permit = await this.acquire();
    if (!permit.ok) {
      return permit;
    }
    try {
      return R.success(await fn());
    } finally {
      permit.value();
    }
  }

  private acquire(): Promise<Result<() => void, SemaphoreRejection>> {
    if (this.active < this.maxActive) {
      this.active++;
      return Promise.resolve(R.success(() => this.release()));
    }

    if (this.queue.length >= this.maxQueued) {
      return Promise.resolve(R.failure(SemaphoreRejection.QueueOverflow));
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve(R.success(() => this.release()));
      });
    });
  }

  private release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}
