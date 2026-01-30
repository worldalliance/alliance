import {
  type ChangeEventHandler,
  type FC,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RiArrowGoBackLine, RiArrowGoForwardLine } from "@remixicon/react";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";

type ImageEditorProps = {
  initialImageUrl: string | null;
  onChange: (imageDataUrl: string | null) => void;
  allowedMimeTypes: string[];
  maxFileSizeMb?: number;
  className?: string;
  isUploading?: boolean;
};

type CropRect = {
  x: number;
  y: number;
  size: number;
};

type ImageLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragHandle = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

type DragState =
  | {
      type: "move";
      startPointer: { x: number; y: number };
      startCrop: CropRect;
    }
  | {
      type: "resize";
      handle: DragHandle;
      startCrop: CropRect;
      containerRect: DOMRect;
    };

const DEFAULT_MAX_FILE_SIZE_MB = 20;
const ABS_MIN_CROP_SIZE = 80;
const MIN_CROP_RATIO = 0.45;
const MAX_PREVIEW_SIZE = 1200;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getRadianAngle = (degreeValue: number) => (degreeValue * Math.PI) / 180;

const createImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

const getCroppedImage = async (
  imageSrc: string,
  pixelCrop: PixelCrop,
  rotation: number
) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to create canvas context");
  }

  const rotRad = getRadianAngle(rotation);
  const { width: imgWidth, height: imgHeight } = image;

  const boundWidth =
    Math.abs(Math.cos(rotRad) * imgWidth) +
    Math.abs(Math.sin(rotRad) * imgHeight);
  const boundHeight =
    Math.abs(Math.sin(rotRad) * imgWidth) +
    Math.abs(Math.cos(rotRad) * imgHeight);

  canvas.width = boundWidth;
  canvas.height = boundHeight;

  ctx.translate(boundWidth / 2, boundHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-imgWidth / 2, -imgHeight / 2);
  ctx.drawImage(image, 0, 0);

  const cropX = Math.round(pixelCrop.x);
  const cropY = Math.round(pixelCrop.y);
  const cropWidth = Math.round(pixelCrop.width);
  const cropHeight = Math.round(pixelCrop.height);

  const data = ctx.getImageData(cropX, cropY, cropWidth, cropHeight);

  canvas.width = cropWidth;
  canvas.height = cropHeight;

  ctx.putImageData(data, 0, 0);

  return canvas.toDataURL("image/png");
};

const createPreviewImage = async (image: HTMLImageElement) => {
  const maxDimension = Math.max(image.width, image.height);
  if (maxDimension <= MAX_PREVIEW_SIZE) {
    return image.src;
  }
  const scale = MAX_PREVIEW_SIZE / maxDimension;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to create canvas context");
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
};

const rotateImageData = async (
  imageSrc: string,
  direction: "left" | "right"
) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to create canvas context");
  }

  const angle = direction === "left" ? -90 : 90;
  const rotRad = getRadianAngle(angle);
  const width = image.width;
  const height = image.height;
  const swap = Math.abs(angle / 90) % 2 === 1;

  canvas.width = swap ? height : width;
  canvas.height = swap ? width : height;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotRad);
  ctx.drawImage(image, -width / 2, -height / 2);

  return canvas.toDataURL("image/png");
};

const getMinCropSize = (layout: ImageLayout) => {
  const maxSize = Math.min(layout.width, layout.height);
  return Math.min(
    Math.max(maxSize * MIN_CROP_RATIO, ABS_MIN_CROP_SIZE),
    maxSize
  );
};

const convertCropToPixels = (
  cropRect: CropRect,
  imageLayout: ImageLayout,
  dimensions: { width: number; height: number }
): PixelCrop => {
  const scaleX = dimensions.width / imageLayout.width;
  const scaleY = dimensions.height / imageLayout.height;

  return {
    x: (cropRect.x - imageLayout.x) * scaleX,
    y: (cropRect.y - imageLayout.y) * scaleY,
    width: cropRect.size * scaleX,
    height: cropRect.size * scaleY,
  };
};

const areCropsRoughlyEqual = (a: PixelCrop | null, b: PixelCrop) => {
  if (!a) return false;
  const threshold = 0.5;
  return (
    Math.abs(a.x - b.x) < threshold &&
    Math.abs(a.y - b.y) < threshold &&
    Math.abs(a.width - b.width) < threshold &&
    Math.abs(a.height - b.height) < threshold
  );
};

const resizeCropRect = (
  handle: DragHandle,
  pointer: { x: number; y: number },
  start: CropRect,
  imageRect: ImageLayout
): CropRect => {
  const minSize = getMinCropSize(imageRect);
  const maxRight = imageRect.x + imageRect.width;
  const maxBottom = imageRect.y + imageRect.height;
  const minLeft = imageRect.x;
  const minTop = imageRect.y;

  switch (handle) {
    case "topLeft": {
      const anchorX = start.x + start.size;
      const anchorY = start.y + start.size;
      const pointerX = clamp(pointer.x, minLeft, anchorX - minSize);
      const pointerY = clamp(pointer.y, minTop, anchorY - minSize);
      const deltaX = anchorX - pointerX;
      const deltaY = anchorY - pointerY;
      const maxSize = Math.min(anchorX - minLeft, anchorY - minTop);
      const size = clamp(Math.min(deltaX, deltaY), minSize, maxSize);
      return { x: anchorX - size, y: anchorY - size, size };
    }
    case "topRight": {
      const anchorX = start.x;
      const anchorY = start.y + start.size;
      const pointerX = clamp(pointer.x, anchorX + minSize, maxRight);
      const pointerY = clamp(pointer.y, minTop, anchorY - minSize);
      const deltaX = pointerX - anchorX;
      const deltaY = anchorY - pointerY;
      const maxSize = Math.min(maxRight - anchorX, anchorY - minTop);
      const size = clamp(Math.min(deltaX, deltaY), minSize, maxSize);
      return { x: anchorX, y: anchorY - size, size };
    }
    case "bottomLeft": {
      const anchorX = start.x + start.size;
      const anchorY = start.y;
      const pointerX = clamp(pointer.x, minLeft, anchorX - minSize);
      const pointerY = clamp(pointer.y, anchorY + minSize, maxBottom);
      const deltaX = anchorX - pointerX;
      const deltaY = pointerY - anchorY;
      const maxSize = Math.min(anchorX - minLeft, maxBottom - anchorY);
      const size = clamp(Math.min(deltaX, deltaY), minSize, maxSize);
      return { x: anchorX - size, y: anchorY, size };
    }
    case "bottomRight":
    default: {
      const anchorX = start.x;
      const anchorY = start.y;
      const pointerX = clamp(pointer.x, anchorX + minSize, maxRight);
      const pointerY = clamp(pointer.y, anchorY + minSize, maxBottom);
      const deltaX = pointerX - anchorX;
      const deltaY = pointerY - anchorY;
      const maxSize = Math.min(maxRight - anchorX, maxBottom - anchorY);
      const size = clamp(Math.min(deltaX, deltaY), minSize, maxSize);
      return { x: anchorX, y: anchorY, size };
    }
  }
};

const ImageEditor: FC<ImageEditorProps> = ({
  initialImageUrl,
  onChange,
  allowedMimeTypes,
  maxFileSizeMb = DEFAULT_MAX_FILE_SIZE_MB,
  className,
  isUploading = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(initialImageUrl);
  const [previewSrc, setPreviewSrc] = useState<string | null>(initialImageUrl);
  const [error, setError] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [isPreviewProcessing, setIsPreviewProcessing] = useState(false);
  const [hasCustomImage, setHasCustomImage] = useState(false);
  const [sourceDimensions, setSourceDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [imageLayout, setImageLayout] = useState<ImageLayout | null>(null);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropCommitVersion, setCropCommitVersion] = useState(0);
  const lastInitialUrlRef = useRef<string | null>(initialImageUrl);
  const lastGeneratedRef = useRef<string | null>(initialImageUrl);
  const lastSelectionRef = useRef<PixelCrop | null>(null);
  const isDraggingRef = useRef(false);
  const dragJustEndedRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);

  const rotatedDimensions = useMemo(() => {
    if (!sourceDimensions) return null;
    const { width, height } = sourceDimensions;
    if (rotation % 180 === 0) {
      return { width, height };
    }
    return { width: height, height: width };
  }, [sourceDimensions, rotation]);

  useEffect(() => {
    if (hasCustomImage) return;
    if (initialImageUrl === lastInitialUrlRef.current) return;

    setImageSrc(initialImageUrl);
    setPreviewSrc(initialImageUrl);
    setRotation(0);
    setImageLayout(null);
    setCropRect(null);
    setError(null);
    lastGeneratedRef.current = initialImageUrl;
    lastInitialUrlRef.current = initialImageUrl;
    lastSelectionRef.current = null;
  }, [initialImageUrl, hasCustomImage]);

  const triggerFileSelect = useCallback(() => {
    if (isUploading) return;
    fileInputRef.current?.click();
  }, [isUploading]);

  useEffect(() => {
    if (!imageSrc) {
      setSourceDimensions(null);
      setPreviewSrc(null);
      return;
    }

    let cancelled = false;
    setIsPreviewProcessing(true);

    (async () => {
      try {
        const image = await createImage(imageSrc);
        if (cancelled) return;
        setSourceDimensions({ width: image.width, height: image.height });
        let preview = imageSrc;
        try {
          preview = await createPreviewImage(image);
        } catch {
          preview = imageSrc;
        }
        if (!cancelled) {
          setPreviewSrc(preview);
        }
      } catch {
        if (!cancelled) {
          setSourceDimensions(null);
          setPreviewSrc(imageSrc);
        }
      } finally {
        if (!cancelled) {
          setIsPreviewProcessing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  const handleFileChange: ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setError(null);

      if (!allowedMimeTypes.includes(file.type)) {
        setError("Please select a valid image file.");
        event.target.value = "";
        return;
      }

      const maxBytes = maxFileSizeMb * 1024 * 1024;
      if (file.size > maxBytes) {
        setError(
          `Image size must be less than ${maxFileSizeMb}MB. Please choose a smaller image.`
        );
        event.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") return;
        dragStateRef.current = null;
        setImageSrc(reader.result);
        setPreviewSrc(reader.result);
        setSourceDimensions(null);
        setImageLayout(null);
        setCropRect(null);
        setHasCustomImage(true);
        setIsCropModalOpen(true);
        setRotation(0);
        setError(null);
        lastGeneratedRef.current = null;
        lastSelectionRef.current = null;
        onChange(null);
      };
      reader.readAsDataURL(file);
      event.target.value = "";
    },
    [allowedMimeTypes, maxFileSizeMb, onChange]
  );

  const updateLayout = useCallback(() => {
    if (!containerRef.current || !rotatedDimensions) return;

    const rect = containerRef.current.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    if (!containerWidth || !containerHeight) return;

    const imageAspect = rotatedDimensions.width / rotatedDimensions.height;
    const containerAspect = containerWidth / containerHeight;

    let displayWidth = containerWidth;
    let displayHeight = containerHeight;

    if (imageAspect > containerAspect) {
      displayHeight = containerWidth / imageAspect;
    } else {
      displayWidth = containerHeight * imageAspect;
    }

    const offsetX = (containerWidth - displayWidth) / 2;
    const offsetY = (containerHeight - displayHeight) / 2;
    const layout: ImageLayout = {
      x: offsetX,
      y: offsetY,
      width: displayWidth,
      height: displayHeight,
    };

    setImageLayout(layout);
    setCropRect((prev) => {
      const maxSize = Math.min(displayWidth, displayHeight);
      const minSize = getMinCropSize(layout);

      if (!prev) {
        const size = maxSize;
        return {
          x: offsetX + (displayWidth - size) / 2,
          y: offsetY + (displayHeight - size) / 2,
          size,
        };
      }

      const size = clamp(prev.size, minSize, maxSize);
      const maxX = offsetX + displayWidth - size;
      const maxY = offsetY + displayHeight - size;

      return {
        x: clamp(prev.x, offsetX, maxX),
        y: clamp(prev.y, offsetY, maxY),
        size,
      };
    });
  }, [rotatedDimensions]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !isCropModalOpen ||
      !hasCustomImage ||
      !rotatedDimensions
    ) {
      return;
    }

    updateLayout();

    const container = containerRef.current;
    if (!container) return;

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateLayout())
        : null;

    observer?.observe(container);

    const handleWindowResize = () => updateLayout();
    window.addEventListener("resize", handleWindowResize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [hasCustomImage, isCropModalOpen, rotatedDimensions, updateLayout]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isCropModalOpen || !imageLayout || isUploading) {
      dragStateRef.current = null;
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const state = dragStateRef.current;
      if (
        activePointerIdRef.current !== null &&
        event.pointerId !== activePointerIdRef.current
      ) {
        return;
      }
      if (!state || !imageLayout) return;

      event.preventDefault();

      if (state.type === "move") {
        const deltaX = event.clientX - state.startPointer.x;
        const deltaY = event.clientY - state.startPointer.y;
        const size = state.startCrop.size;
        const maxX = imageLayout.x + imageLayout.width - size;
        const maxY = imageLayout.y + imageLayout.height - size;

        setCropRect({
          x: clamp(state.startCrop.x + deltaX, imageLayout.x, maxX),
          y: clamp(state.startCrop.y + deltaY, imageLayout.y, maxY),
          size,
        });
      } else if (state.type === "resize") {
        const { left, top } = state.containerRect;
        const pointer = {
          x: event.clientX - left,
          y: event.clientY - top,
        };
        setCropRect(
          resizeCropRect(state.handle, pointer, state.startCrop, imageLayout)
        );
      }
    };

    const stopDragging = (event: PointerEvent) => {
      if (
        activePointerIdRef.current !== null &&
        event.pointerId !== activePointerIdRef.current
      ) {
        return;
      }
      activePointerIdRef.current = null;
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        dragJustEndedRef.current = true;
        // Reset after the click event would fire
        requestAnimationFrame(() => {
          dragJustEndedRef.current = false;
        });
        setCropCommitVersion((value) => value + 1);
      }
      dragStateRef.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, [imageLayout, isCropModalOpen, isUploading]);

  useEffect(() => {
    if (
      !hasCustomImage ||
      !imageSrc ||
      !cropRect ||
      !imageLayout ||
      !rotatedDimensions
    ) {
      return;
    }

    if (isDraggingRef.current) {
      return;
    }

    const pixelCrop = convertCropToPixels(
      cropRect,
      imageLayout,
      rotatedDimensions
    );
    const previous = lastSelectionRef.current;
    if (previous && areCropsRoughlyEqual(previous, pixelCrop)) {
      return;
    }

    lastSelectionRef.current = pixelCrop;

    let isCancelled = false;

    const generate = async () => {
      try {
        const cropped = await getCroppedImage(imageSrc, pixelCrop, rotation);
        if (!isCancelled) {
          lastGeneratedRef.current = cropped;
          onChange(cropped);
          setError(null);
        }
      } catch {
        if (!isCancelled) {
          setError("Unable to process image. Please try another file.");
        }
      } finally {
      }
    };

    void generate();

    return () => {
      isCancelled = true;
    };
  }, [
    cropRect,
    cropCommitVersion,
    hasCustomImage,
    imageLayout,
    imageSrc,
    onChange,
    rotatedDimensions,
    rotation,
  ]);

  const handleStartMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!cropRect || isUploading) return;
      event.preventDefault();
      isDraggingRef.current = true;
      activePointerIdRef.current = event.pointerId;
      dragStateRef.current = {
        type: "move",
        startPointer: { x: event.clientX, y: event.clientY },
        startCrop: cropRect,
      };
    },
    [cropRect, isUploading]
  );

  const handleResizePointerDown = useCallback(
    (handle: DragHandle) => (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!cropRect || !containerRef.current || isUploading) return;
      event.preventDefault();
      event.stopPropagation();
      isDraggingRef.current = true;
      activePointerIdRef.current = event.pointerId;
      dragStateRef.current = {
        type: "resize",
        handle,
        startCrop: cropRect,
        containerRect: containerRef.current.getBoundingClientRect(),
      };
    },
    [cropRect, isUploading]
  );

  const handleRotate = useCallback(
    async (direction: "left" | "right") => {
      if (!hasCustomImage || isUploading || isPreviewProcessing) {
        return;
      }
      const delta = direction === "left" ? -90 : 90;
      const updatedRotation = (((rotation + delta) % 360) + 360) % 360;
      setRotation(updatedRotation);
      setCropRect(null);
      lastSelectionRef.current = null;
      lastGeneratedRef.current = null;

      if (!previewSrc) {
        return;
      }

      setIsPreviewProcessing(true);
      try {
        const rotatedPreview = await rotateImageData(previewSrc, direction);
        setPreviewSrc(rotatedPreview);
      } catch {
        setError("Unable to rotate image. Please try again.");
      } finally {
        setIsPreviewProcessing(false);
      }
    },
    [hasCustomImage, isUploading, previewSrc, rotation, isPreviewProcessing]
  );

  const previewImage = useMemo(() => {
    if (hasCustomImage) {
      return lastGeneratedRef.current ?? previewSrc ?? imageSrc ?? undefined;
    }
    return previewSrc ?? imageSrc ?? undefined;
  }, [hasCustomImage, imageSrc, previewSrc]);
  const showMobileOverlay = !hasCustomImage && Boolean(previewImage);

  const containerClassName = useMemo(() => {
    return ["relative w-fit", className].filter(Boolean).join(" ");
  }, [className]);

  return (
    <div className={containerClassName}>
      <div className="group relative w-29 h-29 rounded-md overflow-hidden bg-zinc-100">
        {previewImage ? (
          <img
            src={lastGeneratedRef.current ?? previewImage}
            alt="Profile preview"
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
            No photo selected
          </div>
        )}

        {!hasCustomImage ? (
          <button
            type="button"
            onClick={triggerFileSelect}
            disabled={isUploading}
            className={`absolute inset-0 flex items-center justify-center bg-white/80 text-xs text-zinc-600 transition-opacity disabled:opacity-40 focus-visible:opacity-100 ${
              showMobileOverlay
                ? "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                : "opacity-0 group-hover:opacity-100"
            }`}
          >
            {previewImage ? "Change photo" : "Upload photo"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsCropModalOpen(true)}
            disabled={isUploading}
            className="absolute bottom-2 text-nowrap left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
          >
            Edit photo
          </button>
        )}

        {(isUploading || isPreviewProcessing) && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-white/60 backdrop-blur-[1px]">
            <Spinner size="small" />
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={allowedMimeTypes.join(",")}
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {hasCustomImage && isCropModalOpen && imageSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-2"
          onClick={() => {
            if (!dragJustEndedRef.current) {
              setIsCropModalOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-[640px] rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-lg font-semibold text-zinc-900">
                Adjust your photo
              </p>
              <Button
                onClick={() => setIsCropModalOpen(false)}
                disabled={isUploading}
                color={ButtonColor.Black}
              >
                Done
              </Button>
            </div>

            <div
              ref={containerRef}
              className="relative aspect-square w-full select-none touch-none overflow-hidden rounded-xl bg-zinc-900"
            >
              {isPreviewProcessing && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
                  <Spinner />
                </div>
              )}
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt="Profile to crop"
                  className="absolute inset-0 h-full w-full object-contain"
                  draggable={false}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-zinc-300">
                  Loading preview...
                </div>
              )}

              {cropRect && (
                <div
                  className="absolute border-2 border-white touch-none"
                  style={{
                    left: `${cropRect.x}px`,
                    top: `${cropRect.y}px`,
                    width: `${cropRect.size}px`,
                    height: `${cropRect.size}px`,
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                    cursor: "move",
                  }}
                  onPointerDown={handleStartMove}
                >
                  {(
                    [
                      "topLeft",
                      "topRight",
                      "bottomLeft",
                      "bottomRight",
                    ] as DragHandle[]
                  ).map((handle) => (
                    <button
                      key={handle}
                      type="button"
                      aria-label={`Resize ${handle}`}
                      className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 bg-white shadow-[0_0_8px_rgba(0,0,0,0.55)] focus-visible:outline-2 focus-visible:outline-white touch-none"
                      style={{
                        left: handle.includes("Right") ? "100%" : "0%",
                        top: handle.startsWith("top") ? "0%" : "100%",
                        cursor:
                          handle === "topLeft" || handle === "bottomRight"
                            ? "nwse-resize"
                            : "nesw-resize",
                      }}
                      onPointerDown={handleResizePointerDown(handle)}
                    />
                  ))}
                </div>
              )}

              <button
                type="button"
                className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-zinc-700 shadow disabled:opacity-40"
                onClick={() => handleRotate("left")}
                disabled={isPreviewProcessing || isUploading}
              >
                <RiArrowGoBackLine className="h-5 w-5" />
              </button>
              <button
                type="button"
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/85 text-zinc-700 shadow disabled:opacity-40"
                onClick={() => handleRotate("right")}
                disabled={isPreviewProcessing || isUploading}
              >
                <RiArrowGoForwardLine className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between text-sm text-zinc-600">
              <p className="hidden sm:block">
                Drag the corners or move the square to crop your picture.
              </p>
              <button
                type="button"
                className="font-medium text-green hover:opacity-80 disabled:opacity-40"
                onClick={triggerFileSelect}
                disabled={isUploading}
              >
                Choose another photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageEditor;
