import {
  cancelAllImageUploads,
  draftSaveFailed,
  guestReferral,
  waitingForImageUpload,
} from "@alliance/shared/lib/copy";
import UploadingWithCancel from "@alliance/sharedweb/ui/UploadingWithCancel";
import React, { useState } from "react";
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
  answers,
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
  onPreviewSubmit: () => Promise<{ isValid: boolean }>;
  /** The answers Preview's check reads; a pass holds only while they are the same. */
  answers: unknown;
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
              <PreviewSubmit
                label={submitLabel}
                disabled={uploadingImages}
                onCheck={onPreviewSubmit}
                answers={answers}
              />
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

/**
 * Preview's last button, which only checks the answers: an invalid one is
 * shown where it is, and a pass says so until the answers change.
 */
function PreviewSubmit({
  label,
  disabled,
  onCheck,
  answers,
}: {
  label: string;
  disabled: boolean;
  onCheck: () => Promise<{ isValid: boolean }>;
  answers: unknown;
}) {
  const [passedOn, setPassedOn] = useState<{ answers: unknown } | null>(null);
  const passed = passedOn !== null && passedOn.answers === answers;
  return (
    <div className="flex w-full flex-col gap-y-2">
      <BaseButton
        variant={BaseButtonVariant.Black}
        className="!cursor-not-allowed w-full"
        disabled={disabled}
        onClick={() => {
          void onCheck().then((result) =>
            setPassedOn(result.isValid ? { answers } : null),
          );
        }}
      >
        {label}
        {" (preview)"}
      </BaseButton>
      <p role="status" className="text-sm text-zinc-600">
        {passed &&
          "Every answer is valid. A member would submit here; in preview nothing is sent."}
      </p>
    </div>
  );
}
