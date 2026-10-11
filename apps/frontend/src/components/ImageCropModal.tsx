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
import type { FC, RefObject } from "react";
import ReactCrop, { type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { RotationDirection, type Dimensions } from "./imageEditorCanvas";

type ImageCropModalProps = {
  previewSrc: string | null;
  previewImageRef: RefObject<HTMLImageElement | null>;
  rotatedDimensions: Dimensions | null;
  crop: PercentCrop | undefined;
  onCropChange: (crop: PercentCrop) => void;
  onPreviewLoad: (image: HTMLImageElement) => void;
  onRotate: (direction: RotationDirection) => void;
  onChooseAnother: () => void;
  onDismiss: () => void;
  onApply: () => void;
  error: string | null;
  isPreviewProcessing: boolean;
  isCropping: boolean;
  isUploading: boolean;
  isCropReady: boolean;
};

const MIN_CROP_SIZE = 80;
const MAX_CROP_HEIGHT = "60vh";

const ImageCropModal: FC<ImageCropModalProps> = ({
  previewSrc,
  previewImageRef,
  rotatedDimensions,
  crop,
  onCropChange,
  onPreviewLoad,
  onRotate,
  onChooseAnother,
  onDismiss,
  onApply,
  error,
  isPreviewProcessing,
  isCropping,
  isUploading,
  isCropReady,
}) => {
  // A definite width, rather than max-width plus max-height, is what scales a
  // small image up to the crop box: max-* only ever shrinks, and pairing a
  // full width with a capped height stretches the image instead of fitting it.
  const cropWidth = rotatedDimensions
    ? `min(100%, calc(${MAX_CROP_HEIGHT} * ${rotatedDimensions.width / rotatedDimensions.height}))`
    : undefined;

  return (
    <Modal
      onClose={onDismiss}
      // Dismissing throws away the pick and every adjustment, so it needs
      // a press the user meant, not a click that landed beside the panel.
      dismissOnBackdrop={false}
      dismissDisabled={isUploading || isCropping}
      panelClassName="max-w-[640px] shadow-2xl"
    >
      <ModalHeader>
        <ModalTitle className="text-lg font-semibold text-zinc-900">
          Adjust your photo
        </ModalTitle>
      </ModalHeader>

      <ModalBody>
        <div className="relative flex min-h-40 w-full items-center justify-center overflow-hidden rounded-xl bg-zinc-900 p-3">
          {(isPreviewProcessing || isCropping) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
              <Spinner />
            </div>
          )}
          {previewSrc ? (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => onCropChange(percentCrop)}
              aspect={1}
              minWidth={MIN_CROP_SIZE}
              minHeight={MIN_CROP_SIZE}
              keepSelection
              disabled={isUploading || isCropping}
              style={{ maxHeight: MAX_CROP_HEIGHT, width: cropWidth }}
            >
              <img
                ref={previewImageRef}
                src={previewSrc}
                alt="Profile to crop"
                className="w-full"
                onLoad={(event) => onPreviewLoad(event.currentTarget)}
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
              onClick={() => onRotate(RotationDirection.Left)}
              disabled={isPreviewProcessing || isUploading || isCropping}
            >
              <RotateCcw className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Rotate right"
              title="Rotate right"
              className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 disabled:hover:bg-transparent"
              onClick={() => onRotate(RotationDirection.Right)}
              disabled={isPreviewProcessing || isUploading || isCropping}
            >
              <RotateCw className="h-5 w-5" />
            </button>
          </div>
          <p className="hidden text-sm text-zinc-500 sm:block">
            Drag the corners or move the square to crop your picture.
          </p>
        </div>

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
      </ModalBody>

      <ModalFooter className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="font-medium text-green hover:opacity-80 disabled:opacity-40"
          onClick={onChooseAnother}
          disabled={isUploading || isCropping}
        >
          Choose another photo
        </button>
        <ModalActions>
          <Button
            onClick={onDismiss}
            disabled={isUploading || isCropping}
            color={ButtonColor.White}
          >
            Cancel
          </Button>
          <Button
            onClick={onApply}
            disabled={isUploading || isCropping || !isCropReady}
            color={ButtonColor.Black}
          >
            Done
          </Button>
        </ModalActions>
      </ModalFooter>
    </Modal>
  );
};

export default ImageCropModal;
