import { errorMessage } from "@alliance/common/errorMessage";
import type { VideoBlock } from "@alliance/common/forms/display-blocks";
import { videosGetVideoStatus } from "@alliance/shared/client";
import RenderDisplayBlock from "@alliance/sharedweb/forms/RenderDisplayBlock";
import { getApiUrl } from "@alliance/sharedweb/lib/config";
import React, { useEffect, useState } from "react";
import { Link, href } from "react-router";
import { VariableTextField } from "../VariableTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditableVideoBlock({
  block,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
}: BaseDisplayBlockProps<VideoBlock>) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);

  // Check status immediately, then poll if still processing
  useEffect(() => {
    if (
      !block.videoId ||
      processingStatus === "ready" ||
      processingStatus === "failed"
    )
      return;

    let cancelled = false;

    const checkStatus = async () => {
      if (!block.videoId) return false;
      try {
        const res = await videosGetVideoStatus({ path: { id: block.videoId } });
        if (!res.response.ok || cancelled) return false;
        const data = res.data;
        if (data && (data.status === "ready" || data.status === "failed")) {
          setProcessingStatus(data.status);
          return true;
        }
      } catch {
        // ignore polling errors
      }
      setProcessingStatus("processing");
      return false;
    };

    void checkStatus().then((done) => {
      if (done || cancelled) return;
      const interval = setInterval(async () => {
        const finished = await checkStatus();
        if (finished || cancelled) clearInterval(interval);
      }, 3000);
      cleanupInterval = interval;
    });

    let cleanupInterval: ReturnType<typeof setInterval> | undefined;
    return () => {
      cancelled = true;
      if (cleanupInterval) clearInterval(cleanupInterval);
    };
  }, [block.videoId, processingStatus]);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    update: (updates: Partial<VideoBlock>) => void,
  ) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const hasPlaylist = files.some((f) => f.name.endsWith(".m3u8"));
    if (!hasPlaylist) {
      setUploadError("At least one .m3u8 playlist file is required");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setProcessingStatus(null);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const res = await fetch(`${getApiUrl()}/videos/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setUploadError(
          errorMessage({
            error: body,
            fallback: `Upload failed with status ${res.status}`,
          }),
        );
        setIsUploading(false);
        return;
      }

      const data = await res.json();
      update({ src: data.key, videoId: data.id });
      setProcessingStatus("ready");
    } catch {
      setUploadError("Upload failed");
    }
    setIsUploading(false);
  };

  return (
    <DisplayBlockWrapper
      onRemove={onRemove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      isDragging={isDragging}
      block={block}
      onUpdate={onUpdate}
      previousFields={previousFields}
    >
      {({ block: activeBlock, onUpdate: handleUpdate }) => (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <label className="block text-sm font-medium text-black">
              Video
            </label>
            {activeBlock.videoId && (
              <Link
                to={href(`/videos/:videoId`, {
                  videoId: activeBlock.videoId.toString(),
                })}
                className="text-xs text-blue-600"
              >
                Manage video file
              </Link>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="file"
              multiple
              accept=".m3u8,.ts,.vtt"
              onChange={(event) => handleFileChange(event, handleUpdate)}
              disabled={isUploading}
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            />
            {isUploading && (
              <span className="text-xs text-blue-600">Uploading...</span>
            )}
          </div>

          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

          {processingStatus === "processing" && (
            <p className="text-xs text-blue-600">Processing video...</p>
          )}
          {processingStatus === "failed" && (
            <p className="text-xs text-red-600">
              Video processing failed. Try again.
            </p>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">
              Caption
            </label>
            <VariableTextField
              value={activeBlock.caption ?? ""}
              onChange={(caption) => handleUpdate({ caption })}
              placeholder="Add an optional caption"
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {activeBlock.src && (
            <div className="pt-2 border-t border-gray-200">
              <RenderDisplayBlock block={activeBlock} />
            </div>
          )}
        </div>
      )}
    </DisplayBlockWrapper>
  );
}
