import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import writeFileAtomic from "write-file-atomic";
import { z } from "zod";
import { R, type Result } from "../../../../../common/src/result";
import { describeError } from "../describe-error";
import { isNotFound } from "../fs-error";

export enum SavedKind {
  /** A copy the user chose or the app cloned. */
  Copy = "copy",
  /** A folder the user chose to clone into or whose clone they cancelled, which stops the automatic clone. */
  CloneFolder = "clone-folder",
}

const stored = z.object({
  version: z.literal(1),
  kind: z.enum(SavedKind),
  folder: z.string().refine(path.isAbsolute, "not an absolute path"),
});

export type SavedChoice = { kind: SavedKind; folder: string };

/** The user's choice of repository, kept in the app's own data folder. */
export class SavedRepository {
  constructor(private readonly file: string) {}

  async read(): Promise<Result<SavedChoice | undefined, Error>> {
    const text = await R.fromPromise(readFile(this.file, "utf8"));
    if (!text.ok)
      return isNotFound(text.error)
        ? R.success(undefined)
        : R.failure(
            new Error(`Can't read ${this.file}: ${text.error.message}`),
          );
    return R.fromThrowable(
      () => {
        const { kind, folder } = stored.parse(JSON.parse(text.value));
        return { kind, folder };
      },
      (error) =>
        new Error(
          `${this.file} isn't a saved repository: ${describeError(error)}`,
        ),
    );
  }

  write(choice: SavedChoice): Promise<Result<void, Error>> {
    return R.fromPromise(
      mkdir(path.dirname(this.file), { recursive: true }).then(() =>
        writeFileAtomic(
          this.file,
          JSON.stringify({ version: 1, ...choice }, null, 2),
        ),
      ),
    );
  }
}
