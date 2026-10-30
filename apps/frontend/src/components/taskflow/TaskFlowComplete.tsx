import {
  type FormSchema,
  type FormValue,
} from "@alliance/common/forms/form-schema";
import { type UserDto } from "@alliance/shared/client";
import { taskFlow } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import { ModalTitle } from "@alliance/sharedweb/ui/Modal";
import { ListTodo, UserPlus } from "lucide-react";
import FlowButton, { FlowButtonKind } from "./FlowButton";
import { flowMotion, REDUCED_MOTION, transition } from "./flowMotion";
import TaskAnswersCard from "./TaskAnswersCard";
import { FLOW_COLUMN } from "./TaskFlowScreen";

const KEEPS_OPEN = { "data-keeps-open": true };
const KEEP_OPEN = "button, [data-keeps-open]";

export default function TaskFlowComplete({
  schema,
  answers,
  user,
  fading,
  onClose,
  onInvite,
}: {
  schema: FormSchema;
  answers: Record<string, FormValue>;
  user: UserDto | undefined;
  fading: boolean;
  onClose: () => void;
  /** Null for a guest, who has no one to invite. */
  onInvite: (() => void) | null;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col bg-green",
        fading && "opacity-0",
        REDUCED_MOTION,
      )}
      style={{ transition: transition(flowMotion.recolor, "opacity") }}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest(KEEP_OPEN)
        ) {
          return;
        }
        onClose();
      }}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={cn(FLOW_COLUMN, "pt-12 pb-12")}>
            <ModalTitle
              className="text-4xl font-semibold text-white"
              {...KEEPS_OPEN}
            >
              {taskFlow.complete}
            </ModalTitle>
            <p className="mt-3 text-base text-white" {...KEEPS_OPEN}>
              {taskFlow.completeUpdate}
            </p>
            <TaskAnswersCard
              className="mt-6"
              output={{ schema, answers }}
              user={user}
              {...KEEPS_OPEN}
            />
          </div>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-green to-transparent"
        />
      </div>
      <div className={cn(FLOW_COLUMN, "flex flex-col gap-y-3 py-4")}>
        <FlowButton
          kind={FlowButtonKind.Inverse}
          onClick={onClose}
          iconLeft={ListTodo}
        >
          {taskFlow.viewTasks}
        </FlowButton>
        {onInvite ? (
          <FlowButton
            kind={FlowButtonKind.InverseSecondary}
            onClick={onInvite}
            iconLeft={UserPlus}
          >
            {taskFlow.inviteFriend}
          </FlowButton>
        ) : null}
      </div>
    </div>
  );
}
