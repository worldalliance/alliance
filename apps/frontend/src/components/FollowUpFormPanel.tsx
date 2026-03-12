import {
  FormDto,
  tasksGetForm,
  tasksSubmitFollowUpForm,
} from "@alliance/shared/client";
import type {
  SubmitFormDto,
  SubmitFollowUpFormDto,
} from "@alliance/shared/client/types.gen";
import FormRenderer, {
  computeFormStorageKey,
} from "@alliance/sharedweb/forms/FormRenderer";
import { FormSchema } from "@alliance/shared/forms/formschema";
import Card from "@alliance/sharedweb/ui/Card";
import posthog from "posthog-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { CardStyle } from "@alliance/shared/styles/card";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";

/** Follow-up form as returned from action (may include form from API). */
type FollowUpFormWithForm = {
  id: number;
  formId: number;
  name?: string;
  startDate?: string;
  endDate?: string;
  actionId: number;
  form?: FormDto;
};

interface FollowUpFormPanelProps {
  followUpForm: FollowUpFormWithForm;
  actionId: number;
  onSubmitted?: () => void;
}

export default function FollowUpFormPanel({
  followUpForm,
  actionId,
  onSubmitted,
}: FollowUpFormPanelProps) {
  const [form, setForm] = useState<FormDto | null>(followUpForm.form ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!followUpForm.form);
  const [formInstanceKey, setFormInstanceKey] = useState(0);
  const { user } = useAuth();
  const { success } = useToast();

  useEffect(() => {
    if (followUpForm.form) {
      setForm(followUpForm.form);
      setLoading(false);
      return;
    }
    const fetchForm = async () => {
      const res = await tasksGetForm({
        path: { id: followUpForm.formId },
      });
      setLoading(false);
      if (!res.data) {
        setError("Unable to load form – please reload");
        return;
      }
      setForm(res.data);
    };
    fetchForm();
  }, [followUpForm.form, followUpForm.formId]);

  const handleSubmit = useCallback(
    async (data: SubmitFormDto) => {
      setError(null);
      const body: SubmitFollowUpFormDto = {
        answers: data.answers,
        schemaSnapshot: data.schemaSnapshot,
        visibilityValidatorResults: data.visibilityValidatorResults,
        deviceType: data.deviceType,
        publicAnswers: data.publicAnswers,
        phDistinctId: data.phDistinctId,
        sessionReplayUrl: data.sessionReplayUrl,
        sid: data.sid,
      };
      const response = await tasksSubmitFollowUpForm({
        path: { followUpFormId: followUpForm.id },
        body,
      });
      if (response.response.ok) {
        if (form) {
          const storageKey = computeFormStorageKey({
            formId: form.id,
            instanceId: `follow-up-${followUpForm.id}`,
          });
          window.localStorage.removeItem(storageKey);
        }
        success("Response submitted!");
        setFormInstanceKey((k) => k + 1);
        onSubmitted?.();
      } else {
        console.error(response.error);
        posthog.captureException(response.error, {
          event: "follow_up_form_submit_error",
          properties: { actionId, followUpFormId: followUpForm.id },
        });
        setError("Failed to submit. Please try again.");
      }
    },
    [followUpForm.id, form, actionId, onSubmitted, success]
  );

  const { distinctId, sessionReplayUrl } = useMemo(
    () => ({
      distinctId: posthog.get_distinct_id(),
      sessionReplayUrl: posthog.get_session_replay_url(),
    }),
    []
  );

  if (loading || !form) {
    return (
      <div className="flex flex-col justify-center items-center p-6 border border-zinc-200 rounded-md">
        {loading ? (
          <Spinner />
        ) : (
          <p className="text-red-500">{error ?? "Error loading form"}</p>
        )}
      </div>
    );
  }

  const formTitle = followUpForm.name ?? form.title;

  return (
    <Card style={CardStyle.White} className="p-4 sm:p-6">
      {formTitle && <p className="text-title text-2xl! mb-4">{formTitle}</p>}
      <div className="w-full">
        <FormRenderer
          key={formInstanceKey}
          form={form.schema as unknown as FormSchema}
          id={form.id}
          actionId={actionId}
          onSubmit={handleSubmit}
          persistKey={`follow-up-${followUpForm.id}`}
          userId={user?.id}
          user={user}
          onFormStarted={() => {}}
          renderFormAsCompleted={false}
          publicAction={false}
          followUp
          phDistinctId={distinctId}
          sessionReplayUrl={sessionReplayUrl}
        />
      </div>
      {error && (
        <Card
          style={CardStyle.White}
          className="mt-4 !border-red-400 !bg-red-50"
        >
          <div className="text-red-500">{error}</div>
        </Card>
      )}
    </Card>
  );
}
