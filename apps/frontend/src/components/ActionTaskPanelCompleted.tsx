import {
  ActionDto,
  FormResponseDto,
  tasksGetMyFormResponse,
} from "@alliance/shared/client";
import FormRenderer from "@alliance/shared/forms/FormRenderer";
import { FormSchema } from "@alliance/shared/forms/formschema";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import { useEffect, useState } from "react";

export interface ActionTaskPanelCompletedProps {
  action: ActionDto;
}

const ActionTaskPanelCompleted = ({
  action,
}: ActionTaskPanelCompletedProps) => {
  const [formResponse, setFormResponse] = useState<FormResponseDto | null>(
    null
  );

  useEffect(() => {
    if (action.taskFormId) {
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
  }, [action.taskFormId]);

  console.log("formResponse", formResponse);

  if (action.taskFormId && formResponse) {
    return (
      <Card style={CardStyle.Grey} className="inline-block !p-6">
        <Card style={CardStyle.Green} className="border-none mb-4 bg-green/30">
          You&apos;ve completed this action! Thank you for your help.
        </Card>
        <FormRenderer
          form={formResponse.schemaSnapshot as unknown as FormSchema}
          id={formResponse.formId}
          completedFormResponse={formResponse}
          renderFormAsCompleted
          onSubmit={null}
        />
      </Card>
    );
  } else {
    return (
      <Card style={CardStyle.Green}>
        <p className="">
          You&apos;ve completed this action! Thank you for your help.
        </p>
      </Card>
    );
  }
};

export default ActionTaskPanelCompleted;
