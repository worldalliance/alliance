import { ActionDto } from "../client/types.gen";
import { CardStyle } from "../styles/card";
import { deadlineHasPassed } from "./actionUtils";

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
  [ActionPageTaskPanelState.GuestCompleted]:
    ActionPageTaskPanelEnabled.Disabled,
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

/**
 * Onboarding actions stay locked until the member signs the contract — except
 * the contract-signing action itself. Single source for the action-page panel
 * state below and the large card's inline "sign the contract first" banner.
 */
export function mustSignContractFirst(
  action: Pick<ActionDto, "onboarding" | "isContractSigningAction">,
  contractSigned: boolean,
): boolean {
  return (
    action.onboarding && !contractSigned && !action.isContractSigningAction
  );
}

/**
 * The auth/guest branches at the top are genuinely client-side; everything
 * after them reads server-computed status — `viewer` when present, the
 * legacy flat fields otherwise (see the fallback note in `actionUtils.ts`).
 * Dismissal deliberately has no branch: it only hides the home-page card,
 * the action page renders as if it never happened.
 */
export function getActionPageTaskPanelState(params: {
  action: ActionDto;
  contractSigned: boolean;
  isAuthenticated: boolean;
  hasRefCode: boolean;
  hasGuestResponse: boolean;
}): ActionPageTaskPanelState {
  const {
    action,
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

  const canComplete = action.viewer
    ? action.viewer.canComplete
    : !!action.canParticipate;

  if (!canComplete && !action.preventCompletion)
    return ActionPageTaskPanelState.NotAssigned;

  if (mustSignContractFirst(action, contractSigned)) {
    return ActionPageTaskPanelState.OnboardingSignContractFirst;
  }

  const relation = action.viewer ? action.viewer.relation : action.userRelation;
  if (!relation) {
    return ActionPageTaskPanelState.MissingDataOrNotActive;
  }

  switch (relation) {
    case "completed":
      return ActionPageTaskPanelState.Completed;
    case "withdrawn":
    case "declined":
      return ActionPageTaskPanelState.Declined;
    case "dismissed":
    case "none":
      break;
    default:
      // Unknown variant from a newer server: degrade instead of crashing.
      relation satisfies never;
      return ActionPageTaskPanelState.MissingDataOrNotActive;
  }

  // Only reachable with preventCompletion (the NotAssigned check above
  // caught every other cannot-complete case).
  if (!canComplete) {
    return ActionPageTaskPanelState.MemberActionClosed;
  }

  if (deadlineHasPassed(action)) {
    return ActionPageTaskPanelState.ShowTaskWithMissedDeadline;
  }

  if (action.optional) {
    return ActionPageTaskPanelState.Optional;
  }

  return ActionPageTaskPanelState.ShowTask;
}
