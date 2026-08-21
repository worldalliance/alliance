import { errorMessage } from "@alliance/common/errorMessage";
import { getApiUrl } from "@alliance/sharedweb/lib/config";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import React, { useCallback, useRef, useState } from "react";

interface VideoReplaceFormProps {
  videoId: number;
  onComplete: () => void;
}

const VideoReplaceForm: React.FC<VideoReplaceFormProps> = ({
  videoId,
  onComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const { success, error: pushError } = useToast();

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      setSelectedFiles(files);
    },
    [],
  );

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    const hasPlaylist = selectedFiles.some((f) => f.name.endsWith(".m3u8"));
    if (!hasPlaylist) {
      pushError("At least one .m3u8 playlist file is required");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      const res = await fetch(`${getApiUrl()}/videos/${videoId}/replace`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          errorMessage({
            error: body,
            fallback: `Upload failed: ${res.status}`,
          }),
        );
      }

      success("Video content replaced successfully");
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onComplete();
    } catch (err) {
      console.error("Failed to replace video", err);
      pushError(
        errorMessage({
          error: err,
          fallback: "Failed to replace video content",
        }),
      );
    } finally {
      setUploading(false);
    }
  }, [selectedFiles, videoId, onComplete, success, pushError]);

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
          {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""}{" "}
          selected
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
