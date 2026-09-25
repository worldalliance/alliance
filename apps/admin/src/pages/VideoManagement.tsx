import {
  videosDeleteVideoAdmin,
  videosListVideosAdmin,
} from "@alliance/shared/client";
import type { VideoListItemDto } from "@alliance/shared/client/types.gen";
import {
  thrownRefusalMessage,
  thrownStatus,
} from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback } from "react";
import { useNavigate } from "react-router";
import { sessionExpiredMessage } from "../lib/sessionExpired";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const VideoManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { confirm, error: pushError } = useToast();
  const list = useQuery({
    queryKey: queryKeys.videosAdmin(),
    queryFn: () =>
      videosListVideosAdmin({ throwOnError: true }).then((r) => r.data.videos),
  });
  const videos = list.data ?? [];
  const error = list.isError
    ? thrownRefusalMessage({
        error: list.error,
        fallback: "Failed to load videos",
        sessionExpired: sessionExpiredMessage,
      })
    : null;

  const { mutate: deleteVideo } = useMutation({
    mutationFn: (id: number) =>
      videosDeleteVideoAdmin({ path: { id }, throwOnError: true }).catch(
        (err: unknown) => {
          // Already deleted elsewhere: the row goes, same as a delete that worked.
          if (thrownStatus(err) !== 404) throw err;
        },
      ),
    onSuccess: async (_data, id) => {
      // A refetch started before the delete would land the deleted video
      // back in the list.
      await queryClient.cancelQueries({ queryKey: queryKeys.videosAdmin() });
      queryClient.setQueryData<VideoListItemDto[]>(
        queryKeys.videosAdmin(),
        (prev) => prev?.filter((v) => v.id !== id),
      );
    },
    onError: (err) => {
      console.error("Failed to delete video", err);
      pushError(
        thrownRefusalMessage({
          error: err,
          fallback: "Failed to delete video",
          sessionExpired: sessionExpiredMessage,
        }),
      );
    },
  });

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      if (
        !(await confirm({
          title: "Confirm Delete",
          message: `Are you sure you want to delete video ${id}?`,
          confirmLabel: "Delete",
        }))
      )
        return;
      deleteVideo(id);
    },
    [confirm, deleteVideo],
  );

  if (list.isPending) {
    return (
      <div className="p-6 pt-20">
        <p className="text-sm text-zinc-500">Loading videos...</p>
      </div>
    );
  }

  if (error && !list.data) {
    return (
      <div className="p-6 pt-20">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="p-6 pt-10 flex flex-col gap-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-semibold">Videos</h1>
          <p className="text-sm text-zinc-500">
            Manage uploaded videos and inspect processing details
          </p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {videos.length === 0 ? (
          <p className="text-sm text-zinc-500">No videos found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-500 uppercase border-b">
                <tr>
                  <th className="py-3 px-2">Filename</th>
                  <th className="py-3 px-2">ID</th>
                  <th className="py-3 px-2">Size</th>
                  <th className="py-3 px-2">Created</th>
                  <th className="py-3 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {videos.map((video) => (
                  <tr
                    key={video.id}
                    onClick={() => navigate(`/videos/${video.id}`)}
                    className="border-b hover:bg-zinc-50 cursor-pointer"
                  >
                    <td className="py-3 px-2 font-medium">
                      {video.originalFilename}
                    </td>
                    <td className="py-3 px-2 text-zinc-500">{video.id}</td>
                    <td className="py-3 px-2">{formatSize(video.size)}</td>
                    <td className="py-3 px-2 text-zinc-500">
                      {new Date(video.dateCreated).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2">
                      <button
                        onClick={(e) => handleDelete(e, video.id)}
                        className="text-zinc-400 hover:text-red-500"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoManagement;
