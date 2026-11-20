import { z } from "zod";

/** Events on the admin `/mms-threads` socket. */
export enum MmsThreadsEvent {
  ThreadChanged = "thread-changed",
}

/** `needsReplyChanged` is false for changes that can't move a number on or off
 * Needs reply, such as each text of a broadcast, so they don't refetch it. */
export const threadChangedSchema = z.object({
  phoneNumber: z.string(),
  needsReplyChanged: z.boolean(),
});

export type ThreadChanged = z.infer<typeof threadChangedSchema>;
