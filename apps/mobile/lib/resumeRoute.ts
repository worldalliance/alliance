import { R, type Result } from "@alliance/common/result";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { milliseconds } from "date-fns";
import { z } from "zod";

const KEY = "resumeRoute";

// Long enough to cover a restart, short enough that a launch days later
// doesn't jump to a screen the member left long ago.
export const RESUME_ROUTE_MAX_AGE_MS = milliseconds({ minutes: 2 });

/** The `step` property of a `resume_route_failed` report. */
export enum ResumeRouteStep {
  Save = "save",
  Take = "take",
  Drop = "drop",
}

const savedSchema = z.object({
  route: z.string().regex(/^\/(?!\/)/),
  savedAt: z.number(),
});

export function saveResumeRoute(
  route: string,
  now = Date.now(),
): Promise<Result<void, unknown>> {
  return R.fromPromise(
    AsyncStorage.setItem(KEY, JSON.stringify({ route, savedAt: now })),
  );
}

/**
 * Saves `route`, then runs `reload`; a failed reload drops the route again, so
 * a later launch doesn't jump back to it. A failed save or drop is reported.
 */
export async function reloadResumingAt(params: {
  route: string;
  reload: () => Promise<void>;
  report: (failure: { step: ResumeRouteStep; error: unknown }) => void;
}): Promise<Result<void, unknown>> {
  const saved = await saveResumeRoute(params.route);
  if (R.isFailure(saved)) {
    params.report({ step: ResumeRouteStep.Save, error: saved.error });
  }
  const reloaded = await R.fromPromise(params.reload());
  if (R.isFailure(reloaded)) {
    const dropped = await R.fromPromise(AsyncStorage.removeItem(KEY));
    if (R.isFailure(dropped)) {
      params.report({ step: ResumeRouteStep.Drop, error: dropped.error });
    }
  }
  return reloaded;
}

async function readOnce(): Promise<string | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw !== null) await AsyncStorage.removeItem(KEY);
  return raw;
}

/**
 * The in-app route saved just before a restart, once; null when there is none
 * or it is too old. An entry that isn't an in-app path fails.
 */
export async function takeResumeRoute(
  now = Date.now(),
): Promise<Result<string | null, unknown>> {
  const raw = await R.fromPromise(readOnce());
  if (R.isFailure(raw) || raw.value === null) return raw;
  const text = raw.value;
  const json = R.fromThrowable((): unknown => JSON.parse(text));
  if (R.isFailure(json)) return json;
  const saved = savedSchema.safeParse(json.value);
  if (!saved.success) return R.failure(saved.error);
  return R.success(
    now - saved.data.savedAt > RESUME_ROUTE_MAX_AGE_MS
      ? null
      : saved.data.route,
  );
}

/**
 * Whether auth has settled enough to take the saved route. A session that
 * failed to load may still load on retry, so it waits through that too.
 */
export function canTakeResumeRoute(auth: {
  isLoading: boolean;
  sessionUnavailable: boolean;
}): boolean {
  return !auth.isLoading && !auth.sessionUnavailable;
}

/** Opens the saved route for a signed-in member, consuming it either way. */
export async function resumeSavedRoute(params: {
  isAuthenticated: boolean;
  navigate: (route: string) => void;
  report: (error: unknown) => void;
  now?: number;
}): Promise<void> {
  const route = await takeResumeRoute(params.now);
  if (R.isFailure(route)) return params.report(route.error);
  if (route.value !== null && params.isAuthenticated) {
    params.navigate(route.value);
  }
}
