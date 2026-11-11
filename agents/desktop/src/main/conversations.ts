import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import writeFileAtomic from "write-file-atomic";
import { z } from "zod";
import { R, type Result } from "../../../../common/src/result";
import { type Conversation, conversationSchema } from "../shared/conversation";
import { describeError } from "./describe-error";

const stored = z.object({
  version: z.literal(1),
  conversations: z.array(conversationSchema),
});

const titleLength = 80;

export const conversationTitle = (firstMessage: string): string =>
  Array.from(
    new Intl.Segmenter().segment(firstMessage.trim().replace(/\s+/g, " ")),
    ({ segment }) => segment,
  )
    .slice(0, titleLength)
    .join("");

/** The conversations the app has started, newest first, kept in one JSON file so they can be resumed after a relaunch. */
export class ConversationStore {
  private writes: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  async list(): Promise<Result<Conversation[], Error>> {
    const text = await R.fromPromise(readFile(this.file, "utf8"));
    if (!text.ok)
      return "code" in text.error && text.error.code === "ENOENT"
        ? R.success([])
        : R.failure(
            new Error(`Can't read ${this.file}: ${text.error.message}`),
          );
    return R.fromThrowable(
      () => stored.parse(JSON.parse(text.value)).conversations,
      (error) =>
        new Error(
          `${this.file} isn't a conversation list: ${describeError(error)}`,
        ),
    );
  }

  find(id: string): Promise<Result<Conversation | undefined, Error>> {
    return this.list().then((listed) =>
      R.map(listed, (all) => all.find((c) => c.id === id)),
    );
  }

  add(conversation: Conversation): Promise<Result<void, Error>> {
    return this.update((all) => [conversation, ...all]);
  }

  // Writes run one at a time, each on the list the previous one left.
  private update(
    change: (all: Conversation[]) => Conversation[],
  ): Promise<Result<void, Error>> {
    const write = this.writes.then(async (): Promise<Result<void, Error>> => {
      const listed = await this.list();
      if (!listed.ok) return listed;
      const next = JSON.stringify(
        { version: 1, conversations: change(listed.value) },
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
