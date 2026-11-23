import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import writeFileAtomic from "write-file-atomic";
import { z } from "zod";
import { R, type Result } from "../../../../../common/src/result";
import { describeError } from "../describe-error";
import { isNotFound } from "../fs-error";

const savedWorktreeSchema = z.object({
  /** The worktree record's id, or the folder of a worktree without one. */
  key: z.string().min(1),
  /** Set for a worktree the app created, from its first message. */
  title: z.string().optional(),
  archived: z.boolean().optional(),
  /** The worktree's folder, saved on archiving so Resume can refuse it before the worktrees are listed. */
  folder: z.string().optional(),
});

export type SavedWorktree = z.infer<typeof savedWorktreeSchema>;

const stored = z.object({
  version: z.literal(1),
  worktrees: z.array(savedWorktreeSchema),
});

/** What the app knows about worktrees that the worktree scripts don't record: which it created, under what title, and which are archived. */
export class WorktreeStore {
  private writes: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  async list(): Promise<Result<SavedWorktree[], Error>> {
    const text = await R.fromPromise(readFile(this.file, "utf8"));
    if (!text.ok)
      return isNotFound(text.error)
        ? R.success([])
        : R.failure(
            new Error(`Can't read ${this.file}: ${text.error.message}`),
          );
    return R.fromThrowable(
      () => stored.parse(JSON.parse(text.value)).worktrees,
      (error) =>
        new Error(
          `${this.file} isn't a worktree list: ${describeError(error)}`,
        ),
    );
  }

  /** Changes the saved worktree at key, starting from an unarchived one with no title. */
  update(
    key: string,
    change: (saved: SavedWorktree) => SavedWorktree,
  ): Promise<Result<void, Error>> {
    const write = this.writes.then(async (): Promise<Result<void, Error>> => {
      const listed = await this.list();
      if (!listed.ok) return listed;
      const old = listed.value.find((saved) => saved.key === key);
      const next = JSON.stringify(
        {
          version: 1,
          worktrees: [
            ...listed.value.filter((saved) => saved !== old),
            change(old ?? { key }),
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
