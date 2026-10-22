import {
  videosDeleteVideoAdmin,
  videosGetVideoDetailsAdmin,
  videosListVideosAdmin,
  videosReplaceVideoAdmin,
} from "@alliance/shared/client";
import type { VideoListItemDto } from "@alliance/shared/client/types.gen";
import { rethrowUnlessNotFound } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const LIST_KEY = queryKeys.videosAdmin();

export function useVideosAdmin() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () =>
      videosListVideosAdmin({ throwOnError: true }).then((r) => r.data.videos),
  });
}

export function useDeleteVideoAdmin(params: {
  onError: (error: Error) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      videosDeleteVideoAdmin({ path: { id }, throwOnError: true }).catch(
        rethrowUnlessNotFound,
      ),
    onSuccess: async (_data, id) => {
      // A refetch started before the delete would land the deleted video
      // back in the list.
      await queryClient.cancelQueries({ queryKey: LIST_KEY });
      queryClient.setQueryData<VideoListItemDto[]>(LIST_KEY, (prev) =>
        prev?.filter((v) => v.id !== id),
      );
    },
    onError: params.onError,
  });
}

export function useVideoAdmin(id: number) {
  return useQuery({
    queryKey: queryKeys.videoAdmin(id),
    queryFn: () =>
      videosGetVideoDetailsAdmin({ path: { id }, throwOnError: true }).then(
        (r) => r.data,
      ),
  });
}

export function useReplaceVideoAdmin(params: {
  videoId: number;
  onSuccess: () => void;
  onError: (error: Error) => void;
}) {
  const { videoId, onSuccess, onError } = params;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) =>
      videosReplaceVideoAdmin({
        path: { id: videoId },
        body: { files },
        throwOnError: true,
      }),
    onSuccess: () => {
      onSuccess();
      return queryClient.invalidateQueries({
        queryKey: queryKeys.videoAdmin(videoId),
      });
    },
    onError,
  });
}
