import type { MmsMessageDto } from "@alliance/shared/client/types.gen";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  type DataTag,
  type QueryKey,
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query";
import { usePatchAnyQueryData } from "./usePatchQueryData";

type ThreadMark<Id> = { id: Id; throughId: number };

/** Mutations take the thread's id, so one that settles after the page moves
 * to another thread still acts on, and updates the cache of, the thread it
 * was made for. */
export function useThreadActions<
  Id,
  T extends { messages: MmsMessageDto[]; optedOut: boolean },
>(params: {
  id: Id;
  queryKey: (id: Id) => DataTag<QueryKey, T, Error>;
  sendText: (input: { id: Id; body: string }) => Promise<MmsMessageDto>;
  /** Must answer 409 only for a number that has already opted out, which
   * the hook treats as success. */
  markOptedOut: (id: Id) => Promise<unknown>;
  optOutKey: QueryKey;
  markHandled: (input: ThreadMark<Id>) => Promise<unknown>;
  markNeedsReply: (input: ThreadMark<Id>) => Promise<unknown>;
}) {
  const { id, queryKey, optOutKey } = params;
  const queryClient = useQueryClient();
  const patch = usePatchAnyQueryData();
  const refreshViews = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.needsReplyAdmin() });

  const send = useMutation({
    mutationFn: params.sendText,
    onSuccess: async (message, input) => {
      await patch(queryKey(input.id), (prev) =>
        prev.messages.some((m) => m.id === message.id)
          ? prev
          : { ...prev, messages: [...prev.messages, message] },
      );
      // An undelivered text doesn't answer the contact, so only the server
      // knows the reply state now.
      void queryClient.invalidateQueries({ queryKey: queryKey(input.id) });
      void refreshViews();
    },
  });

  const markOptedOut = useMutation({
    mutationKey: optOutKey,
    mutationFn: (target: Id) =>
      params.markOptedOut(target).catch((thrown: unknown) => {
        if (thrownStatus(thrown) !== 409) throw thrown;
      }),
    onSuccess: async (_, target) => {
      await patch(queryKey(target), (prev) => ({ ...prev, optedOut: true }));
      void refreshViews();
    },
    onError: (_, target) =>
      queryClient.invalidateQueries({ queryKey: queryKey(target) }),
  });

  // Read from the mutation cache, which outlives this page's observer, so a
  // return visit mid-request still shows the opt-out pending.
  const pendingOptOuts = useMutationState({
    filters: { mutationKey: optOutKey, status: "pending" },
    select: (mutation) => mutation.state.variables,
  });

  const afterReplyStateChange = (target: Id) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKey(target) }),
      refreshViews(),
    ]);

  const markHandled = useMutation({
    mutationFn: params.markHandled,
    onSettled: (_, __, input) => afterReplyStateChange(input.id),
  });

  const markNeedsReply = useMutation({
    mutationFn: params.markNeedsReply,
    onSettled: (_, __, input) => afterReplyStateChange(input.id),
  });

  return {
    send: (body: string) => send.mutateAsync({ id, body }),
    sentId: send.data?.id,
    markOptedOut: () => markOptedOut.mutateAsync(id),
    markingOptedOut: pendingOptOuts.includes(id),
    markHandled: (throughId: number) =>
      markHandled.mutateAsync({ id, throughId }),
    markNeedsReply: (throughId: number) =>
      markNeedsReply.mutateAsync({ id, throughId }),
    markingHandled: markHandled.isPending && markHandled.variables.id === id,
    markingNeedsReply:
      markNeedsReply.isPending && markNeedsReply.variables.id === id,
  };
}
