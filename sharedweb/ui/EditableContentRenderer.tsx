import { EditableContentDto } from "@alliance/shared/client";
import AppMarkdownWrapper from "./AppMarkdownWrapper";
import ImageLightbox from "./ImageLightbox";
import React from "react";

interface EditableContentRendererProps {
  content: EditableContentDto;
  collapsed?: boolean;
  deleted?: boolean;
  className?: string;
  truncated?: boolean;
  smallImages?: boolean;
}

const EditableContentRenderer: React.FC<EditableContentRendererProps> = ({
  content,
  collapsed = false,
  deleted = false,
  className,
  truncated = false,
  smallImages = false,
}) => {
  const attachments = (content.attachments ?? []).filter((src): src is string =>
    Boolean(src)
  );
  const sharedClasses = "mb-1 whitespace-pre-wrap";

  if (deleted) {
    return (
      <div className={`${className ?? ""} ${sharedClasses} text-gray-400`}>
        Content has been deleted
      </div>
    );
  }

  return (
    <div className={className}>
      {content && (
        <div
          className={`${
            collapsed ? "line-clamp-1" : truncated ? "line-clamp-3" : ""
          }`}
        >
          <AppMarkdownWrapper
            markdownContent={content.body}
            smallImages={smallImages}
          />
        </div>
      )}
      {attachments.length > 0 && !collapsed && (
        <ImageLightbox
          images={attachments}
          renderPreview={(openLightbox) => (
            <div
              className={`flex flex-wrap gap-2 ${content.body ? "mt-2" : ""}`}
            >
              {attachments.map((key, idx) => (
                <button
                  type="button"
                  key={idx}
                  className="focus:outline-none"
                  onClick={(e) => openLightbox(idx, e)}
                >
                  <img src={key} className="w-28 h-28 object-cover rounded" />
                </button>
              ))}
            </div>
          )}
        />
      )}
    </div>
  );
};

export default EditableContentRenderer;
