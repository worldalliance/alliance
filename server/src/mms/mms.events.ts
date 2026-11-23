import { thrownStack } from "@alliance/common/errorMessage";
import type { ThreadChanged } from "@alliance/common/mmsThreads";
import { Logger } from "@nestjs/common";
import type { EventEmitter2 } from "@nestjs/event-emitter";

export const MmsEvents = {
  ThreadChanged: "mms.thread.changed",
} as const;

const logger = new Logger("MmsEvents");

/** Emit after the change commits, since listeners tell admins to refetch. A
 * listener's error is logged rather than thrown, since the write it reports
 * has already committed. */
export function emitThreadChanged(
  eventEmitter: EventEmitter2,
  payload: ThreadChanged,
): void {
  try {
    eventEmitter.emit(MmsEvents.ThreadChanged, payload);
  } catch (error) {
    logger.error("Thread change broadcast failed", thrownStack(error));
  }
}
