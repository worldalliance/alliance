import {
  tasksGetFormResponsesAdmin,
  type FormResponseDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useAdminTaskForm } from "@alliance/shared/lib/useTaskForm";
import {
  queryOptions,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { type FormWithSchema } from "../components/FormResponsesView";
import { adminRefusalMessage } from "./adminRefusal";
import { sortResponsesByCreatedAtAsc } from "./sortResponses";
import { useFormShareLinksAdmin } from "./useFormShareLinksAdmin";

const NO_RESPONSES: FormResponseDto[] = [];

export const formResponsesAdminQuery = (formId: number | null | undefined) =>
  queryOptions({
    queryKey: queryKeys.formResponsesAdmin(formId ?? null),
    queryFn:
      formId == null
        ? skipToken
        : () =>
            tasksGetFormResponsesAdmin({
              path: { id: formId },
              throwOnError: true,
            }).then((res) => res.data),
    select: sortResponsesByCreatedAtAsc,
  });

export function useFormResponsesAdmin(formId: number | undefined) {
  const queryClient = useQueryClient();
  const form = useAdminTaskForm(formId);

  const responses = useQuery(formResponsesAdminQuery(formId));

  const shareLinks = useFormShareLinksAdmin(formId);

  const refresh = useMutation({
    mutationFn: () =>
      Promise.all([
        ...[
          queryKeys.taskFormAdmin(formId ?? null),
          queryKeys.formResponsesAdmin(formId ?? null),
        ].map((queryKey) =>
          queryClient.refetchQueries({ queryKey }, { throwOnError: true }),
        ),
        // Share links fail the way their first load does, without failing
        // the refresh of rows that did reload.
        shareLinks.refetch(),
      ]),
  });

  // A failed refetch keeps the rows it already has on screen; only a load
  // with nothing to show replaces the table.
  const failure =
    (form.isLoadingError ? form.error : null) ??
    (responses.isLoadingError ? responses.error : null);

  return {
    // Unparsed: the server validates a form's schema before storing it.
    form: (form.data ?? null) as unknown as FormWithSchema | null,
    responses: responses.data ?? NO_RESPONSES,
    sidsToUserMap: shareLinks.sidsToUserMap,
    // The refresh counts so a click swaps in the spinner; a background refetch
    // on window focus leaves the table up.
    loading: form.isPending || responses.isPending || refresh.isPending,
    error: failure
      ? adminRefusalMessage(failure, "Failed to load form responses")
      : null,
    referralsError: shareLinks.referralsError,
    refresh,
  };
}
