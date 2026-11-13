import {
  mmsThreadGetThreadAdmin,
  mmsThreadMarkOptedOutAdmin,
  mmsThreadSendTextAdmin,
} from "@alliance/shared/client";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  queryOptions,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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

const OPT_OUT_KEY = ["markOptedOutAdmin"];

/** Mutations take the member's id, so one that settles after the page moves
 * to another member still acts on, and updates the cache of, the member it
 * was made for. */
export function useMemberTextsAdmin(userId: number) {
  const queryClient = useQueryClient();
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

  const markOptedOut = useMutation({
    mutationKey: OPT_OUT_KEY,
    mutationFn: (memberId: number) =>
      mmsThreadMarkOptedOutAdmin({
        path: { userId: memberId },
        throwOnError: true,
      }).catch((thrown: unknown) => {
        // This endpoint's only 409 is for a member who has already opted out.
        if (thrownStatus(thrown) !== 409) throw thrown;
      }),
    onSuccess: (_, memberId) =>
      patch(threadQuery(memberId).queryKey, (prev) => ({
        ...prev,
        optedOut: true,
      })),
    onError: (_, memberId) =>
      queryClient.invalidateQueries({
        queryKey: threadQuery(memberId).queryKey,
      }),
  });

  // Read from the mutation cache, which outlives this page's observer, so a
  // return visit mid-request still shows the opt-out pending.
  const pendingOptOuts = useMutationState({
    filters: { mutationKey: OPT_OUT_KEY, status: "pending" },
    select: (mutation) => mutation.state.variables,
  });

  return {
    thread,
    send,
    markOptedOut,
    markingOptedOut: pendingOptOuts.includes(userId),
  };
}
