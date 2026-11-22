import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import writeFileAtomic from "write-file-atomic";
import { z } from "zod";
import { R, type Result } from "../../../../../common/src/result";
import { describeError } from "../describe-error";
import { isNotFound } from "../fs-error";

const savedTaskSchema = z.object({
  /** The worktree record's id, or the folder of a worktree without one. */
  worktree: z.string().min(1),
  /** Set for a task the app created, from its first message. */
  title: z.string().optional(),
});

export type SavedTask = z.infer<typeof savedTaskSchema>;

const stored = z.object({
  version: z.literal(1),
  tasks: z.array(savedTaskSchema),
});

/** What the app knows about worktrees that the worktree scripts don't record: which it created, and under what title. */
export class TaskStore {
  private writes: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  async list(): Promise<Result<SavedTask[], Error>> {
    const text = await R.fromPromise(readFile(this.file, "utf8"));
    if (!text.ok)
      return isNotFound(text.error)
        ? R.success([])
        : R.failure(
            new Error(`Can't read ${this.file}: ${text.error.message}`),
          );
    return R.fromThrowable(
      () => stored.parse(JSON.parse(text.value)).tasks,
      (error) =>
        new Error(`${this.file} isn't a task list: ${describeError(error)}`),
    );
  }

  /** Changes the saved task for worktree, starting from one with no title. */
  update(
    worktree: string,
    change: (task: SavedTask) => SavedTask,
  ): Promise<Result<void, Error>> {
    const write = this.writes.then(async (): Promise<Result<void, Error>> => {
      const listed = await this.list();
      if (!listed.ok) return listed;
      const old = listed.value.find((task) => task.worktree === worktree);
      const next = JSON.stringify(
        {
          version: 1,
          tasks: [
            ...listed.value.filter((task) => task !== old),
            change(old ?? { worktree }),
          ],
        },
        null,
        2,
      );
      return R.fromPromise(
        mkdir(path.dirname(this.file), { recursive: true }).then(() =>
          writeFileAtomic(this.file, next),
        ),
      );
    });
    // The caller gets the rejection; the queue drops it so later writes still run.
    this.writes = write.catch(() => undefined);
    return write;
  }
}
