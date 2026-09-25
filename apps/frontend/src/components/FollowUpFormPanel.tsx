import { FormSchema } from "@alliance/common/forms/form-schema";
import { FormDto, tasksGetForm } from "@alliance/shared/client";
import type {
  FollowUpFormDto,
  SubmitFormDto,
} from "@alliance/shared/client/types.gen";
import {
  followUpDraftStorageKey,
  followUpFormIntro,
  followUpPersistKey,
  submitFollowUpForm,
} from "@alliance/shared/lib/followUpForm";
import { CardStyle } from "@alliance/shared/styles/card";
import FormRenderer from "@alliance/sharedweb/forms/FormRenderer";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import Card from "@alliance/sharedweb/ui/Card";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import posthog from "posthog-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/AuthContext";

interface FollowUpFormPanelProps {
  followUpForm: FollowUpFormDto;
  actionId: number;
  border?: boolean;
  onSubmitted?: () => void;
}

export default function FollowUpFormPanel({
  followUpForm,
  actionId,
  border = false,
  onSubmitted,
}: FollowUpFormPanelProps) {
  const [form, setForm] = useState<FormDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formInstanceKey, setFormInstanceKey] = useState(0);
  const { user } = useAuth();
  const { success } = useToast();

  useEffect(() => {
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
  }, [followUpForm.formId]);

  const handleSubmit = useCallback(
    async (data: SubmitFormDto): Promise<boolean> => {
      setError(null);
      const submitted = await submitFollowUpForm({
        followUpFormId: followUpForm.id,
        actionId,
        data,
      });
      if (!submitted.ok) {
        setError("Failed to submit. Please try again.");
        return false;
      }
      if (form) {
        window.localStorage.removeItem(
          followUpDraftStorageKey({
            formId: form.id,
            followUpFormId: followUpForm.id,
          }),
        );
      }
      success("Response submitted!");
      setFormInstanceKey((k) => k + 1);
      onSubmitted?.();
      return true;
    },
    [followUpForm.id, form, actionId, onSubmitted, success],
  );

  const { distinctId, sessionReplayUrl } = useMemo(
    () => ({
      distinctId: posthog.get_distinct_id(),
      sessionReplayUrl: posthog.get_session_replay_url(),
    }),
    [],
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

  const intro = followUpFormIntro(followUpForm, form.title);

  return (
    <Card
      style={border ? CardStyle.WhiteBorder : CardStyle.White}
      className="p-4 sm:p-6"
    >
      {intro.shown && (
        <Card style={CardStyle.Alert} className="mb-3 border-none rounded-md">
          <p className="font-semibold">{intro.title}</p>
          {intro.hasInstructions && (
            <div className="mt-1">
              <AppMarkdownWrapper
                markdownContent={followUpForm.instructions ?? ""}
              />
            </div>
          )}
        </Card>
      )}
      <div className="w-full">
        <FormRenderer
          key={formInstanceKey}
          form={form.schema as unknown as FormSchema}
          id={form.id}
          formSnapshotId={form.formSnapshotId}
          actionId={actionId}
          onSubmit={handleSubmit}
          persistKey={followUpPersistKey(followUpForm.id)}
          userId={user?.id}
          user={user}
          loadCurrentUserLocation={!!user}
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
          style={border ? CardStyle.WhiteBorder : CardStyle.White}
          className="mt-4 border-red-400! bg-red-50!"
        >
          <div className="text-red-500">{error}</div>
        </Card>
      )}
    </Card>
  );
}
