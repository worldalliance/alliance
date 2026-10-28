import { useState } from "react";
import { View } from "react-native";
import { formBlockedView, FormElements } from "./FormElements";
import { FormNavigation, ReadOnlyPageNavigation } from "./FormNavigation";
import { pageNavigation } from "./pageNavigation";
import {
  useMobileFormState,
  type MobileFormStateParams,
} from "./useMobileFormState";
import WithdrawalModal from "./WithdrawalModal";

type FormRendererProps = MobileFormStateParams & {
  publicAction?: boolean;
  disableOptionRandomization?: boolean;
  scrollPageTo: (y: number, animated?: boolean) => void;
  scrollToEnd: (animated?: boolean) => void;
};

const FormRenderer = ({
  disableOptionRandomization,
  scrollPageTo,
  scrollToEnd,
  ...stateParams
}: FormRendererProps) => {
  const { onSubmit, onAbandonAction } = stateParams;
  const form = useMobileFormState(stateParams);
  const {
    schema,
    readOnly,
    currentPageIndex,
    setCurrentPageIndex,
    visiblePageIndices,
    nextVisiblePageIndex,
    previousVisiblePageIndex,
    visibilitySettled,
    validatePage,
    imageUpload,
    submitting,
  } = form;
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const navigation = pageNavigation({
    currentPageIndex,
    setCurrentPageIndex,
    nextVisiblePageIndex,
    previousVisiblePageIndex,
    visibilitySettled,
    validatePage,
    scrollPageTo,
    scrollToEnd,
  });

  const handleSubmit = async () => {
    const { firstInvalidPageIndex } = await form.submit();
    navigation.showFirstInvalidPage(firstInvalidPageIndex);
  };

  const currentPage = visiblePageIndices.includes(currentPageIndex)
    ? schema.pages[currentPageIndex]
    : undefined;
  const isFirstPage = previousVisiblePageIndex === null;
  const isLastPage = nextVisiblePageIndex === null;
  const visiblePageCount = visiblePageIndices.length;
  const currentVisiblePageNumber = Math.max(
    1,
    visiblePageIndices.indexOf(currentPageIndex) + 1,
  );

  const blocked = formBlockedView(form);
  if (blocked !== null) return blocked;

  return (
    <View className="flex flex-col gap-y-8">
      <FormElements
        form={form}
        elements={currentPage?.fields ?? []}
        disableOptionRandomization={disableOptionRandomization}
      />

      {readOnly && visiblePageCount > 1 && (
        <ReadOnlyPageNavigation
          pageNumber={currentVisiblePageNumber}
          pageCount={visiblePageCount}
          onBack={isFirstPage ? null : navigation.goToPreviousPage}
          onNext={navigation.browseToNextPage}
        />
      )}
      {!readOnly && (
        <FormNavigation
          pageNumber={currentVisiblePageNumber}
          pageCount={visiblePageCount}
          onBack={isFirstPage ? null : navigation.goToPreviousPage}
          onPrimary={isLastPage ? handleSubmit : navigation.goToNextPage}
          isLastPage={isLastPage}
          preview={!onSubmit}
          submitting={submitting}
          primaryDisabled={
            submitting ||
            imageUpload.uploadingAny ||
            (!isLastPage && !visibilitySettled)
          }
          onWithdraw={onAbandonAction ? () => setWithdrawOpen(true) : null}
          uploadingImages={imageUpload.uploadingAny}
          onCancelUploads={imageUpload.cancelAll}
          saveFailed={form.saveFailed}
          hasFieldErrors={Object.keys(form.fieldErrors).length > 0}
        />
      )}

      {onAbandonAction && (
        <WithdrawalModal
          visible={withdrawOpen}
          onClose={() => setWithdrawOpen(false)}
          disabled={submitting}
          onWithdraw={(choice) => {
            form.handleAbandon(choice);
            setWithdrawOpen(false);
          }}
        />
      )}
    </View>
  );
};

export default FormRenderer;
