import { EditableContentDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import React, { memo } from "react";
import AppMarkdownWrapper from "./AppMarkdownWrapper";
import { ImageThumbnailGrid } from "./ImageLightbox";

interface EditableContentRendererProps {
  content: EditableContentDto;
  collapsed?: boolean;
  deleted?: boolean;
  className?: string;
  truncated?: boolean;
}

const EditableContentRenderer: React.FC<EditableContentRendererProps> = ({
  content,
  collapsed = false,
  deleted = false,
  className,
  truncated = false,
}) => {
  const attachments = (content.attachments ?? []).filter((src): src is string =>
    Boolean(src),
  );
  const sharedClasses = "mb-1 whitespace-pre-wrap";

  if (deleted) {
    return (
      <div className={cn(className, sharedClasses, "text-gray-400")}>
        Content has been deleted
      </div>
    );
  }

  return (
    <div className={className}>
      {content && (
        <div
          className={cn(
            collapsed && "line-clamp-1",
            truncated && !collapsed && "line-clamp-3",
          )}
        >
          <AppMarkdownWrapper markdownContent={content.body} />
        </div>
      )}
      {attachments.length > 0 && !collapsed && (
        <ImageThumbnailGrid
          images={attachments}
          className={content.body ? "mt-2" : undefined}
        />
      )}
    </div>
  );
};

export default memo(EditableContentRenderer);
