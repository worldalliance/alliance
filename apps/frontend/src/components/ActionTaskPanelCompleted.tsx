import { ActionDto } from "@alliance/shared/client";
import FormRenderer from "@alliance/sharedweb/forms/FormRenderer";
import { FormSchema } from "@alliance/shared/forms/formschema";
import Card from "@alliance/sharedweb/ui/Card";
import CheckIcon from "@alliance/sharedweb/ui/icons/CheckIcon";
import { CardStyle } from "@alliance/shared/styles/card";
import { useCompletedTaskForm } from "@alliance/shared/lib/actionTaskPanelCompleted";
import ActionPageTaskPanelCardWrapper from "./ActionPageTaskPanelCardWrapper";

export interface ActionTaskPanelCompletedProps {
  action: ActionDto | null;
}

const ActionTaskPanelCompleted = ({
  action,
}: ActionTaskPanelCompletedProps) => {
  const formResponse = useCompletedTaskForm(action);

  const completedCard = (
    <div className="flex items-center gap-x-3">
      <CheckIcon size="small" />
      <p>You&apos;ve completed this task.</p>
    </div>
  );

  if (action?.taskFormId && formResponse) {
    return (
      <ActionPageTaskPanelCardWrapper
        taskPanelTop={completedCard}
        taskPanelTopStyle={CardStyle.WhiteBorder}
        taskPanel={
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
        }
        taskPanelStyle={CardStyle.GreyBorder}
      />
    );
  } else {
    return <Card style={CardStyle.White}>{completedCard}</Card>;
  }
};

export default ActionTaskPanelCompleted;
