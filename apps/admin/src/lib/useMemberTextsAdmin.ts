import {
  mmsThreadGetThreadAdmin,
  mmsThreadSendTextAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import { usePatchAnyQueryData } from "./usePatchQueryData";

const threadQuery = (userId: number) =>
  queryOptions({
    queryKey: queryKeys.memberTextThreadAdmin(userId),
    queryFn: () =>
      mmsThreadGetThreadAdmin({ path: { userId }, throwOnError: true }).then(
        (r) => r.data,
      ),
    refetchInterval: milliseconds({ seconds: 10 }),
  });

/** A send takes the member's id, so one that settles after the page moves to
 * another member still sends to and patches the member it was made for. */
export function useMemberTextsAdmin(userId: number) {
  const thread = useQuery(threadQuery(userId));
  const patch = usePatchAnyQueryData();

  const send = useMutation({
    mutationFn: (input: { userId: number; body: string }) =>
      mmsThreadSendTextAdmin({
        path: { userId: input.userId },
        body: { body: input.body },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: (message, input) =>
      patch(threadQuery(input.userId).queryKey, (prev) =>
        prev.messages.some((m) => m.id === message.id)
          ? prev
          : { ...prev, messages: [...prev.messages, message] },
      ),
  });

  return { thread, send };
}
