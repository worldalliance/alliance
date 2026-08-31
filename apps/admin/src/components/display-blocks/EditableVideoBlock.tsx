import { errorMessage } from "@alliance/common/errorMessage";
import type { VideoBlock } from "@alliance/common/forms/display-blocks";
import RenderDisplayBlock from "@alliance/sharedweb/forms/RenderDisplayBlock";
import { getApiUrl } from "../../lib/config";
import React, { useState } from "react";
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
