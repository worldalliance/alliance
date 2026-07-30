import {
  actionsGetWithdrawalsAdmin,
  actionsShareLinksForFormAdmin,
  tasksGetForm,
  tasksGetFormResponsesAdmin,
  type ActionWithdrawalDto,
  type FormResponseDto,
  type ProfileDto,
} from "@alliance/shared/client";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import FormResponsesView, {
  sortResponsesByCreatedAtAsc,
  type FormWithSchema,
} from "../components/FormResponsesView";

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

  const { data: withdrawnUserMap = new Map<number, ActionWithdrawalDto>() } =
    useQuery({
      queryKey: ["actionsGetWithdrawalsAdmin", numericFormId],
      queryFn: async () => {
        const res = await actionsGetWithdrawalsAdmin({
          path: { formId: numericFormId },
        });
        const map = new Map<number, ActionWithdrawalDto>();
        for (const withdrawal of res.data ?? []) {
          map.set(withdrawal.userId, withdrawal);
        }
        return map;
      },
      enabled: isFormIdValid,
    });

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
      snapshotsFormId={isFormIdValid ? numericFormId : null}
    />
  );
};

export default FormResponses;
