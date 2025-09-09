import {
  FormDto,
  SubmitFormDto,
  tasksGetForm,
  tasksSubmitForm,
} from "@alliance/shared/client";
import FormRenderer, {
  computeFormStorageKey,
} from "@alliance/shared/forms/FormRenderer";
import { useEffect, useState } from "react";

interface ActionTaskPanelActivityProps {
  taskFormId: number;
  onCompleteAction: () => void;
  onFormStarted: () => void;
}

const ActionTaskPanelForm = ({
  taskFormId,
  onCompleteAction,
  onFormStarted,
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
          slug: form.schema.slug as string,
          version: form.schema.version as number,
          instanceId: taskFormId,
        });
        window.localStorage.removeItem(storageKey);
      }

      onCompleteAction();
    }
  };
  return (
    <div className="flex flex-col gap-y-2">
      <div>
        {form && (
          <FormRenderer
            form={form.schema}
            onSubmit={handleSubmitForm}
            persistKey={String(taskFormId)}
            onFormStarted={onFormStarted}
          />
        )}
      </div>
    </div>
  );
};

export default ActionTaskPanelForm;
