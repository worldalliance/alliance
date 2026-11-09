import {
  type FormSchema,
  type FormValue,
} from "@alliance/common/forms/form-schema";
import { type UserDto } from "@alliance/shared/client";
import { taskFlow } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import { useMediaQuery } from "@alliance/sharedweb/lib/useMediaQuery";
import { ModalTitle } from "@alliance/sharedweb/ui/Modal";
import { ListTodo, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ImmersiveTone } from "../../lib/NavbarOptionsContext";
import FlowButton, { FlowButtonKind } from "./FlowButton";
import {
  flowMotion,
  greenMotion,
  REDUCED_MOTION,
  SUCCESS_HOLD_MS,
  transition,
} from "./flowMotion";
import TaskAnswersCard from "./TaskAnswersCard";
import { FLOW_COLUMN } from "./TaskFlowScreen";

const KEEPS_OPEN = { "data-keeps-open": true };
// `button` so the screen's own buttons don't also close it as a background tap.
const KEEPS_OPEN_SELECTOR = "button, [data-keeps-open]";
const keepsOpen = (target: EventTarget | null) =>
  target instanceof Element && target.closest(KEEPS_OPEN_SELECTOR) !== null;

export enum CompletionPhase {
  Arriving = "arriving",
  Green = "green",
  Settled = "settled",
}

export const COMPLETION_TONE: Record<CompletionPhase, ImmersiveTone> = {
  [CompletionPhase.Arriving]: ImmersiveTone.Plain,
  [CompletionPhase.Green]: ImmersiveTone.Success,
  [CompletionPhase.Settled]: ImmersiveTone.Plain,
};

// Tailwind's `md`, where the side nav shows beside the flow.
const WIDE_QUERY = "(min-width: 48rem)";

export function useCompletionPhase(complete: boolean): CompletionPhase {
  const wide = useMediaQuery(WIDE_QUERY);
  const [phase, setPhase] = useState(CompletionPhase.Arriving);
  useEffect(() => {
    if (!complete || wide) return;
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() =>
        setPhase(CompletionPhase.Green),
      );
    });
    const timer = window.setTimeout(
      () => setPhase(CompletionPhase.Settled),
      flowMotion.success.durationMs + SUCCESS_HOLD_MS,
    );
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      setPhase(CompletionPhase.Arriving);
    };
  }, [complete, wide]);
  return wide ? CompletionPhase.Settled : phase;
}

const PALETTES: Record<
  CompletionPhase,
  {
    green: boolean;
    background: string;
    title: string;
    text: string;
    fade: string;
    card: string;
    close: FlowButtonKind;
    invite: FlowButtonKind;
  }
> = {
  [CompletionPhase.Arriving]: {
    green: false,
    background: "bg-white",
    title: "text-zinc-900",
    text: "text-zinc-900",
    fade: "from-white",
    card: "border-zinc-200",
    close: FlowButtonKind.Secondary,
    invite: FlowButtonKind.Primary,
  },
  [CompletionPhase.Green]: {
    green: true,
    background: "bg-green",
    title: "text-white",
    text: "text-white",
    fade: "from-green",
    card: "border-transparent",
    close: FlowButtonKind.Inverse,
    invite: FlowButtonKind.InverseSecondary,
  },
  [CompletionPhase.Settled]: {
    green: false,
    background: "bg-white",
    title: "text-green",
    text: "text-zinc-900",
    fade: "from-white",
    card: "border-zinc-200",
    close: FlowButtonKind.Secondary,
    invite: FlowButtonKind.Primary,
  },
};

export default function TaskFlowComplete({
  schema,
  answers,
  user,
  phase,
  fading,
  leavesToTasks,
  onClose,
  onInvite,
  onSignUp,
}: {
  schema: FormSchema;
  answers: Record<string, FormValue>;
  user: UserDto | undefined;
  phase: CompletionPhase;
  fading: boolean;
  /** Whether closing takes the member to the tasks homepage; a guest is sent elsewhere. */
  leavesToTasks: boolean;
  onClose: () => void;
  /** Null for a guest, who has no one to invite. */
  onInvite: (() => void) | null;
  /** Offered to a guest in place of the invite. */
  onSignUp: (() => void) | null;
}) {
  const pressStartedInside = useRef(false);
  const palette = PALETTES[phase];
  const invite = onInvite
    ? { onClick: onInvite, label: taskFlow.inviteFriend }
    : onSignUp && { onClick: onSignUp, label: taskFlow.joinAlliance };
  const recolor = {
    transition: transition(
      greenMotion(palette.green),
      "background-color",
      "border-color",
      "color",
      "--tw-gradient-from",
    ),
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        palette.background,
        fading && "opacity-0",
        REDUCED_MOTION,
      )}
      style={{
        transition: [
          transition(greenMotion(palette.green), "background-color"),
          transition(flowMotion.recolor, "opacity"),
        ].join(", "),
      }}
      onPointerDown={(event) => {
        pressStartedInside.current = keepsOpen(event.target);
      }}
      onClick={(event) => {
        // A drag that starts on the card and ends on the background is a text
        // selection, not a dismissal.
        if (pressStartedInside.current || keepsOpen(event.target)) return;
        onClose();
      }}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={cn(FLOW_COLUMN, "pt-12 pb-12")}>
            <ModalTitle
              className={cn(
                "text-4xl font-semibold",
                palette.title,
                REDUCED_MOTION,
              )}
              style={recolor}
              {...KEEPS_OPEN}
            >
              {taskFlow.complete}
            </ModalTitle>
            <p
              className={cn("mt-3 text-base", palette.text, REDUCED_MOTION)}
              style={recolor}
              {...KEEPS_OPEN}
            >
              {taskFlow.completeUpdate}
            </p>
            <TaskAnswersCard
              className={cn("mt-6 border", palette.card, REDUCED_MOTION)}
              style={recolor}
              output={{ schema, answers }}
              user={user}
              {...KEEPS_OPEN}
            />
          </div>
        </div>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t to-transparent",
            palette.fade,
            REDUCED_MOTION,
          )}
          style={recolor}
        />
      </div>
      <div className={cn(FLOW_COLUMN, "flex flex-col gap-y-3 py-4")}>
        <FlowButton
          kind={palette.close}
          className={REDUCED_MOTION}
          style={recolor}
          onClick={onClose}
          iconLeft={leavesToTasks ? ListTodo : X}
        >
          {leavesToTasks ? taskFlow.viewTasks : taskFlow.closeTask}
        </FlowButton>
        {invite ? (
          <FlowButton
            kind={palette.invite}
            className={REDUCED_MOTION}
            style={recolor}
            onClick={invite.onClick}
            iconLeft={UserPlus}
          >
            {invite.label}
          </FlowButton>
        ) : null}
      </div>
    </div>
  );
}
