import {
  type FormSchema,
  type FormValue,
} from "@alliance/common/forms/form-schema";
import { type UserDto } from "@alliance/shared/client";
import { formatUserLocationDisplayValue } from "@alliance/shared/formrenderer";
import { useCurrentUserLocation } from "@alliance/shared/forms/useCurrentUserLocation";
import { taskFlow } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import { useOutputItems } from "@alliance/shared/useOutputItems";
import { OutputRenderer } from "@alliance/sharedweb/forms/OutputRenderer";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { ModalTitle } from "@alliance/sharedweb/ui/Modal";
import { ListTodo, UserPlus } from "lucide-react";
import FlowButton, { FlowButtonKind } from "./FlowButton";
import { flowMotion, REDUCED_MOTION, transition } from "./flowMotion";
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
  const { userLocationDisplayValue } = useCurrentUserLocation({
    enabled: !!user,
    user,
  });
  const location = formatUserLocationDisplayValue(userLocationDisplayValue);
  const outputItems = useOutputItems({ schema, answers, ownView: true });

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
            {outputItems.length > 0 ? (
              <div
                className="mt-6 flex flex-col gap-y-4 rounded-md bg-white p-6"
                {...KEEPS_OPEN}
              >
                {user ? (
                  <div className="flex items-center gap-x-3">
                    <AvatarProfile
                      pfp={user.profilePicture}
                      size="medium"
                      alt={user.name}
                    />
                    <div className="flex-1">
                      <p className="text-base font-semibold text-zinc-900">
                        {user.name}
                      </p>
                      {location ? (
                        <p className="text-base text-zinc-500">{location}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <OutputRenderer schema={schema} answers={answers} ownView />
              </div>
            ) : null}
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
