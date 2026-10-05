import {
  type AdminWaitlistTagDto,
  waitlistAdminCreateTagAdmin,
  waitlistAdminDeleteTagAdmin,
  waitlistAdminFindTagsAdmin,
  waitlistAdminRenameTagAdmin,
  waitlistAdminTagEntriesAdmin,
  waitlistAdminUntagEntriesAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useWaitlistTagsAdmin() {
  return useQuery({
    queryKey: queryKeys.waitlistTagsAdmin(),
    queryFn: () =>
      waitlistAdminFindTagsAdmin({ throwOnError: true }).then((r) => r.data),
  });
}

/** A tag write changes both the entries' tags and the tags' counts. */
function useInvalidateTagQueries() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.waitlistEntriesAdminAll(),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.waitlistTagsAdmin(),
      }),
    ]);
}

/**
 * Creates a `tag` that has no id, then calls `onTagReady` before adding or
 * removing it on the entries.
 */
export function useChangeWaitlistEntryTagsAdmin(params: {
  onTagReady: () => void;
  onSuccess: (result: {
    tag: Pick<AdminWaitlistTagDto, "id" | "name">;
    add: boolean;
    changed: number;
  }) => void;
  onError: (err: Error) => void;
  onSettled: () => void;
}) {
  const { onTagReady, onSuccess, onError, onSettled } = params;
  const invalidate = useInvalidateTagQueries();
  return useMutation({
    mutationFn: async (change: {
      tag: Pick<AdminWaitlistTagDto, "id" | "name"> | { name: string };
      add: boolean;
      entryIds: number[];
    }) => {
      const tag =
        "id" in change.tag
          ? change.tag
          : (
              await waitlistAdminCreateTagAdmin({
                body: { name: change.tag.name },
                throwOnError: true,
              })
            ).data;
      onTagReady();
      const send = change.add
        ? waitlistAdminTagEntriesAdmin
        : waitlistAdminUntagEntriesAdmin;
      const { data } = await send({
        path: { id: tag.id },
        body: { entryIds: change.entryIds },
        throwOnError: true,
      });
      return { tag, add: change.add, changed: data.changed };
    },
    onSuccess: (result) => onSuccess(result),
    onError,
    onSettled: async () => {
      onSettled();
      await invalidate();
    },
  });
}

export function useRenameWaitlistTagAdmin(params: {
  onError: (err: Error) => void;
}) {
  const invalidate = useInvalidateTagQueries();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      waitlistAdminRenameTagAdmin({
        path: { id },
        body: { name },
        throwOnError: true,
      }),
    onError: params.onError,
    onSettled: invalidate,
  });
}

export function useDeleteWaitlistTagAdmin(params: {
  onError: (err: Error) => void;
  onSettled: () => void;
}) {
  const { onError, onSettled } = params;
  const invalidate = useInvalidateTagQueries();
  return useMutation({
    mutationFn: (id: number) =>
      waitlistAdminDeleteTagAdmin({ path: { id }, throwOnError: true }),
    onError,
    onSettled: async () => {
      onSettled();
      await invalidate();
    },
  });
}
