import {
  actionSuitesAddSuiteEventAdmin,
  actionSuitesBatchUpdateSuiteEventsAdmin,
  actionSuitesDeleteSuiteEventAdmin,
  actionSuitesSuiteAdmin,
  type CreateActionEventDto,
  type UpdateActionEventDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useToast } from "../ui/ToastProvider";
import { adminRefusalMessage } from "./adminRefusal";
import {
  dataOrThrow,
  sendConfirmingDeadlineShortening,
} from "./confirmDeadlineShortening";
import { usePatchQueryData } from "./usePatchQueryData";

export const suiteLoadError = (error: unknown) =>
  adminRefusalMessage(error, "Failed to load suite.");

const suiteQuery = (suiteId: number) =>
  queryOptions({
    queryKey: queryKeys.actionSuiteAdmin(suiteId),
    queryFn: () =>
      actionSuitesSuiteAdmin({
        path: { id: suiteId },
        throwOnError: true,
      }).then((r) => r.data),
  });

export function useActionSuiteAdmin(suiteId: number) {
  const { confirm } = useToast();
  const query = useMemo(() => suiteQuery(suiteId), [suiteId]);
  const suite = useQuery({ ...query, enabled: Number.isSafeInteger(suiteId) });
  const patchSuite = usePatchQueryData(query.queryKey);

  const addEvent = useMutation({
    mutationFn: (body: CreateActionEventDto) =>
      sendConfirmingDeadlineShortening({
        send: (q) =>
          actionSuitesAddSuiteEventAdmin({ path: { suiteId }, body, query: q }),
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
          actionSuitesBatchUpdateSuiteEventsAdmin({
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
      actionSuitesDeleteSuiteEventAdmin({
        path: { suiteId, eventId },
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: (updated) => patchSuite(() => updated),
  });

  return { suite, addEvent, updateEvent, deleteEvent };
}
