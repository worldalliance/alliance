import {
  useReopenLeftTask,
  useTaskFlowReturn,
} from "@alliance/shared/lib/TaskFlowReturnContext";
import { type TaskFlowHost } from "@alliance/sharedweb/forms/taskflow/host";
import { useEffect, useRef } from "react";
import { href, matchPath, useLocation, useNavigate } from "react-router";
import { useImmersiveNavbar } from "../../lib/NavbarOptionsContext";
import PhoneConfirm from "../phone/PhoneConfirm";

const TASKS_PATH = href("/tasks");

const isTaskPage = (path: string, actionId: number) =>
  matchPath("/actions/:id", path)?.params.id === String(actionId);

const useResume: TaskFlowHost["useResume"] = ({
  actionId,
  open,
  submitInFlight,
  ready,
  begin,
}) => {
  const { pathname } = useLocation();
  const { leaveTask } = useTaskFlowReturn();

  // Navigating away mid-task (the browser's Back, say) unmounts the flow.
  // Only the task's own page reopens it, as on mobile.
  const openRef = useRef(open);
  openRef.current = open;
  const mountedPathRef = useRef(pathname);
  useEffect(
    () => () => {
      const mountedPath = mountedPathRef.current;
      if (
        openRef.current &&
        !submitInFlight.current &&
        isTaskPage(mountedPath, actionId) &&
        window.location.pathname !== mountedPath
      ) {
        leaveTask(actionId);
      }
    },
    [actionId, leaveTask, submitInFlight],
  );

  useReopenLeftTask({
    actionId,
    onTaskPage: isTaskPage(pathname, actionId),
    ready,
    begin,
  });
};

const useCompletionExits: TaskFlowHost["useCompletionExits"] = ({
  isAuthenticated,
  signupHref,
}) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return {
    leavesToTasks: isAuthenticated,
    close: (finish) =>
      finish(
        isAuthenticated && pathname !== TASKS_PATH
          ? () => navigate(TASKS_PATH)
          : undefined,
      ),
    invite: isAuthenticated ? () => navigate(href("/invites")) : null,
    signUp: !isAuthenticated && signupHref ? () => navigate(signupHref) : null,
  };
};

/** The member site's task flow, below its nav, which goes immersive while the flow is up. */
export const memberTaskFlowHost: TaskFlowHost = {
  useChrome: useImmersiveNavbar,
  useResume,
  useCompletionExits,
  confirmPhone: (phoneNumber) => (
    <PhoneConfirm
      phoneNumber={phoneNumber}
      unconfirmedNote="Confirm your number so we know it’s right."
    />
  ),
  panelClassName:
    "fixed inset-0 top-[var(--site-nav-height)] md:top-[calc(var(--navbar-top-bar-height)+var(--site-nav-height))] md:left-[var(--nav-width)]",
};
