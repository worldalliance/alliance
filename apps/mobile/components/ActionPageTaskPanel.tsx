import {
  ActionDto,
  UserActionRelation,
} from "@alliance/shared/client/types.gen";
import {
  ActionPageTaskPanelState,
  getActionPageTaskPanelState,
} from "@alliance/shared/lib/actionPageTaskPanel";
import ActionTaskPanel from "./ActionTaskPanel";
import Card, { CardStyle } from "./system/Card";
import Text from "./system/Text";
import {
  externalOnly,
  taskDeadlinePassed,
  taskDeadlinePassedDescription,
  taskNotAssigned,
} from "@alliance/shared/lib/copy";
import ActionTaskPanelDeclined from "./ActionTaskPanelDeclined";
import ActionTaskPanelCompleted from "./ActionTaskPanelCompleted";
import { View } from "react-native";

export interface ActionPageTaskPanelProps {
  action: ActionDto;
  userRelation: UserActionRelation | null;
  onCompleteAction: () => void;
  onJoinAction: () => void;
  onDeclineAction: () => void;
  onOptOutAction: () => void;
  scrollPageTo: (y: number) => void;
}

const ActionPageTaskPanel = ({
  action,
  userRelation,
  onCompleteAction,
  onJoinAction,
  onDeclineAction,
  onOptOutAction,
  scrollPageTo,
}: ActionPageTaskPanelProps) => {
  const state = getActionPageTaskPanelState(action, userRelation);

  const panelHandlers = {
    onCompleteAction,
    onJoinAction,
    onDeclineAction,
    onOptOutAction,
  };

  switch (state) {
    case ActionPageTaskPanelState.PublicOnly:
      //TODO: should always be authenticated in app
      return (
        <Card cardStyle={CardStyle.Grey}>
          <Text>{externalOnly}</Text>
        </Card>
      );
    case ActionPageTaskPanelState.NotAuthenticated:
      return (
        //TODO: should always be authenticated in app
        <Card cardStyle={CardStyle.Grey}>
          <Text>Error authenticating user - please try again.</Text>
        </Card>
      );
    case ActionPageTaskPanelState.NotAssigned:
      return <Card cardStyle={CardStyle.Grey}>{taskNotAssigned}</Card>;
    case ActionPageTaskPanelState.MissingDataOrNotActive:
      return null;
    case ActionPageTaskPanelState.Completed:
      return <ActionTaskPanelCompleted action={action} />;
    case ActionPageTaskPanelState.Declined:
      return <ActionTaskPanelDeclined />;
    case ActionPageTaskPanelState.MemberActionClosed:
      return null;
    case ActionPageTaskPanelState.ShowTaskWithMissedDeadline:
      return (
        <View>
          <Card cardStyle={CardStyle.Grey}>
            <Text className="font-medium">{taskDeadlinePassed}</Text>
            <Text>{taskDeadlinePassedDescription}</Text>
          </Card>
          <ActionTaskPanel
            action={action}
            userRelation={userRelation ?? "none"}
            scrollPageTo={scrollPageTo}
            {...panelHandlers}
          />
        </View>
      );
    case ActionPageTaskPanelState.ShowTask:
      return (
        <ActionTaskPanel
          action={action}
          scrollPageTo={scrollPageTo}
          userRelation={userRelation ?? "none"}
          {...panelHandlers}
        />
      );
    default:
      throw new Error(
        `Unknown action page task panel state: ${state satisfies never}`
      );
  }
};

export default ActionPageTaskPanel;
