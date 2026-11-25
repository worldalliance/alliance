import { type UserDto } from "@alliance/shared/client";
import { type ReactNode, type RefObject } from "react";

export enum ImmersiveTone {
  Plain = "plain",
  /** Green, behind the flow's completion screen. */
  Success = "success",
}

/** Closes the flow with its exit animation, then runs `then`. */
export type FinishFlow = (then?: () => void) => void;

/** What a completion screen button does; `finish` closes the flow. */
export type CompletionExit = (finish: FinishFlow) => void;

export type TaskFlowViewer = {
  user: UserDto | undefined;
  isAuthenticated: boolean;
  userLoading: boolean;
  isImpersonation: boolean;
};

/**
 * What differs between the apps that run the task flow. The `use*` members
 * are hooks the flow calls on every render, so a host keeps the same ones for
 * the flow's lifetime.
 */
export type TaskFlowHost = {
  /** Adapts the app's own chrome while the full-screen panel is up. */
  useChrome: (params: {
    immersive: boolean;
    tone: ImmersiveTone;
    panelUp: boolean;
  }) => void;
  /** Remembers a flow the member leaves mid-task and reopens it once they are back on its page. */
  useResume: (params: {
    actionId: number;
    open: boolean;
    submitInFlight: RefObject<boolean>;
    ready: boolean;
    begin: () => void;
  }) => void;
  useCompletionExits: (params: {
    isAuthenticated: boolean;
    signupHref: string | undefined;
  }) => {
    /** Labels the close button as going to the tasks homepage. */
    leavesToTasks: boolean;
    close: CompletionExit;
    /** Null hides the button. */
    invite: CompletionExit | null;
    /** Offered in place of `invite`; null hides it. */
    signUp: CompletionExit | null;
  };
  /** Places the full-screen panel below the app's fixed chrome. */
  panelClassName: string;
  /** Renders under a profile phone question in a flow that records a signed-in member's answers; absent renders the plain field. */
  confirmPhone?: (phoneNumber: string) => ReactNode;
  /** The element the panel mounts in: the document body when undefined, nothing until set when null. */
  panelContainer?: HTMLElement | null;
};
