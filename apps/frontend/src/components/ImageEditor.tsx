import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@alliance/sharedweb/ui/Modal";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { RotateCcw, RotateCw } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
  type FC,
} from "react";
import ReactCrop, {
  areCropsEqual,
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PercentCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

type ImageEditorProps = {
  initialImageUrl: string | null;
  onChange: (imageDataUrl: string | null) => void;
  allowedMimeTypes: string[];
  maxFileSizeMb?: number;
  className?: string;
  isUploading?: boolean;
};

type Dimensions = {
  width: number;
  height: number;
};

type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const DEFAULT_MAX_FILE_SIZE_MB = 20;
const MIN_CROP_SIZE = 80;
const MAX_PREVIEW_SIZE = 1200;
const MAX_CROP_HEIGHT = "60vh";
const CROPPED_IMAGE_STRING_MAX_LENGTH = 50_000_000;

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
  rotation: number,
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
  direction: "left" | "right",
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

  canvas.width = height;
  canvas.height = width;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotRad);
  ctx.drawImage(image, -width / 2, -height / 2);

  return canvas.toDataURL("image/png");
};

const toSourcePixels = (
  percentCrop: PercentCrop,
  dimensions: Dimensions,
): PixelCrop => ({
  x: (percentCrop.x / 100) * dimensions.width,
  y: (percentCrop.y / 100) * dimensions.height,
  width: (percentCrop.width / 100) * dimensions.width,
  height: (percentCrop.height / 100) * dimensions.height,
});

const ImageEditor: FC<ImageEditorProps> = ({
  initialImageUrl,
  onChange,
  allowedMimeTypes,
  maxFileSizeMb = DEFAULT_MAX_FILE_SIZE_MB,
  className,
  isUploading = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(initialImageUrl);
  const [previewSrc, setPreviewSrc] = useState<string | null>(initialImageUrl);
  const [croppedImage, setCroppedImage] = useState<string | null>(
    initialImageUrl,
  );
  const [crop, setCrop] = useState<Crop | undefined>(undefined);
  const [completedCrop, setCompletedCrop] = useState<PercentCrop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [isPreviewProcessing, setIsPreviewProcessing] = useState(false);
  const [hasCustomImage, setHasCustomImage] = useState(false);
  const [sourceDimensions, setSourceDimensions] = useState<Dimensions | null>(
    null,
  );
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const lastInitialUrlRef = useRef<string | null>(initialImageUrl);

  // The crop effect below re-encodes the source at full resolution, so onChange
  // stays out of its dependencies: a caller that renders a fresh callback and
  // sets state from it would otherwise re-encode on every render, forever.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const rotatedDimensions = useMemo(() => {
    if (!sourceDimensions) return null;
    const { width, height } = sourceDimensions;
    if (rotation % 180 === 0) {
      return { width, height };
    }
    return { width: height, height: width };
  }, [sourceDimensions, rotation]);

  // A definite width, rather than max-width plus max-height, is what scales a
  // small image up to the crop box: max-* only ever shrinks, and pairing a
  // full width with a capped height stretches the image instead of fitting it.
  const cropWidth = rotatedDimensions
    ? `min(100%, calc(${MAX_CROP_HEIGHT} * ${rotatedDimensions.width / rotatedDimensions.height}))`
    : undefined;

  useEffect(() => {
    if (hasCustomImage) return;
    if (initialImageUrl === lastInitialUrlRef.current) return;

    setImageSrc(initialImageUrl);
    setPreviewSrc(initialImageUrl);
    setCroppedImage(initialImageUrl);
    setRotation(0);
    setCrop(undefined);
    setCompletedCrop(null);
    setError(null);
    lastInitialUrlRef.current = initialImageUrl;
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
          `Image size must be less than ${maxFileSizeMb}MB. Please choose a smaller image.`,
        );
        event.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") return;
        setImageSrc(reader.result);
        setPreviewSrc(reader.result);
        setCroppedImage(null);
        setSourceDimensions(null);
        setCrop(undefined);
        setCompletedCrop(null);
        setHasCustomImage(true);
        setIsCropModalOpen(true);
        setRotation(0);
        setError(null);
        onChange(null);
      };
      reader.readAsDataURL(file);
      event.target.value = "";
    },
    [allowedMimeTypes, maxFileSizeMb, onChange],
  );

  const centerSquareCrop = useCallback((image: HTMLImageElement) => {
    const { width, height } = image;
    if (!width || !height) return;
    const centered = centerCrop(
      makeAspectCrop({ unit: "%", width: 100 }, 1, width, height),
      width,
      height,
    );
    setCrop((prev) => prev ?? centered);
    setCompletedCrop((prev) => prev ?? centered);
  }, []);

  // The preview only fires load when its src changes, so a rotation that
  // re-encodes to a byte-identical preview leaves the crop cleared by
  // handleRotate with nothing to restore it.
  useEffect(() => {
    if (crop || isPreviewProcessing) return;
    const image = previewImageRef.current;
    if (image?.complete) centerSquareCrop(image);
  }, [crop, previewSrc, isPreviewProcessing, centerSquareCrop]);

  useEffect(() => {
    if (!hasCustomImage || !imageSrc || !completedCrop || !rotatedDimensions) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const cropped = await getCroppedImage(
          imageSrc,
          toSourcePixels(completedCrop, rotatedDimensions),
          rotation,
        );
        if (cancelled) return;
        if (cropped.length > CROPPED_IMAGE_STRING_MAX_LENGTH) {
          setError(
            "The cropped image is too large. Please crop a smaller area or use a smaller image.",
          );
          return;
        }
        setCroppedImage(cropped);
        onChangeRef.current(cropped);
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Unable to process image. Please try another file.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [completedCrop, hasCustomImage, imageSrc, rotatedDimensions, rotation]);

  const handleRotate = useCallback(
    async (direction: "left" | "right") => {
      if (!hasCustomImage || isUploading || isPreviewProcessing) {
        return;
      }
      const delta = direction === "left" ? -90 : 90;
      setRotation((((rotation + delta) % 360) + 360) % 360);
      setCrop(undefined);
      setCompletedCrop(null);

      if (!previewSrc) {
        return;
      }

      setIsPreviewProcessing(true);
      try {
        setPreviewSrc(await rotateImageData(previewSrc, direction));
      } catch {
        setError("Unable to rotate image. Please try again.");
      } finally {
        setIsPreviewProcessing(false);
      }
    },
    [hasCustomImage, isUploading, previewSrc, rotation, isPreviewProcessing],
  );

  const previewImage = croppedImage ?? previewSrc ?? imageSrc ?? undefined;
  const showMobileOverlay = !hasCustomImage && Boolean(previewImage);

  return (
    <div className={cn("relative w-fit", className)}>
      <div className="group relative w-29 h-29 rounded-md overflow-hidden bg-zinc-100">
        {previewImage ? (
          <img
            src={previewImage}
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
            className={cn(
              "absolute inset-0",
              "flex items-center justify-center",
              "bg-white/80 text-xs text-zinc-600 transition-opacity disabled:opacity-40 focus-visible:opacity-100",
              showMobileOverlay
                ? "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                : "opacity-0 group-hover:opacity-100",
            )}
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
        <Modal
          onClose={() => setIsCropModalOpen(false)}
          dismissDisabled={isUploading}
          panelClassName="max-w-[640px] shadow-2xl"
        >
          <ModalHeader>
            <ModalTitle className="text-lg font-semibold text-zinc-900">
              Adjust your photo
            </ModalTitle>
          </ModalHeader>

          <ModalBody>
            <div className="relative flex min-h-40 w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-900 p-3">
              {isPreviewProcessing && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
                  <Spinner />
                </div>
              )}
              {previewSrc ? (
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  // Every change to completedCrop re-encodes the source at full
                  // resolution, and ReactCrop completes a crop on any
                  // pointer-up, so keep the previous object when nothing moved.
                  onComplete={(_, percentCrop) =>
                    setCompletedCrop((prev) =>
                      prev && areCropsEqual(prev, percentCrop)
                        ? prev
                        : percentCrop,
                    )
                  }
                  aspect={1}
                  minWidth={MIN_CROP_SIZE}
                  minHeight={MIN_CROP_SIZE}
                  keepSelection
                  disabled={isUploading}
                  style={{ maxHeight: MAX_CROP_HEIGHT, width: cropWidth }}
                >
                  <img
                    ref={previewImageRef}
                    src={previewSrc}
                    alt="Profile to crop"
                    className="w-full"
                    onLoad={(event) => centerSquareCrop(event.currentTarget)}
                  />
                </ReactCrop>
              ) : (
                <div className="p-8 text-zinc-300">Loading preview...</div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Rotate left"
                  title="Rotate left"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 disabled:hover:bg-transparent"
                  onClick={() => handleRotate("left")}
                  disabled={isPreviewProcessing || isUploading}
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Rotate right"
                  title="Rotate right"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 disabled:hover:bg-transparent"
                  onClick={() => handleRotate("right")}
                  disabled={isPreviewProcessing || isUploading}
                >
                  <RotateCw className="h-5 w-5" />
                </button>
              </div>
              <p className="hidden text-sm text-zinc-500 sm:block">
                Drag the corners or move the square to crop your picture.
              </p>
            </div>
          </ModalBody>

          <ModalFooter className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="font-medium text-green hover:opacity-80 disabled:opacity-40"
              onClick={triggerFileSelect}
              disabled={isUploading}
            >
              Choose another photo
            </button>
            <ModalActions>
              <Button
                onClick={() => setIsCropModalOpen(false)}
                disabled={isUploading}
                color={ButtonColor.Black}
              >
                Done
              </Button>
            </ModalActions>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
};

export default ImageEditor;
