import type { ImageBlock } from "@alliance/common/forms/display-blocks";
import { imagesUploadImage } from "@alliance/shared/client";
import RenderDisplayBlock from "@alliance/sharedweb/forms/RenderDisplayBlock";
import { useState } from "react";
import { VariableTextField } from "../VariableTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditableImageBlock(props: BaseDisplayBlockProps<ImageBlock>) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    update: (updates: Partial<ImageBlock>) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === "string") {
          try {
            const { data } = await imagesUploadImage({
              body: { file: reader.result },
            });
            if (data) {
              update({ src: data.key });
            }
          } catch (error) {
            console.error("Failed to upload image:", error);
            setUploadError("Failed to upload image");
          }
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Failed to read file:", error);
      setUploadError("Failed to read file");
      setIsUploading(false);
    }
  };

  return (
    <DisplayBlockWrapper {...props}>
      {({ block: activeBlock, onUpdate: handleUpdate }) => (
        <div className="space-y-2">
          {/* File upload */}
          <div className="flex items-center space-x-2">
            <input
              type="file"
              accept="image/*"
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

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={activeBlock.expandable ?? false}
              onChange={(e) => handleUpdate({ expandable: e.target.checked })}
              className="h-4 w-4"
            />
            Expandable on web (click to enlarge)
          </label>

          {/* Preview */}
          <div className="pt-2 border-t border-gray-200">
            <RenderDisplayBlock block={activeBlock} />
          </div>
        </div>
      )}
    </DisplayBlockWrapper>
  );
}
