import { R, type Result } from "@alliance/common/result";
import { milliseconds } from "date-fns";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type BlockerFunction,
  createPath,
  NavigationType,
  useBlocker,
} from "react-router";
import { movesToAltDomain } from "./altDomainPages";
import { BUILD_VERSION_PATH, buildVersionSchema } from "./buildVersion";

export const BUILD_CHECK_INTERVAL_MS = milliseconds({ minutes: 15 });

// The server restarting into a deploy: the next check retries.
const TRANSIENT_STATUSES = new Set([502, 503, 504]);

const DOCUMENT_LOAD: Record<NavigationType, ((href: string) => void) | null> = {
  [NavigationType.Push]: (href) => window.location.assign(href),
  [NavigationType.Replace]: (href) => window.location.replace(href),
  [NavigationType.Pop]: null,
};

type BuildCheckFailure = { transient: boolean; cause: unknown };

async function deployedSha(): Promise<
  Result<string | null, BuildCheckFailure>
> {
  const response = await R.fromPromise(
    // eslint-disable-next-line no-restricted-globals -- a same-origin route of the web server, not the API
    fetch(BUILD_VERSION_PATH, { cache: "no-store" }),
  );
  if (R.isFailure(response)) {
    return R.failure({ transient: true, cause: response.error });
  }
  const { status, ok } = response.value;
  if (!ok) {
    return R.failure({
      transient: TRANSIENT_STATUSES.has(status),
      cause: new Error(`HTTP ${status}`),
    });
  }
  const body = await R.fromPromise(response.value.json());
  if (R.isFailure(body))
    return R.failure({ transient: false, cause: body.error });
  const parsed = buildVersionSchema.safeParse(body.value);
  return parsed.success
    ? R.success(parsed.data.sha)
    : R.failure({ transient: false, cause: parsed.error });
}

/**
 * Once the server reports a build other than the one this tab runs, turns the
 * next navigation to another page into a full document load, so the tab picks
 * up the new build without reloading the page under the user. Back and forward
 * stay in-app, since a document load there would add a history entry, as do
 * navigations carrying router state, which a document load would drop, and
 * navigations nginx would redirect to the alt domain, where a document load
 * arrives without the session and guest cookies.
 *
 * It holds the router's only blocker: React Router runs just the last one
 * registered, so lint forbids `useBlocker` elsewhere in the frontend and
 * sharedweb.
 */
export function useFullLoadOnNewBuild(builtSha: string | undefined) {
  const [stale, setStale] = useState(false);
  const load = useRef<((href: string) => void) | null>(null);

  useEffect(() => {
    if (!builtSha || stale) return;
    const check = async () => {
      if (document.hidden) return;
      const sha = await deployedSha();
      if (R.isFailure(sha)) {
        if (!sha.error.transient) {
          console.error("[build-version] check failed", sha.error.cause);
        }
        return;
      }
      if (sha.value && sha.value !== builtSha) setStale(true);
    };
    const onVisibilityChange = () => void check();
    const timer = setInterval(() => void check(), BUILD_CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [builtSha, stale]);

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation, historyAction }) => {
      const loadFor = DOCUMENT_LOAD[historyAction];
      const block =
        stale &&
        loadFor !== null &&
        nextLocation.state == null &&
        currentLocation.pathname !== nextLocation.pathname &&
        !movesToAltDomain({
          hostname: window.location.hostname,
          pathname: nextLocation.pathname,
          search: nextLocation.search,
        });
      if (block) load.current = loadFor;
      return block;
    },
    [stale],
  );
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    load.current?.(createPath(blocker.location));
  }, [blocker]);
}
