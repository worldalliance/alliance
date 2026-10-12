import { useFormWithdrawalsAdmin } from "@alliance/shared/lib/useFormWithdrawalsAdmin";
import React, { useMemo } from "react";
import { useParams } from "react-router";
import FormResponsesView from "../components/FormResponsesView";
import { useFormResponsesAdmin } from "../lib/useFormResponsesAdmin";
import { useRefusalToast } from "../lib/useRefusalToast";

const FormResponses: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();

  const { numericFormId, isFormIdValid } = useMemo(() => {
    const numericFormId = Number(formId);
    const isFormIdValid = !Number.isNaN(numericFormId);
    return { numericFormId, isFormIdValid };
  }, [formId]);

  const { withdrawnUserMap } = useFormWithdrawalsAdmin(
    isFormIdValid ? numericFormId : undefined,
  );

  const { form, responses, sidsToUserMap, loading, error, refresh } =
    useFormResponsesAdmin(isFormIdValid ? numericFormId : undefined);
  const refusalToast = useRefusalToast();

  // Memoised for its identity, not its cost: `FormResponsesView` keys a memo
  // and an effect off this array, and a fresh literal each render re-runs both.
  const snapshotTargets = useMemo(
    () =>
      isFormIdValid
        ? [{ formId: numericFormId, name: form?.title ?? "This form" }]
        : undefined,
    [isFormIdValid, numericFormId, form?.title],
  );

  return (
    <FormResponsesView
      title={form?.title ?? "Form Responses"}
      form={form}
      responses={responses}
      loading={loading}
      error={error}
      onRefresh={() =>
        refresh.mutate(undefined, {
          onError: (e) => refusalToast(e, "Failed to refresh form responses"),
        })
      }
      withdrawnUserMap={withdrawnUserMap}
      sidsToUserMap={sidsToUserMap}
      exportFileBase={form?.title || `form-${form?.id ?? numericFormId}`}
      snapshotTargets={snapshotTargets}
    />
  );
};

export default FormResponses;
