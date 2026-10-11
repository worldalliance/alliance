import { cn } from "@alliance/shared/styles/util";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
  type FC,
} from "react";
import { centerCrop, makeAspectCrop, type PercentCrop } from "react-image-crop";
import ImageCropModal from "./ImageCropModal";
import {
  createImage,
  createPreviewImage,
  getCroppedImage,
  rotateImageData,
  ROTATION_DEGREES,
  RotationDirection,
  toSourcePixels,
  type Dimensions,
} from "./imageEditorCanvas";

type ImageEditorProps = {
  initialImageUrl: string | null;
  /** Null only when the user removes the image. A pick reports nothing until its crop lands. */
  onChange: (imageDataUrl: string | null) => void;
  allowedMimeTypes: string[];
  maxFileSizeMb?: number;
  className?: string;
  isUploading?: boolean;
  canRemove?: boolean;
};

type AppliedState = {
  imageSrc: string | null;
  previewSrc: string | null;
  rotation: number;
  crop: PercentCrop | undefined;
};

const DEFAULT_MAX_FILE_SIZE_MB = 20;
const CROPPED_IMAGE_STRING_MAX_LENGTH = 50_000_000;

// ReactCrop hands back a zero-size crop for a click that never became a drag,
// and then refuses to start another one while `keepSelection` holds it.
const withSize = (crop: PercentCrop | undefined) =>
  crop && crop.width > 0 && crop.height > 0 ? crop : null;

const ImageEditor: FC<ImageEditorProps> = ({
  initialImageUrl,
  onChange,
  allowedMimeTypes,
  maxFileSizeMb = DEFAULT_MAX_FILE_SIZE_MB,
  className,
  isUploading = false,
  canRemove = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(initialImageUrl);
  const [previewSrc, setPreviewSrc] = useState<string | null>(initialImageUrl);
  // The last image handed to the caller. It is the only thing the thumbnail
  // shows, so the thumbnail cannot show an edit the caller was never given.
  const [croppedImage, setCroppedImage] = useState<string | null>(
    initialImageUrl,
  );
  const [crop, setCrop] = useState<PercentCrop | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  // The measurement and a rotation settle only their own flag, so a dropped
  // rotation cannot report the measurement that replaced it as finished.
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const isPreviewProcessing = isMeasuring || isRotating;
  const [isCropping, setIsCropping] = useState(false);
  const [hasCustomImage, setHasCustomImage] = useState(false);
  const [sourceDimensions, setSourceDimensions] = useState<Dimensions | null>(
    null,
  );
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const lastInitialUrlRef = useRef<string | null>(initialImageUrl);
  // The editor state the caller's photo was made from. Dismissing returns the
  // editor to it, so it cannot hold a photo the thumbnail isn't showing.
  const appliedRef = useRef<AppliedState>({
    imageSrc: initialImageUrl,
    previewSrc: initialImageUrl,
    rotation: 0,
    crop: undefined,
  });
  const restoredPreviewRef = useRef(false);
  // Only a picked file gets told it will not decode. The caller's own photo
  // has no Done to explain, and it renders in the thumbnail, which sets no
  // crossOrigin and so survives what the measurement's decode cannot.
  const pickedSourceRef = useRef(false);
  // Bumped by everything that replaces the preview, so a rotation still
  // encoding when one of them lands is dropped rather than written back.
  const previewGenerationRef = useRef(0);

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
    setCroppedImage(initialImageUrl);
    setRotation(0);
    setCrop(undefined);
    setError(null);
    lastInitialUrlRef.current = initialImageUrl;
    appliedRef.current = {
      imageSrc: initialImageUrl,
      previewSrc: initialImageUrl,
      rotation: 0,
      crop: undefined,
    };
  }, [initialImageUrl, hasCustomImage]);

  // A rotation that clears this flag on its way out clears a later rotation's,
  // so whatever replaced the preview it drew on clears it here instead.
  const dropRotation = useCallback(() => {
    previewGenerationRef.current += 1;
    setIsRotating(false);
  }, []);

  const triggerFileSelect = useCallback(() => {
    if (isUploading) return;
    fileInputRef.current?.click();
  }, [isUploading]);

  useEffect(() => {
    // A dismiss puts back the preview the applied photo was made on, rotation
    // included, which the downscale below would otherwise overwrite.
    const restored = restoredPreviewRef.current;
    restoredPreviewRef.current = false;

    if (!imageSrc) {
      setSourceDimensions(null);
      setPreviewSrc(null);
      // A cancelled run leaves this set, and never reaches the clear below.
      setIsMeasuring(false);
      return;
    }

    let cancelled = false;
    setIsMeasuring(true);

    (async () => {
      try {
        const image = await createImage(imageSrc);
        if (cancelled) return;
        setSourceDimensions({ width: image.width, height: image.height });
        if (restored) return;
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
          if (pickedSourceRef.current) {
            setError("Unable to read this image. Please try another file.");
          }
        }
      } finally {
        if (!cancelled) {
          setIsMeasuring(false);
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
        // Re-picking the loaded file leaves imageSrc untouched, so the effects
        // keyed on it never rerun to rebuild what the reset below clears.
        if (reader.result === imageSrc) return;
        dropRotation();
        pickedSourceRef.current = true;
        setImageSrc(reader.result);
        setPreviewSrc(reader.result);
        setSourceDimensions(null);
        setCrop(undefined);
        setHasCustomImage(true);
        setIsCropModalOpen(true);
        setRotation(0);
        setError(null);
      };
      reader.readAsDataURL(file);
      event.target.value = "";
    },
    [allowedMimeTypes, dropRotation, imageSrc, maxFileSizeMb],
  );

  const handleRemove = useCallback(() => {
    dropRotation();
    appliedRef.current = {
      imageSrc: null,
      previewSrc: null,
      rotation: 0,
      crop: undefined,
    };
    pickedSourceRef.current = false;
    setImageSrc(null);
    setPreviewSrc(null);
    setCroppedImage(null);
    setSourceDimensions(null);
    setCrop(undefined);
    setHasCustomImage(false);
    setIsCropModalOpen(false);
    setRotation(0);
    setError(null);
    onChange(null);
  }, [dropRotation, onChange]);

  const centerSquareCrop = useCallback((image: HTMLImageElement) => {
    const { width, height } = image;
    if (!width || !height) return;
    const centered = centerCrop(
      makeAspectCrop({ unit: "%", width: 100 }, 1, width, height),
      width,
      height,
    );
    setCrop((prev) => withSize(prev) ?? centered);
  }, []);

  // The preview only fires load when its src changes, so a rotation that
  // re-encodes to a byte-identical preview leaves the crop cleared by
  // handleRotate with nothing to restore it.
  useEffect(() => {
    if (crop || isPreviewProcessing) return;
    const image = previewImageRef.current;
    if (image?.complete) centerSquareCrop(image);
  }, [crop, previewSrc, isPreviewProcessing, centerSquareCrop]);

  const usableCrop = withSize(crop);
  const isCropReady =
    Boolean(usableCrop && rotatedDimensions) && !isPreviewProcessing;

  // ReactCrop finishes a crop on every pointer-up and every arrow keypress, so
  // the full-resolution encode runs here rather than per finished crop.
  const applyCropAndClose = useCallback(async () => {
    if (!imageSrc || !usableCrop || !rotatedDimensions) {
      setError("Unable to process image. Please try another file.");
      return;
    }

    setIsCropping(true);
    try {
      const cropped = await getCroppedImage(
        imageSrc,
        toSourcePixels(usableCrop, rotatedDimensions),
        rotation,
      );
      if (cropped.length > CROPPED_IMAGE_STRING_MAX_LENGTH) {
        setError(
          "The cropped image is too large. Please crop a smaller area or use a smaller image.",
        );
        return;
      }
      setCroppedImage(cropped);
      appliedRef.current = { imageSrc, previewSrc, rotation, crop: usableCrop };
      onChange(cropped);
      setError(null);
      setIsCropModalOpen(false);
    } catch {
      setError("Unable to process image. Please try another file.");
    } finally {
      setIsCropping(false);
    }
  }, [usableCrop, imageSrc, onChange, previewSrc, rotatedDimensions, rotation]);

  const dismissCrop = useCallback(() => {
    setError(null);
    setIsCropModalOpen(false);
    dropRotation();

    const applied = appliedRef.current;
    pickedSourceRef.current = false;
    // Only a changed source reruns the effect that would clobber the preview,
    // so only a changed source arms the flag that stops it.
    restoredPreviewRef.current = applied.imageSrc !== imageSrc;
    setImageSrc(applied.imageSrc);
    setPreviewSrc(applied.previewSrc);
    setRotation(applied.rotation);
    setCrop(applied.crop);
    setHasCustomImage(
      Boolean(applied.imageSrc) &&
        applied.imageSrc !== lastInitialUrlRef.current,
    );
  }, [dropRotation, imageSrc]);

  const handleRotate = useCallback(
    async (direction: RotationDirection) => {
      if (
        !hasCustomImage ||
        isUploading ||
        isPreviewProcessing ||
        !previewSrc
      ) {
        return;
      }

      const generation = previewGenerationRef.current;
      setIsRotating(true);
      try {
        const rotated = await rotateImageData(previewSrc, direction);
        if (previewGenerationRef.current !== generation) return;
        // The crop is mapped onto the source at `rotation`, so the angle and
        // the preview it was drawn on have to move together or not at all.
        setPreviewSrc(rotated);
        setRotation(
          (((rotation + ROTATION_DEGREES[direction]) % 360) + 360) % 360,
        );
        setCrop(undefined);
      } catch {
        if (previewGenerationRef.current === generation) {
          setError("Unable to rotate image. Please try again.");
        }
      } finally {
        if (previewGenerationRef.current === generation) setIsRotating(false);
      }
    },
    [hasCustomImage, isUploading, previewSrc, rotation, isPreviewProcessing],
  );

  const previewImage = croppedImage ?? undefined;
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

        {canRemove && previewImage && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isUploading}
            aria-label="Remove photo"
            title="Remove photo"
            className="absolute right-1 top-1 z-10 rounded-full bg-black/60 p-1 text-white shadow hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}

        {(isUploading || isPreviewProcessing) && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-md bg-white/60 backdrop-blur-[1px]">
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

      {error && !isCropModalOpen && (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      )}

      {hasCustomImage && isCropModalOpen && imageSrc && (
        <ImageCropModal
          previewSrc={previewSrc}
          previewImageRef={previewImageRef}
          rotatedDimensions={rotatedDimensions}
          crop={crop}
          onCropChange={setCrop}
          onPreviewLoad={centerSquareCrop}
          onRotate={handleRotate}
          onChooseAnother={triggerFileSelect}
          onDismiss={dismissCrop}
          onApply={applyCropAndClose}
          error={error}
          isPreviewProcessing={isPreviewProcessing}
          isCropping={isCropping}
          isUploading={isUploading}
          isCropReady={isCropReady}
        />
      )}
    </div>
  );
};

export default ImageEditor;
