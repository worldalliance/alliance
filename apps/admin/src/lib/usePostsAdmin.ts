import {
  forumGetPostsForAdmin,
  forumUpdatePostSettingsAdmin,
  type UpdatePostSettingsDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { usePatchQueryData } from "./usePatchQueryData";

const postsQuery = queryOptions({
  queryKey: queryKeys.postsAdmin(),
  queryFn: () =>
    forumGetPostsForAdmin({ throwOnError: true }).then((r) => r.data),
});

export function usePostsAdmin() {
  const posts = useQuery(postsQuery);
  const patchPosts = usePatchQueryData(postsQuery.queryKey);

  const updateSettings = useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdatePostSettingsDto }) =>
      forumUpdatePostSettingsAdmin({
        path: { id },
        body,
        throwOnError: true,
      }).then((r) => r.data),
    onSuccess: (updated) =>
      patchPosts((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p)),
      ),
  });

  return { posts, updateSettings };
}
