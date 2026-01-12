import { ActionDto } from "@alliance/shared/client";
import Card, { CardStyle } from "./system/Card";
import Text from "./system/Text";
import { useCompletedTaskForm } from "@alliance/shared/lib/actionTaskPanelCompleted";
import FormRenderer from "./forms/FormRenderer";
import { FormSchema } from "@alliance/shared/forms/formschema";
import { View } from "react-native";
import { taskCompleted } from "@alliance/shared/lib/copy";
import { Check } from "lucide-react-native";

export interface ActionTaskPanelCompletedProps {
  action: ActionDto | null;
}
const ActionTaskPanelCompleted = ({
  action,
}: ActionTaskPanelCompletedProps) => {
  const formResponse = useCompletedTaskForm(action);

  const completedCard = (
    <Card
      cardStyle={CardStyle.White}
      className="border rounded-b-none rounded-sm"
    >
      <View className="flex-row items-center gap-x-2 max-w-[100vw]">
        <View className="w-6 h-6 rounded-full bg-green items-center justify-center">
          <Check size={16} color="#fff" strokeWidth={3} />
        </View>
        <Text>{taskCompleted}</Text>
      </View>
    </Card>
  );

  if (action?.taskFormId && formResponse) {
    return (
      <View>
        {completedCard}
        <Card
          cardStyle={CardStyle.Grey}
          className="p-3 space-y-4 border-none rounded-t-none"
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
      </View>
    );
  } else {
    return completedCard;
  }
};

export default ActionTaskPanelCompleted;
