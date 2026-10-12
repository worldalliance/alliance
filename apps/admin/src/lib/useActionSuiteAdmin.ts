import {
  actionsAddSuiteEventAdmin,
  actionsBatchUpdateSuiteEventsAdmin,
  actionsDeleteSuiteEventAdmin,
  actionsSuiteAdmin,
  type CreateActionEventDto,
  type UpdateActionEventDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { adminRefusalMessage } from "./adminRefusal";
import { sendConfirmingDeadlineShortening } from "./confirmDeadlineShortening";
import { usePatchQueryData } from "./usePatchQueryData";

export const suiteLoadError = (error: unknown) =>
  adminRefusalMessage(error, "Failed to load suite.");

const suiteQuery = (suiteId: number) =>
  queryOptions({
    queryKey: queryKeys.actionSuiteAdmin(suiteId),
    queryFn: () =>
      actionsSuiteAdmin({ path: { id: suiteId }, throwOnError: true }).then(
        (r) => r.data,
      ),
  });

/** Resolves `null` when staff decline, and rejects with the refusal. */
const dataOrThrow = <T>(sent: { data?: T; error?: unknown } | null) => {
  if (!sent) return null;
  if (sent.data === undefined) throw sent.error;
  return sent.data;
};

export function useActionSuiteAdmin(suiteId: number) {
  const { confirm } = useToast();
  const query = useMemo(() => suiteQuery(suiteId), [suiteId]);
  const suite = useQuery(query);
  const patchSuite = usePatchQueryData(query.queryKey);

  const addEvent = useMutation({
    mutationFn: (body: CreateActionEventDto) =>
      sendConfirmingDeadlineShortening({
        send: (q) =>
          actionsAddSuiteEventAdmin({ path: { suiteId }, body, query: q }),
        confirm,
      }).then(dataOrThrow),
    onSuccess: (updated) => updated && patchSuite(() => updated),
  });

  const updateEvent = useMutation({
    mutationFn: ({
      eventId,
      body,
    }: {
      eventId: number;
      body: UpdateActionEventDto;
    }) =>
      sendConfirmingDeadlineShortening({
        send: (q) =>
          actionsBatchUpdateSuiteEventsAdmin({
            path: { suiteId, eventId },
            body,
            query: q,
          }),
        confirm,
      }).then(dataOrThrow),
    onSuccess: (updated) => updated && patchSuite(() => updated),
  });

  const deleteEvent = useMutation({
    mutationFn: (eventId: number) =>
      actionsDeleteSuiteEventAdmin({
        path: { suiteId, eventId },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: (updated) => patchSuite(() => updated),
  });

  return { suite, addEvent, updateEvent, deleteEvent };
}
