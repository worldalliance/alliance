import {
  AddUserToTagDto,
  CreateTagDto,
  userTagAddUserToTagAdmin,
  userTagCreateTagAdmin,
  userTagDeleteTagAdmin,
  userTagGetTagsAdmin,
  userTagGetTagSummariesAdmin,
  userTagRemoveUserFromTagAdmin,
  userTagUpdateTagAdmin,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { loaderPrefetchStaleTime } from "./queryClient";

const QUERY_KEY = queryKeys.tagsAdmin();

/** Every tag without its members, for a route loader to start before the
 * page mounts. */
export const tagSummariesQuery = () =>
  queryOptions({
    queryKey: queryKeys.tagSummariesAdmin(),
    queryFn: () =>
      userTagGetTagSummariesAdmin({ throwOnError: true }).then((r) => r.data),
    staleTime: loaderPrefetchStaleTime,
  });

/**
 * Single source of truth for tags — wraps `userTagGetTagsAdmin`,
 * `userTagGetTagSummariesAdmin` and the create/update/delete/membership
 * endpoints in react-query. Every mutation invalidates the tag list; those
 * that change a tag itself invalidate the summaries too.
 */
export function useTagsAdmin(params?: {
  enabled?: boolean;
  summariesEnabled?: boolean;
}) {
  const { enabled = true, summariesEnabled = false } = params ?? {};
  const queryClient = useQueryClient();

  const {
    data: tags = [],
    // a disabled query is permanently pending
    isLoading,
    isError,
    isLoadingError,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      userTagGetTagsAdmin({ throwOnError: true }).then(
        (response) => response.data,
      ),
    enabled,
  });

  const summaries = useQuery({
    ...tagSummariesQuery(),
    enabled: summariesEnabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  const invalidateWithSummaries = () =>
    Promise.all([
      invalidate(),
      queryClient.invalidateQueries({
        queryKey: queryKeys.tagSummariesAdmin(),
      }),
    ]);

  const createTag = useMutation({
    mutationFn: (body: CreateTagDto) =>
      userTagCreateTagAdmin({ body, throwOnError: true }).then((r) => r.data),
    onSuccess: invalidateWithSummaries,
  });

  const updateTag = useMutation({
    mutationFn: ({ tagId, body }: { tagId: string; body: CreateTagDto }) =>
      userTagUpdateTagAdmin({ path: { tagId }, body, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: invalidateWithSummaries,
  });

  const deleteTag = useMutation({
    mutationFn: (tagId: string) =>
      userTagDeleteTagAdmin({ path: { tagId }, throwOnError: true }).then(
        (r) => r.data,
      ),
    onSuccess: invalidateWithSummaries,
  });

  const addUserToTag = useMutation({
    mutationFn: ({ tagId, body }: { tagId: string; body: AddUserToTagDto }) =>
      userTagAddUserToTagAdmin({
        path: { tagId },
        body,
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: invalidate,
  });

  const removeUserFromTag = useMutation({
    mutationFn: ({ tagId, body }: { tagId: string; body: AddUserToTagDto }) =>
      userTagRemoveUserFromTagAdmin({
        path: { tagId },
        body,
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: invalidate,
  });

  return {
    tags,
    isLoading,
    isError,
    isLoadingError,
    refetch,
    summaries,
    createTag,
    updateTag,
    deleteTag,
    addUserToTag,
    removeUserFromTag,
  };
}
