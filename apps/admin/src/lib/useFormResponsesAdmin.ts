import {
  actionsShareLinksForFormAdmin,
  tasksGetFormResponsesAdmin,
  type FormResponseDto,
  type ProfileDto,
  type ShareUrlDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useTaskForm } from "@alliance/shared/lib/useTaskForm";
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  REFERRALS_LOAD_ERROR,
  type FormWithSchema,
} from "../components/FormResponsesView";
import { adminRefusalMessage } from "./adminRefusal";
import { sortResponsesByCreatedAtAsc } from "./sortResponses";

const NO_RESPONSES: FormResponseDto[] = [];
const NO_SIDS: Record<string, ProfileDto> = {};

const sidsToUser = (links: ShareUrlDto[]) =>
  Object.fromEntries(
    links.flatMap((link) => (link.sid ? [[link.sid, link.user]] : [])),
  );

export function useFormResponsesAdmin(formId: number | undefined) {
  const queryClient = useQueryClient();
  const form = useTaskForm(formId);

  const responses = useQuery({
    queryKey: queryKeys.formResponsesAdmin(formId ?? null),
    queryFn:
      formId === undefined
        ? skipToken
        : () =>
            tasksGetFormResponsesAdmin({
              path: { id: formId },
              throwOnError: true,
            }).then((res) => res.data),
    select: sortResponsesByCreatedAtAsc,
  });

  const shareLinks = useQuery({
    queryKey: queryKeys.formShareLinksAdmin(formId ?? null),
    queryFn:
      formId === undefined
        ? skipToken
        : () =>
            actionsShareLinksForFormAdmin({
              path: { formId },
              throwOnError: true,
            }).then((res) => res.data),
    select: sidsToUser,
  });

  const refresh = useMutation({
    mutationFn: () =>
      Promise.all([
        ...[
          queryKeys.taskForm(formId ?? null),
          queryKeys.formResponsesAdmin(formId ?? null),
        ].map((queryKey) =>
          queryClient.refetchQueries({ queryKey }, { throwOnError: true }),
        ),
        // Share links fail the way their first load does, without failing
        // the refresh of rows that did reload.
        queryClient.refetchQueries({
          queryKey: queryKeys.formShareLinksAdmin(formId ?? null),
        }),
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
    sidsToUserMap: shareLinks.data ?? NO_SIDS,
    // The refresh counts so a click swaps in the spinner; a background refetch
    // on window focus leaves the table up.
    loading: form.isPending || responses.isPending || refresh.isPending,
    error: failure
      ? adminRefusalMessage(failure, "Failed to load form responses")
      : null,
    referralsError: shareLinks.isLoadingError
      ? adminRefusalMessage(shareLinks.error, REFERRALS_LOAD_ERROR)
      : null,
    refresh,
  };
}
