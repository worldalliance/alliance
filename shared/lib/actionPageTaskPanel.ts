import { ActionDto, UserActionRelation } from "../client/types.gen";
import { CardStyle } from "../styles/card";
import { getLatestEvent } from "./actionUtils";

export enum ActionPageTaskPanelState {
  PublicOnly = "public_only",
  PublicOnlyAuthenticated = "public_only_authenticated",
  NotAuthenticated = "not_authenticated",
  GuestRef = "guest_ref",
  GuestCompleted = "guest_completed",
  OnboardingSignContractFirst = "onboarding_sign_contract_first",
  NotAssigned = "not_assigned",
  Completed = "completed",
  Declined = "declined",
  MemberActionClosed = "member_action_closed",
  MissingDataOrNotActive = "missing_data_or_not_active",
  ShowTaskWithMissedDeadline = "show_task_with_missed_deadline",
  ShowTask = "show_task",
  Optional = "optional",
}

enum ActionPageTaskPanelEnabled {
  Disabled = "disabled",
  Enabled = "enabled",
}

const stateIsDisabled = {
  [ActionPageTaskPanelState.PublicOnlyAuthenticated]:
    ActionPageTaskPanelEnabled.Disabled,
  [ActionPageTaskPanelState.PublicOnly]: ActionPageTaskPanelEnabled.Enabled,
  [ActionPageTaskPanelState.NotAuthenticated]:
    ActionPageTaskPanelEnabled.Disabled,
  [ActionPageTaskPanelState.GuestRef]: ActionPageTaskPanelEnabled.Enabled,
  [ActionPageTaskPanelState.GuestCompleted]: ActionPageTaskPanelEnabled.Disabled,
  [ActionPageTaskPanelState.NotAssigned]: ActionPageTaskPanelEnabled.Disabled,
  [ActionPageTaskPanelState.Completed]: ActionPageTaskPanelEnabled.Disabled,
  [ActionPageTaskPanelState.Declined]: ActionPageTaskPanelEnabled.Disabled,
  [ActionPageTaskPanelState.MemberActionClosed]:
    ActionPageTaskPanelEnabled.Disabled,
  [ActionPageTaskPanelState.MissingDataOrNotActive]:
    ActionPageTaskPanelEnabled.Disabled,
  [ActionPageTaskPanelState.ShowTaskWithMissedDeadline]:
    ActionPageTaskPanelEnabled.Enabled,
  [ActionPageTaskPanelState.OnboardingSignContractFirst]:
    ActionPageTaskPanelEnabled.Disabled,
  [ActionPageTaskPanelState.Optional]: ActionPageTaskPanelEnabled.Enabled,
  [ActionPageTaskPanelState.ShowTask]: ActionPageTaskPanelEnabled.Enabled,
} as const satisfies Record<
  ActionPageTaskPanelState,
  ActionPageTaskPanelEnabled
>;

export function isFormDisabledByState(
  state: ActionPageTaskPanelState,
): boolean {
  return stateIsDisabled[state] === ActionPageTaskPanelEnabled.Disabled;
}

export const shouldLoadCompletedTaskFormByState = {
  [ActionPageTaskPanelState.PublicOnlyAuthenticated]: false,
  [ActionPageTaskPanelState.PublicOnly]: false,
  [ActionPageTaskPanelState.NotAuthenticated]: false,
  [ActionPageTaskPanelState.GuestRef]: false,
  [ActionPageTaskPanelState.GuestCompleted]: false,
  [ActionPageTaskPanelState.NotAssigned]: false,
  [ActionPageTaskPanelState.Completed]: true,
  [ActionPageTaskPanelState.Declined]: true,
  [ActionPageTaskPanelState.MemberActionClosed]: false,
  [ActionPageTaskPanelState.MissingDataOrNotActive]: false,
  [ActionPageTaskPanelState.ShowTaskWithMissedDeadline]: false,
  [ActionPageTaskPanelState.OnboardingSignContractFirst]: false,
  [ActionPageTaskPanelState.Optional]: false,
  [ActionPageTaskPanelState.ShowTask]: false,
} as const satisfies Record<ActionPageTaskPanelState, boolean>;

type HeaderBodyStyles = {
  header: CardStyle;
  body: CardStyle;
};
const cardStylesByDisabled = {
  [ActionPageTaskPanelEnabled.Enabled]: {
    header: CardStyle.LightGreyBorder,
    body: CardStyle.WhiteBorder,
  },
  [ActionPageTaskPanelEnabled.Disabled]: {
    header: CardStyle.WhiteBorder,
    body: CardStyle.LightGreyBorder,
  },
} as const satisfies Record<ActionPageTaskPanelEnabled, HeaderBodyStyles>;

export function cardStylesForState(
  state: ActionPageTaskPanelState,
): HeaderBodyStyles {
  return cardStylesByDisabled[stateIsDisabled[state]];
}

export function getActionPageTaskPanelState(params: {
  action: ActionDto;
  userRelation: UserActionRelation | null;
  contractSigned: boolean;
  isAuthenticated: boolean;
  hasRefCode: boolean;
  hasGuestResponse: boolean;
}): ActionPageTaskPanelState {
  const {
    action,
    userRelation,
    contractSigned,
    isAuthenticated,
    hasRefCode,
    hasGuestResponse,
  } = params;

  if (!isAuthenticated && hasGuestResponse) {
    return ActionPageTaskPanelState.GuestCompleted;
  }

  if (action.publicOnly) {
    return isAuthenticated
      ? ActionPageTaskPanelState.PublicOnlyAuthenticated
      : ActionPageTaskPanelState.PublicOnly;
  }

  if (!action.reqAuthenticated && !isAuthenticated) {
    return hasRefCode
      ? ActionPageTaskPanelState.GuestRef
      : ActionPageTaskPanelState.NotAuthenticated;
  }

  if (!action.canParticipate && !action.preventCompletion)
    return ActionPageTaskPanelState.NotAssigned;

  if (action.onboarding && !contractSigned && !action.isContractSigningAction) {
    return ActionPageTaskPanelState.OnboardingSignContractFirst;
  }

  if (
    !userRelation ||
    !action ||
    (!action.canParticipate && !action.preventCompletion)
  )
    return ActionPageTaskPanelState.MissingDataOrNotActive;

  if (userRelation === "completed") {
    return ActionPageTaskPanelState.Completed;
  } else if (userRelation === "declined") {
    return ActionPageTaskPanelState.Declined;
  }

  if (!action.canParticipate) {
    return ActionPageTaskPanelState.MemberActionClosed;
  }

  const latestEvent = getLatestEvent(action);
  const didMissDeadline =
    action.events.some((event) => event.newStatus === "member_action") &&
    (latestEvent?.newStatus === "office_action" ||
      latestEvent?.newStatus === "resolution");

  if (didMissDeadline) {
    return ActionPageTaskPanelState.ShowTaskWithMissedDeadline;
  }

  if (action.optional) {
    return ActionPageTaskPanelState.Optional;
  }

  return ActionPageTaskPanelState.ShowTask;
}
