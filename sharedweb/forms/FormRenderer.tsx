import { computeFormStorageKey } from "@alliance/shared/forms/formDrafts";
import { taskFlow } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import React from "react";
import { formBlockedView, FormElements } from "./FormElements";
import FormNavigation from "./FormNavigation";
import { useWebFormState, type WebFormStateParams } from "./useWebFormState";
import WithdrawalMenu from "./WithdrawalMenu";

type FormRendererProps = WebFormStateParams & {
  publicAction?: boolean;
  createAccountHref?: string;
  disableOptionRandomization?: boolean;
  followUp?: boolean;
  fieldLabelRightContent?: Record<string, React.ReactNode>;
  /** For staff: a neutral title and what blocks the form, in place of member advice. */
  showDetail?: boolean;
  /** An unsaved schema, so a formula error is the author's, not a sign of an old build. */
  draft?: boolean;
};

export { computeFormStorageKey };

const FormRenderer = ({
  publicAction,
  createAccountHref,
  disableOptionRandomization,
  followUp,
  fieldLabelRightContent,
  showDetail,
  draft,
  ...stateParams
}: FormRendererProps) => {
  const { onSubmit, onAbandonAction } = stateParams;
  const form = useWebFormState(stateParams);
  const {
    schema,
    readOnly,
    currentPageIndex,
    visiblePageIndices,
    nextVisiblePageIndex,
    previousVisiblePageIndex,
    visibilitySettled,
    imageUpload,
    submitting,
  } = form;
  const { uploadingAny } = imageUpload;

  const currentPage =
    currentPageIndex < schema.pages.length &&
    visiblePageIndices.includes(currentPageIndex)
      ? schema.pages[currentPageIndex]
      : null;
  const isLastPage = nextVisiblePageIndex === null;
  const isFirstPage = previousVisiblePageIndex === null;

  const blocked = formBlockedView(form, { showDetail, draft });
  if (blocked !== null) return blocked;

  return (
    <div ref={form.formTopRef} className="mx-auto scroll-mt-24">
      <form
        ref={form.formRef}
        onSubmit={form.handleSubmit}
        noValidate
        className="space-y-6"
      >
        {/* Page Content */}
        <div
          className={cn(
            "space-y-6",
            readOnly && schema.pages.length === 1 && "mb-0",
          )}
        >
          {currentPage !== null && (
            <FormElements
              form={form}
              elements={currentPage.fields}
              disableOptionRandomization={disableOptionRandomization}
              fieldLabelRightContent={fieldLabelRightContent}
            />
          )}
        </div>
        <FormNavigation
          pageNumber={Math.max(
            1,
            visiblePageIndices.indexOf(currentPageIndex) + 1,
          )}
          pageCount={visiblePageIndices.length}
          onPrevious={isFirstPage ? null : form.handlePrevious}
          onNext={isLastPage ? null : form.handleNext}
          nextDisabled={uploadingAny || !visibilitySettled}
          readOnly={readOnly}
          createAccountHref={createAccountHref}
          onSubmit={onSubmit ? form.submitCurrentPage : null}
          onPreviewSubmit={form.validateAllPagesAndShowFirstInvalid}
          answers={form.effectiveFormData}
          submitting={submitting}
          submitLabel={
            schema.submit?.label || (followUp ? "Submit" : taskFlow.submit)
          }
          uploadingImages={uploadingAny}
          onCancelUploads={imageUpload.cancelAll}
          saveFailed={form.saveFailed}
        >
          {onAbandonAction && !readOnly && !publicAction && !followUp && (
            <WithdrawalMenu
              disabled={submitting}
              onWithdraw={form.handleAbandon}
            />
          )}
        </FormNavigation>
      </form>
    </div>
  );
};

export default FormRenderer;
