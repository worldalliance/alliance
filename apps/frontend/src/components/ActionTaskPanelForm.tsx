import {
  FormDto,
  SubmitFormDto,
  tasksGetForm,
  tasksSubmitForm,
} from "@alliance/shared/client";
import FormRenderer, {
  computeFormStorageKey,
} from "@alliance/shared/forms/FormRenderer";
import { FormSchema } from "@alliance/shared/forms/formschema";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import Spinner from "./Spinner";

interface ActionTaskPanelActivityProps {
  taskFormId: number;
  onCompleteAction: ((sendComplete: boolean) => void) | null;
  onFormStarted: () => void;
  onAbandonAction: (outOfTime: boolean, reason: string) => void;
  card?: boolean;
  actionId: number;
}

const ActionTaskPanelForm = ({
  taskFormId,
  onCompleteAction,
  onFormStarted,
  onAbandonAction,
  card = false,
  actionId,
}: ActionTaskPanelActivityProps) => {
  const [form, setForm] = useState<FormDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchForm = async () => {
      const form = await tasksGetForm({
        path: { id: taskFormId },
      });
      setLoading(false);
      if (!form.data) {
        setError("Unable to load form - please reload");
        throw new Error((form.error as Error).message);
      }
      setForm(form.data);
    };
    fetchForm();
  }, [taskFormId]);

  const handleSubmitForm = onCompleteAction
    ? async (data: SubmitFormDto) => {
        setError(null);

        const response = await tasksSubmitForm({
          path: { id: taskFormId },
          body: data,
        });
        if (response.response.ok) {
          if (typeof window !== "undefined" && form) {
            const storageKey = computeFormStorageKey({
              formId: form.id,
              instanceId: taskFormId,
            });
            window.localStorage.removeItem(storageKey);
          }
          onCompleteAction(false); //tasksSubmitForm handles completion here
        } else {
          console.error(response.error);
          posthog.captureException(response.error, {
            event: "form_submit_error",
            properties: {
              actionId: actionId,
              $exception_fingerprint: "FormSubmitError",
            },
          });
          setError(
            "Failed to submit action. We have been notified of the problem and will take a look. You can also try again later."
          );
        }
      }
    : null;

  if (!form) {
    if (loading) {
      return (
        <div
          className={`flex flex-col justify-center items-center ${
            card ? "p-6 border border-zinc-200" : ""
          }`}
        >
          <Spinner />
        </div>
      );
    } else {
      return (
        <div
          className={`flex flex-col justify-center items-center text-red-500 ${
            card ? "p-6 border border-zinc-200" : ""
          }`}
        >
          <p>Error loading form</p>
          {error && <p>{error}</p>}
        </div>
      );
    }
  }

  const Wrapper = card ? Card : "div";

  return (
    <Wrapper className={!card ? "flex flex-col gap-y-2" : "p-4 sm:p-6"}>
      <div>
        <FormRenderer
          form={form.schema as unknown as FormSchema}
          id={form.id}
          actionId={actionId}
          onSubmit={handleSubmitForm}
          persistKey={String(taskFormId)}
          userId={user?.id}
          user={user}
          onFormStarted={onFormStarted}
          onAbandonAction={onAbandonAction}
          renderFormAsCompleted={false}
        />
      </div>
      {error && (
        <Card style={CardStyle.White} className="!border-red-400 !bg-red-50">
          <div className="text-red-500">{error}</div>
        </Card>
      )}
    </Wrapper>
  );
};

export default ActionTaskPanelForm;
