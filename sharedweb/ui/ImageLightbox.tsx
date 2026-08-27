import { cn } from "@alliance/shared/styles/util";
import React, { useRef, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/plugins/counter.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import { zIndexValues } from "./zIndex";

type ImageLightboxProps = {
  images: string[];
  renderPreview: (
    openAtIndex: (idx: number, e: React.MouseEvent) => void,
  ) => React.ReactNode;
};

type LightboxOverlayProps = {
  images: string[];
  /** Index of the slide to show; negative = closed. */
  index: number;
  onClose: () => void;
};

const LightboxOverlay = ({ images, index, onClose }: LightboxOverlayProps) => {
  const open = index >= 0;
  // Keep showing the last-open slides/index while closed, so the close
  // animation fades the image out in place instead of blanking (callers may
  // empty `images`) or jumping to slide 0 (callers reset `index`).
  const lastOpenRef = useRef({ images, index: 0 });
  if (open) {
    lastOpenRef.current = { images, index };
  }
  const shown = open ? { images, index } : lastOpenRef.current;
  const multiple = shown.images.length > 1;

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={shown.index}
      slides={shown.images.map((src) => ({ src }))}
      plugins={multiple ? [Counter, Zoom] : [Zoom]}
      carousel={{ finite: !multiple }}
      controller={{ closeOnBackdropClick: true }}
      styles={{ root: { "--yarl__portal_zindex": zIndexValues.modal } }}
      render={
        multiple
          ? undefined
          : { buttonPrev: () => null, buttonNext: () => null }
      }
    />
  );
};

/**
 * Caller-controlled single-image lightbox — open while `src` is set. For
 * images that aren't known as a collection up front (e.g. markdown bodies).
 */
export const ImageLightboxModal: React.FC<{
  src: string | null;
  onClose: () => void;
}> = ({ src, onClose }) => (
  <LightboxOverlay
    images={src ? [src] : []}
    index={src ? 0 : -1}
    onClose={onClose}
  />
);

const ImageLightbox: React.FC<ImageLightboxProps> = ({
  images,
  renderPreview,
}) => {
  // -1 = closed
  const [index, setIndex] = useState(-1);

  const openLightbox = (idx: number, e: React.MouseEvent) => {
    if (images.length === 0) return;
    setIndex(Math.min(Math.max(idx, 0), images.length - 1));
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      {renderPreview(openLightbox)}
      <LightboxOverlay
        images={images}
        index={index}
        onClose={() => setIndex(-1)}
      />
    </>
  );
};

type ImageThumbnailGridProps = {
  images: string[];
  /** Extra classes for the grid container (e.g. margins). */
  className?: string;
  /** Extra classes for each thumbnail image (e.g. borders). */
  imageClassName?: string;
  /** Alt text applied to every thumbnail. */
  alt?: string;
};

/**
 * The standard attachment preview: a wrapping row of square thumbnails that
 * open the lightbox at the clicked image. Use `ImageLightbox` directly only
 * when a surface needs a custom preview layout.
 */
export const ImageThumbnailGrid: React.FC<ImageThumbnailGridProps> = ({
  images,
  className,
  imageClassName,
  alt = "Attachment",
}) => (
  <ImageLightbox
    images={images}
    renderPreview={(openAtIndex) => (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {images.map((src, idx) => (
          <button
            type="button"
            key={idx}
            className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-zoom-in"
            onClick={(e) => openAtIndex(idx, e)}
            aria-label={
              images.length > 1
                ? `Open image ${idx + 1} of ${images.length}`
                : "Open image"
            }
          >
            <img
              src={src}
              alt={alt}
              className={cn("w-44 h-44 object-cover rounded", imageClassName)}
            />
          </button>
        ))}
      </div>
    )}
  />
);

export default ImageLightbox;
