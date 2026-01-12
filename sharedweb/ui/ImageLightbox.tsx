import { X } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ImageLightboxProps = {
  images: string[];
  renderPreview: (
    openAtIndex: (idx: number, e: React.MouseEvent) => void
  ) => React.ReactNode;
};

const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  renderPreview,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const hasImages = images.length > 0;

  const openLightbox = (idx: number, e: React.MouseEvent) => {
    if (!hasImages) return;
    const clampedIndex = Math.min(Math.max(idx, 0), images.length - 1);
    setIndex(clampedIndex);
    setIsOpen(true);
    e.preventDefault();
    e.stopPropagation();
  };

  const closeLightbox = () => setIsOpen(false);

  const nextImage = useCallback(() => {
    if (!hasImages) return;
    setIndex((i) => (i + 1) % images.length);
  }, [hasImages, images.length]);

  const prevImage = useCallback(() => {
    if (!hasImages) return;
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [hasImages, images.length]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, nextImage, prevImage]);

  return (
    <>
      {renderPreview(openLightbox)}
      {isOpen &&
        hasImages &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center"
            onClick={closeLightbox}
          >
            <div
              className="relative max-w-5xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={images[index]}
                className="max-h-[80vh] w-auto mx-auto rounded shadow-2xl"
              />
              {images.length > 1 && (
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
          </div>,
          document.body
        )}
    </>
  );
};

export default ImageLightbox;
