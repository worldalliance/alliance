import {
  cancelAllImageUploads,
  draftSaveFailed,
  guestReferral,
  waitingForImageUpload,
} from "@alliance/shared/lib/copy";
import UploadingWithCancel from "@alliance/sharedweb/ui/UploadingWithCancel";
import React from "react";
import BaseButton, {
  BaseButtonSize,
  BaseButtonVariant,
} from "../ui/BaseButton";
import ConfettiWrapper from "../ui/ConfettiWrapper";

export default function FormNavigation({
  pageNumber,
  pageCount,
  onPrevious,
  onNext,
  nextDisabled,
  readOnly,
  createAccountHref,
  onSubmit,
  onPreviewSubmit,
  submitting,
  submitLabel,
  uploadingImages,
  onCancelUploads,
  saveFailed,
  children,
}: {
  pageNumber: number;
  pageCount: number;
  onPrevious: ((e: React.MouseEvent) => void) | null;
  /** `null` on the last page, which shows the submit button instead. */
  onNext: ((e: React.MouseEvent) => void) | null;
  nextDisabled: boolean;
  readOnly: boolean;
  createAccountHref?: string;
  /** `null` in preview, where the button only validates. */
  onSubmit: (() => Promise<boolean>) | null;
  onPreviewSubmit: () => void;
  submitting: boolean;
  submitLabel: string;
  uploadingImages: boolean;
  onCancelUploads: () => void;
  saveFailed: boolean;
  children?: React.ReactNode;
}) {
  const isLastPage = onNext === null;
  return (
    <div className="flex flex-row justify-between items-end gap-x-2">
      <div className="flex flex-col gap-y-4 flex-1">
        {pageCount > 1 && (
          <div className="flex items-center space-x-3">
            {onPrevious && (
              <BaseButton
                variant={BaseButtonVariant.LightHover}
                size={BaseButtonSize.MediumDynamic}
                onClick={onPrevious}
              >
                Previous
              </BaseButton>
            )}
            <div>
              <span className="text-zinc-500 whitespace-nowrap">
                Page {pageNumber} of {pageCount}
              </span>
            </div>
            {onNext && (
              <BaseButton
                variant={BaseButtonVariant.Black}
                size={BaseButtonSize.MediumDynamic}
                onClick={onNext}
                disabled={nextDisabled}
              >
                Next
              </BaseButton>
            )}
          </div>
        )}

        {isLastPage && (
          <>
            {readOnly ? null : onSubmit ? (
              <div className="w-full">
                {createAccountHref ? (
                  <a
                    href={createAccountHref}
                    className="flex w-full items-center justify-center rounded bg-green px-4 py-2 text-base font-medium text-white hover:bg-[#4d8c1d]"
                    style={{ fontWeight: 450 }}
                  >
                    {guestReferral.createAccountToSubmit}
                  </a>
                ) : (
                  <div className="w-full">
                    <ConfettiWrapper
                      burstPlacement="local"
                      onTrigger={onSubmit}
                      className="w-full"
                    >
                      {({
                        disabled: confettiDisabled,
                        onClick,
                        onKeyDown,
                        onPointerDown,
                      }) => (
                        <BaseButton
                          variant={BaseButtonVariant.Black}
                          className="w-full"
                          disabled={
                            submitting || confettiDisabled || uploadingImages
                          }
                          type="submit"
                          onClick={onClick}
                          onKeyDown={onKeyDown}
                          onPointerDown={onPointerDown}
                        >
                          {submitLabel}
                        </BaseButton>
                      )}
                    </ConfettiWrapper>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full">
                <BaseButton
                  variant={BaseButtonVariant.Black}
                  className="!cursor-not-allowed w-full"
                  disabled={uploadingImages}
                  onClick={onPreviewSubmit}
                >
                  {submitLabel}
                  {" (Preview Mode)"}
                </BaseButton>
              </div>
            )}
          </>
        )}
        {uploadingImages && !readOnly && (
          <UploadingWithCancel
            label={waitingForImageUpload}
            cancelLabel={cancelAllImageUploads}
            onCancel={onCancelUploads}
            className="text-zinc-500"
          />
        )}
        {saveFailed && !readOnly && (
          <p className="text-amber-600">{draftSaveFailed}</p>
        )}
      </div>

      {children}
    </div>
  );
}
