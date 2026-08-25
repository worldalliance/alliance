import {
  videosDeleteVideoAdmin,
  videosListVideosAdmin,
} from "@alliance/shared/client";
import type { VideoListItemDto } from "@alliance/shared/client/types.gen";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "-";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const VideoManagement: React.FC = () => {
  const [videos, setVideos] = useState<VideoListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { error: pushError } = useToast();

  const loadVideos = useCallback(async () => {
    try {
      const response = await videosListVideosAdmin();
      setVideos(response.data?.videos ?? []);
    } catch (err) {
      console.error("Failed to load videos", err);
      setError("Failed to load videos");
      pushError("Failed to load videos");
    } finally {
      setLoading(false);
    }
  }, [pushError]);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  const { confirm } = useToast();

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
      await videosDeleteVideoAdmin({ path: { id } });
      setVideos((prev) => prev.filter((v) => v.id !== id));
    },
    [confirm],
  );

  if (loading) {
    return (
      <div className="p-6 pt-20">
        <p className="text-sm text-zinc-500">Loading videos...</p>
      </div>
    );
  }

  if (error) {
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
                  <th className="py-3 px-2">Duration</th>
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
                    <td className="py-3 px-2">
                      {formatDuration(video.duration)}
                    </td>
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
