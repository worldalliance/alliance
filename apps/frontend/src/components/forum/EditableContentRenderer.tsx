import { EditableContentDto } from "@alliance/shared/client";
import AppMarkdownWrapper from "@alliance/shared/ui/AppMarkdownWrapper";
import React, { useCallback, useEffect, useState } from "react";

interface EditableContentRendererProps {
  content: EditableContentDto;
  collapsed?: boolean;
  deleted?: boolean;
  className?: string;
  charLimit?: number;
}

const EditableContentRenderer: React.FC<EditableContentRendererProps> = ({
  content,
  collapsed = false,
  deleted = false,
  className,
  charLimit,
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const attachments = content.attachments;

  const openLightbox = (idx: number) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);
  const nextImage = useCallback(() => {
    if (!attachments || attachments.length === 0) return;
    setLightboxIndex((i) => (i + 1) % attachments.length);
  }, [attachments]);

  const prevImage = useCallback(() => {
    if (!attachments || attachments.length === 0) return;
    setLightboxIndex((i) => (i - 1 + attachments.length) % attachments.length);
  }, [attachments]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxOpen, nextImage, prevImage]);

  const sharedClasses = "mb-1 whitespace-pre-wrap";

  if (deleted) {
    return (
      <div
        className={`${className ?? ""} ${sharedClasses} text-gray-400 text-sm`}
      >
        Content has been deleted
      </div>
    );
  }

  if (collapsed) {
    const firstLine = content.body.split("\n")[0];
    return (
      <div className={className}>
        {content.body.includes("\n") ? (
          <div className={`${sharedClasses} text-gray-500`}>
            {firstLine} ...
          </div>
        ) : (
          <div className={`${sharedClasses}`}>{firstLine}</div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {content && (
        <AppMarkdownWrapper
          markdownContent={
            charLimit
              ? content.body.slice(0, charLimit) +
                (charLimit < content.body.length ? "..." : "")
              : content.body
          }
        />
      )}
      {attachments.length > 0 && (
        <div className={`flex flex-wrap gap-2 ${content.body ? "mt-2" : ""}`}>
          {attachments.map((key, idx) => (
            <button
              type="button"
              key={idx}
              className="focus:outline-none"
              onClick={() => openLightbox(idx)}
            >
              <img src={key} className="w-28 h-28 object-cover rounded" />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && attachments.length > 0 && (
        <div
          className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <div
            className="relative max-w-5xl w-full px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={attachments[lightboxIndex]}
              className="max-h-[80vh] w-auto mx-auto rounded shadow-2xl"
            />
            {attachments.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white rounded-full w-10 h-10 flex items-center justify-center"
                  aria-label="Previous image"
                >
                  {"<"}
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white rounded-full w-10 h-10 flex items-center justify-center"
                  aria-label="Next image"
                >
                  {">"}
                </button>
              </>
            )}
            <button
              onClick={closeLightbox}
              className="absolute right-6 -top-10 bg-white/20 hover:bg-white/30 text-black rounded-full w-9 h-9 flex items-center justify-center font-avenir"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditableContentRenderer;
