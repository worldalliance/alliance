import { EditableContentDto } from "@alliance/shared/client";
import AppMarkdownWrapper from "@alliance/shared/ui/AppMarkdownWrapper";
import { X } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

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
    return (
      <div className={`line-clamp-1 ${className ?? ""}`}>
        <AppMarkdownWrapper markdownContent={content.body} />
      </div>
    );
  }

  return (
    <div className={className}>
      {content && (
        <div className={`${truncated ? "line-clamp-3" : ""}`}>
          <AppMarkdownWrapper markdownContent={content.body} />
        </div>
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
              <img
                src={key ?? null}
                className="w-28 h-28 object-cover rounded"
              />
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
            className="relative max-w-5xl p-6"
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
              className="absolute -right-5 -top-5 hover:bg-black text-white rounded-full w-9 h-9 flex items-center justify-center font-avenir"
              aria-label="Close"
            >
              <X size={18} strokeWidth={3} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditableContentRenderer;
