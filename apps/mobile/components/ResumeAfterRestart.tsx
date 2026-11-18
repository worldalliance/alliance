import { ExceptionEvent } from "@alliance/common/analytics";
import { captureException } from "@alliance/shared/lib/analytics";
import { router, type Href } from "expo-router";
import { useEffect, useRef } from "react";
import { useAuth } from "../lib/AuthContext";
import {
  canTakeResumeRoute,
  ResumeRouteStep,
  resumeSavedRoute,
} from "../lib/resumeRoute";

/** Reopens the screen a restart into an update left, once the member is signed in. */
export default function ResumeAfterRestart() {
  const { isAuthenticated, isLoading, sessionUnavailable } = useAuth();
  const taken = useRef(false);

  useEffect(() => {
    if (!canTakeResumeRoute({ isLoading, sessionUnavailable })) return;
    if (taken.current) return;
    taken.current = true;
    void resumeSavedRoute({
      isAuthenticated,
      // An in-app path; one the update no longer defines opens the not-found
      // screen. `navigate`, not `push`, so a restart on home doesn't stack a
      // second home screen.
      navigate: (route) => router.navigate(route as Href),
      report: (error) =>
        captureException(ExceptionEvent.ResumeRouteFailed, error, {
          step: ResumeRouteStep.Take,
        }),
    });
  }, [isAuthenticated, isLoading, sessionUnavailable]);

  return null;
}
