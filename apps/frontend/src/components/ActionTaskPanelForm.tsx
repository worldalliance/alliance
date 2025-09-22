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
import { useEffect, useState } from "react";

interface ActionTaskPanelActivityProps {
  taskFormId: number;
  onCompleteAction: () => void;
  onFormStarted: () => void;
  onAbandonAction: (outOfTime: boolean, reason: string) => void;
  card?: boolean;
}

const ActionTaskPanelForm = ({
  taskFormId,
  onCompleteAction,
  onFormStarted,
  onAbandonAction,
  card = false,
}: ActionTaskPanelActivityProps) => {
  const [form, setForm] = useState<FormDto | null>(null);
  useEffect(() => {
    const fetchForm = async () => {
      const form = await tasksGetForm({
        path: { id: taskFormId },
      });
      if (!form.data) {
        throw new Error("Form not found");
      }
      setForm(form.data);
    };
    fetchForm();
  }, [taskFormId]);

  const handleSubmitForm = async (data: SubmitFormDto) => {
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

      onCompleteAction();
    }
  };
  return (
    <div
      className={`flex flex-col gap-y-2 ${
        card ? "p-6 border border-zinc-200" : ""
      }`}
    >
      <div>
        {form && (
          <FormRenderer
            form={form.schema as unknown as FormSchema}
            id={form.id}
            onSubmit={handleSubmitForm}
            persistKey={String(taskFormId)}
            onFormStarted={onFormStarted}
            onAbandonAction={onAbandonAction}
            renderFormAsCompleted={false}
          />
        )}
      </div>
    </div>
  );
};

export default ActionTaskPanelForm;
