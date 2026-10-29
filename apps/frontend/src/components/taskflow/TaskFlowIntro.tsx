import { type PageItem } from "@alliance/common/forms/form-schema";
import { type ActionDto } from "@alliance/shared/client";
import { splitBackground } from "@alliance/shared/forms/flowScreens";
import {
  taskFlowContributors,
  type ActionWithdrawal,
} from "@alliance/shared/lib/actionTaskPanel";
import { taskFlow, withdrawFromAction } from "@alliance/shared/lib/copy";
import { FormElements } from "@alliance/sharedweb/forms/FormElements";
import { type WebFormState } from "@alliance/sharedweb/forms/useWebFormState";
import WithdrawalMenu from "@alliance/sharedweb/forms/WithdrawalMenu";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { Ellipsis } from "lucide-react";
import FlowButton, { FlowButtonKind } from "./FlowButton";
import { TaskFlowPage, TaskFlowTitle } from "./TaskFlowScreen";

export default function TaskFlowIntro({
  action,
  form,
  background,
  onClose,
  onWithdraw,
  onNext,
  isLast,
  error,
}: {
  action: ActionDto;
  form: WebFormState;
  /** The form's opening content, which asks for nothing. */
  background: PageItem[];
  onClose: () => void;
  onWithdraw:
    | ((withdrawal: Omit<ActionWithdrawal, "partialFormData">) => void)
    | null;
  onNext: () => void;
  /** No question screen follows, so Next submits. */
  isLast: boolean;
  error: string | null;
}) {
  const { media, reading } = splitBackground(background);
  const contributors = taskFlowContributors(action);

  return (
    <TaskFlowPage
      onClose={onClose}
      closeDisabled={form.submitting}
      headerEnd={
        onWithdraw ? (
          <WithdrawalMenu
            disabled={form.submitting}
            onWithdraw={onWithdraw}
            renderTrigger={(toggle) => (
              <FlowButton
                kind={FlowButtonKind.Icon}
                onClick={toggle}
                aria-label={withdrawFromAction}
              >
                <Ellipsis size={20} aria-hidden />
              </FlowButton>
            )}
          />
        ) : null
      }
      footer={
        <>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          <FlowButton
            kind={FlowButtonKind.Primary}
            className="w-full"
            loading={form.submitting}
            onClick={onNext}
          >
            {isLast ? taskFlow.submit : taskFlow.next}
          </FlowButton>
        </>
      }
    >
      <TaskFlowTitle>{taskFlow.background}</TaskFlowTitle>

      {contributors.length > 0 ? (
        <ul className="mb-6 flex flex-col gap-y-3">
          {contributors.map((contributor) => (
            <li key={contributor.key} className="flex items-center gap-x-3">
              <AvatarProfile
                pfp={contributor.picture}
                size="medium"
                alt={contributor.name}
              />
              <div>
                <p className="text-base text-zinc-900">{contributor.name}</p>
                <p className="text-sm text-zinc-500">{contributor.role}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {media.length > 0 ? (
        <div className="mb-6 space-y-6">
          <FormElements form={form} elements={media} />
        </div>
      ) : null}

      <div className="space-y-6">
        <FormElements form={form} elements={reading} />
      </div>
    </TaskFlowPage>
  );
}
