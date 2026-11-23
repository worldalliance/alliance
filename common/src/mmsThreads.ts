import { milliseconds } from "date-fns";
import { z } from "zod";

/** Events on the admin `/mms-threads` socket. */
export enum MmsThreadsEvent {
  ThreadChanged = "thread-changed",
  /** To admins, everyone composing; from an admin, a draft to `phoneNumber`,
   * which must be the thread's `phoneNumber` as its query returns it. */
  Composing = "composing",
  StoppedComposing = "stopped-composing",
}

/** `needsReplyChanged` is false for changes that can't move a number on or off
 * Needs reply, such as each text of a broadcast, so they don't refetch it. */
export const threadChangedSchema = z.object({
  phoneNumber: z.string(),
  needsReplyChanged: z.boolean(),
});

export type ThreadChanged = z.infer<typeof threadChangedSchema>;

/** How long a report that an admin is composing a text lasts without a
 * refresh, so an abandoned draft stops showing. */
export const COMPOSING_TTL_MS = milliseconds({ seconds: 10 });

export const composingMessageSchema = z.object({
  phoneNumber: z.string().min(1),
});

export type ComposingMessage = z.infer<typeof composingMessageSchema>;

export const composersSchema = z.array(
  z.object({
    phoneNumber: z.string(),
    adminId: z.number(),
    adminName: z.string(),
  }),
);

export type Composer = z.infer<typeof composersSchema>[number];
