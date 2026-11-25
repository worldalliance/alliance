import { useMemo } from "react";
import { useGroupAssignmentMembersAdmin } from "../lib/useGroupAssignmentAdmin";
import { useOutreachPartnershipResponsesAdmin } from "../lib/useOutreachPartnershipResponsesAdmin";
import { useNeedsReplyCount } from "../lib/useTextThreadsAdmin";
import { useWelcomeQueueAdmin } from "../lib/useWelcomeQueueAdmin";
import { CountId } from "../places";

/** A queue's size: null when it couldn't load, undefined while it loads. */
export type QueueCount = number | null | undefined;

const loaded = <T>(
  query: { data: T | undefined; isError: boolean },
  count: (data: T) => number,
): QueueCount =>
  query.data !== undefined
    ? count(query.data)
    : query.isError
      ? null
      : undefined;

export function useQueueCounts(): Record<CountId, QueueCount> {
  const needsReply = useNeedsReplyCount();
  const welcome = loaded(
    useWelcomeQueueAdmin(),
    (queue) => queue.members.length,
  );
  const awaitingGroup = loaded(
    useGroupAssignmentMembersAdmin(),
    (members) => members.length,
  );
  const partnershipResponses = loaded(
    useOutreachPartnershipResponsesAdmin(),
    (responses) =>
      responses.filter((response) => response.notesHistory.length === 0).length,
  );
  return useMemo(
    () => ({
      [CountId.NeedsReply]: needsReply,
      [CountId.WelcomeQueue]: welcome,
      [CountId.AwaitingGroup]: awaitingGroup,
      [CountId.PartnershipResponses]: partnershipResponses,
    }),
    [needsReply, welcome, awaitingGroup, partnershipResponses],
  );
}
