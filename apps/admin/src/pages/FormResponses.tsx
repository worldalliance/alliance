import {
  actionsShareLinksForFormAdmin,
  tasksGetForm,
  tasksGetFormResponsesAdmin,
  type FormResponseDto,
  type ProfileDto,
} from "@alliance/shared/client";
import { useFormWithdrawalsAdmin } from "@alliance/shared/lib/useFormWithdrawalsAdmin";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import FormResponsesView, {
  type FormWithSchema,
} from "../components/FormResponsesView";
import { sortResponsesByCreatedAtAsc } from "../lib/sortResponses";

const FormResponses: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();

  const [form, setForm] = useState<FormWithSchema | null>(null);
  const [responses, setResponses] = useState<FormResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sidsToUserMap, setSidsToUserMap] = useState<
    Record<string, ProfileDto>
  >({});

  const { numericFormId, isFormIdValid } = useMemo(() => {
    const numericFormId = Number(formId);
    const isFormIdValid = !Number.isNaN(numericFormId);
    return { numericFormId, isFormIdValid };
  }, [formId]);

  const { withdrawnUserMap } = useFormWithdrawalsAdmin(
    isFormIdValid ? numericFormId : undefined,
  );

  useEffect(() => {
    if (form) {
      actionsShareLinksForFormAdmin({ path: { formId: form.id } }).then(
        (res) => {
          setSidsToUserMap(
            Object.fromEntries(
              res.data?.flatMap((r) => (r.sid ? [[r.sid, r.user]] : [])) ?? [],
            ),
          );
        },
      );
    }
  }, [form]);

  const loadData = useCallback(async () => {
    if (!isFormIdValid) return;
    setLoading(true);
    setError(null);
    try {
      const [formRes, respRes] = await Promise.all([
        tasksGetForm({ path: { id: numericFormId } }),
        tasksGetFormResponsesAdmin({ path: { id: numericFormId } }),
      ]);

      const formData = formRes.data as unknown as FormWithSchema;
      setForm(formData);
      if (respRes.data) {
        setResponses(sortResponsesByCreatedAtAsc(respRes.data));
      }
    } catch (e) {
      console.error(e);
      setError("Failed to load form responses");
    } finally {
      setLoading(false);
    }
  }, [numericFormId, isFormIdValid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      onRefresh={loadData}
      withdrawnUserMap={withdrawnUserMap}
      sidsToUserMap={sidsToUserMap}
      exportFileBase={form?.title || `form-${form?.id ?? numericFormId}`}
      snapshotTargets={snapshotTargets}
    />
  );
};

export default FormResponses;
