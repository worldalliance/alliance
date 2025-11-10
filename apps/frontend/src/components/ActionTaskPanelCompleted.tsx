import {
  ActionDto,
  FormResponseDto,
  tasksGetMyFormResponse,
} from "@alliance/shared/client";
import FormRenderer from "@alliance/shared/forms/FormRenderer";
import { FormSchema } from "@alliance/shared/forms/formschema";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import { useEffect, useState } from "react";
import CheckIcon from "@alliance/shared/ui/icons/CheckIcon";

export interface ActionTaskPanelCompletedProps {
  action: ActionDto | null;
}

const ActionTaskPanelCompleted = ({
  action,
}: ActionTaskPanelCompletedProps) => {
  const [formResponse, setFormResponse] = useState<FormResponseDto | null>(
    null
  );

  useEffect(() => {
    if (action?.taskFormId) {
      const fetchFormAndResponse = async (id: number) => {
        const formResponse = await tasksGetMyFormResponse({
          path: { id },
        });
        if (formResponse.data) {
          setFormResponse(formResponse.data);
        }
      };
      fetchFormAndResponse(action.taskFormId);
    }
  }, [action]);

  console.log("formResponse", formResponse);

  const completedCard = (
    <Card style={CardStyle.White} className="mb-2">
      <div className="flex items-center gap-x-3">
        <CheckIcon size="small" />
        <p>You&apos;ve completed this task.</p>
      </div>
    </Card>
  );

  if (action?.taskFormId && formResponse) {
    return (
      <>
        {completedCard}
        <Card
          style={CardStyle.Grey}
          className="inline-block !p-6 space-y-4 border-none -mt-3 rounded-t-none"
        >
          <FormRenderer
            form={formResponse.schemaSnapshot as unknown as FormSchema}
            id={formResponse.formId}
            actionId={action.id}
            completedFormResponse={formResponse}
            renderFormAsCompleted
            onSubmit={null}
            userId={formResponse.user?.id}
            user={formResponse.user ?? undefined}
          />
        </Card>
      </>
    );
  } else {
    return completedCard;
  }
};

export default ActionTaskPanelCompleted;
