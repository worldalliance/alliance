import { AnalyticsEvent } from "@alliance/common/analytics";
import type { FormSchema } from "@alliance/common/forms/form-schema";
import {
  FormResponseDto,
  SubmitFormDto,
  UserActionRelation,
} from "@alliance/shared/client";
import {
  ActionTaskPanelPropsShared,
  useTaskFormHandlers,
} from "@alliance/shared/lib/actionTaskPanel";
import { canCompleteAction } from "@alliance/shared/lib/actionUtils";
import { captureEvent } from "@alliance/shared/lib/analytics";
import FormRenderer from "@alliance/sharedweb/forms/FormRenderer";
import { useCallback, useMemo, type RefObject } from "react";
import ActionTaskPanelActivity from "./ActionTaskPanelActivity";
import ActionTaskPanelForm from "./ActionTaskPanelForm";

export type ActionTaskPanelProps = ActionTaskPanelPropsShared & {
  userRelation: UserActionRelation;
  missedDeadline?: boolean;
  card?: boolean;
  redirectOnComplete?: boolean;
  onFormSubmitted?: (formResponse: FormResponseDto) => void;
  createAccountHref?: string;
  forceRenderTask?: boolean;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  staticTaskFormSchema?: FormSchema;
  staticTaskInitialPageIndex?: number;
};

const ActionTaskPanel: React.FC<ActionTaskPanelProps> = ({
  action,
  onCompleteAction,
  onOptOutAction,
  card = false,
  disabled = false,
  formResponse,
  guestMode = false,
  redirectOnComplete,
  onFormSubmitted,
  createAccountHref,
  forceRenderTask = false,
  scrollContainerRef,
  staticTaskFormSchema,
  staticTaskInitialPageIndex,
}: ActionTaskPanelProps) => {
  const handleCompleteAction = useCallback(async () => {
    const didSucceed = await onCompleteAction();
    if (didSucceed === false) {
      return false;
    }
    return true;
  }, [onCompleteAction]);

  const handleFormStarted = useCallback(() => {
    captureEvent(AnalyticsEvent.FormStarted, {
      actionId: action.id,
      actionType: action.type,
      actionName: action.name,
    });
  }, [action]);

  const { handleCompleteWithTracking, actionError, handleAbandonAction } =
    useTaskFormHandlers({
      action,
      onCompleteAction: handleCompleteAction,
      onOptOutAction,
      guestMode,
    });

  // Contract signing actions cannot be withdrawn from.
  const onAbandonAction = action.isContractSigningAction
    ? undefined
    : handleAbandonAction;

  const handleStaticSubmit = useCallback(
    async (_data: SubmitFormDto): Promise<boolean> => {
      const didSucceed = await handleCompleteAction();
      return didSucceed !== false;
    },
    [handleCompleteAction],
  );

  const errorMessageNode = useMemo(() => {
    if (!actionError) {
      return null;
    }
    return (
      <p className="mt-2 text-sm text-red-600" role="alert">
        {actionError}
      </p>
    );
  }, [actionError]);

  if ((disabled || formResponse) && action.taskFormId !== undefined) {
    return (
      <ActionTaskPanelForm
        taskFormId={action.taskFormId}
        onCompleteAction={null}
        onFormStarted={handleFormStarted}
        onAbandonAction={onAbandonAction}
        card={card}
        actionId={action.id}
        disabled={true}
        formResponse={formResponse}
        onSubmitted={onFormSubmitted}
      />
    );
  }

  const canSubmit = canCompleteAction(action) || forceRenderTask;

  let completionElement = null;
  if (staticTaskFormSchema) {
    completionElement = (
      <FormRenderer
        form={staticTaskFormSchema}
        id={action.taskFormId ?? action.id}
        formSnapshotId={0}
        actionId={action.id}
        onSubmit={canSubmit ? handleStaticSubmit : null}
        onFormStarted={handleFormStarted}
        renderFormAsCompleted={disabled || !canSubmit}
        scrollContainerRef={scrollContainerRef}
        initialPageIndex={staticTaskInitialPageIndex}
      />
    );
  }
  if (!completionElement && action.type === "Activity" && action.taskFormId) {
    completionElement = (
      <ActionTaskPanelForm
        publicAction={action.publicOnly || guestMode}
        taskFormId={action.taskFormId}
        onCompleteAction={canSubmit ? handleCompleteWithTracking : null}
        onFormStarted={handleFormStarted}
        onAbandonAction={onAbandonAction}
        card={card}
        actionId={action.id}
        redirectOnComplete={redirectOnComplete}
        onSubmitted={onFormSubmitted}
        scrollContainerRef={scrollContainerRef}
        disabled={disabled || !canSubmit}
      />
    );
  }
  if (!completionElement && action.type === "Activity" && !action.taskFormId) {
    completionElement = <p>Couldn&apos;t load action contents</p>;
  }
  if (
    !completionElement &&
    action.type === "Ongoing" &&
    (canSubmit || forceRenderTask)
  ) {
    completionElement = (
      <ActionTaskPanelActivity
        action={action}
        onCompleteAction={handleCompleteWithTracking}
        disabled={disabled || !canSubmit}
        createAccountHref={guestMode ? createAccountHref : undefined}
      />
    );
  }
  if (completionElement) {
    return (
      <>
        {completionElement}
        {errorMessageNode}
      </>
    );
  }

  if (action.status === "draft") {
    return (
      <>
        {action.taskFormId && (
          <ActionTaskPanelForm
            taskFormId={action.taskFormId}
            onCompleteAction={null}
            onFormStarted={handleFormStarted}
            onAbandonAction={onAbandonAction}
            card={card}
            actionId={action.id}
            previewMode
          />
        )}
        {errorMessageNode}
      </>
    );
  }

  return errorMessageNode;
};

export default ActionTaskPanel;
