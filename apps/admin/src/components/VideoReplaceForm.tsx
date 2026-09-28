import { withCount } from "@alliance/common/plural";
import { videosReplaceVideoAdmin } from "@alliance/shared/client";
import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useRef, useState } from "react";
import { uploadSessionExpiredMessage } from "../lib/sessionExpired";

interface VideoReplaceFormProps {
  videoId: number;
}

const VideoReplaceForm: React.FC<VideoReplaceFormProps> = ({ videoId }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { success, error: pushError } = useToast();

  const { mutate: replace, isPending: uploading } = useMutation({
    mutationFn: (files: File[]) =>
      videosReplaceVideoAdmin({
        path: { id: videoId },
        body: { files },
        throwOnError: true,
      }),
    onSuccess: () => {
      success("Video content replaced successfully");
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return queryClient.invalidateQueries({
        queryKey: queryKeys.videoAdmin(videoId),
      });
    },
    onError: (err) => {
      console.error("Failed to replace video", err);
      pushError(
        thrownRefusalMessage({
          error: err,
          fallback: "Failed to replace video content",
          sessionExpired: uploadSessionExpiredMessage,
        }),
      );
    },
  });

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      setSelectedFiles(files);
    },
    [],
  );

  const handleUpload = useCallback(() => {
    if (selectedFiles.length === 0) return;

    const hasPlaylist = selectedFiles.some((f) => f.name.endsWith(".m3u8"));
    if (!hasPlaylist) {
      pushError("At least one .m3u8 playlist file is required");
      return;
    }

    replace(selectedFiles);
  }, [selectedFiles, replace, pushError]);

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".m3u8,.ts"
        onChange={handleFileChange}
        className="text-sm p-2 border border-zinc-200 rounded-md cursor-pointer"
      />
      {selectedFiles.length > 0 && (
        <p className="text-xs text-zinc-500">
          {withCount(selectedFiles.length, "file")} selected
        </p>
      )}
      <Button
        color={ButtonColor.Blue}
        onClick={handleUpload}
        disabled={uploading || selectedFiles.length === 0}
        className="self-start"
      >
        {uploading ? "Uploading..." : "Replace Video Content"}
      </Button>
    </div>
  );
};

export default VideoReplaceForm;
