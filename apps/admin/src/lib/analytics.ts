import { R } from "@alliance/common/result";
import { webEnv } from "@alliance/sharedweb/lib/env";
import { posthogBuildProperties } from "@alliance/sharedweb/lib/posthogBuildProperties";
import posthog, { type CaptureResult, type Properties } from "posthog-js";
import "posthog-js/dist/exception-autocapture";
import { useEffect, useState } from "react";
import {
  type ClientOnErrorFunction,
  isRouteErrorResponse,
  type Params,
  useLocation,
  useMatches,
} from "react-router";

const UNKNOWN_PAGE = "/[unknown]";
const URL_KEY = /(url|pathname|referrer)$/;
// posthog-js adds document.title to page views, and some admin titles name the
// member or record on the page. It also copies these query parameters, and a
// search engine referrer's keyword, into event, session-entry and initial
// person properties.
const DROPPED_KEY =
  /^title$|(utm_[a-z]+|gad_source|mc_cid|gclid|gclsrc|dclid|gbraid|wbraid|fbclid|msclkid|twclid|li_fat_id|igshid|ttclid|rdt_cid|epik|qclid|sccid|irclid|_kx|ph_keyword)$/;

const templatesByPathname = new Map<string, string>();
let staffIdentified = false;
const heldRouteErrors: unknown[] = [];

interface ScrubContext {
  origin: string;
  templates: ReadonlyMap<string, string>;
}

/** `/Forms/42/` matched by `/forms/:formId` → `/forms/:formId`. React Router
 * matches regardless of case and a trailing slash, and decodes the matched
 * pathname except `%2F`, which a param holds as `/`. Params arrive in path
 * order, so each takes the first matching segment after the previous one. A
 * param no segment holds gives `/[unknown]`, so its value can't stay in the
 * template. */
export function routeTemplate(match: {
  pathname: string;
  params: Params;
}): string {
  const segments = (match.pathname.replace(/\/+$/, "") || "/").split("/");
  let from = 0;
  for (const [name, value] of Object.entries(match.params)) {
    const index = segments.findIndex(
      (segment, i) => i >= from && segment.replaceAll("%2F", "/") === value,
    );
    if (index === -1) return UNKNOWN_PAGE;
    segments[index] = `:${name}`;
    from = index + 1;
  }
  return segments
    .map((segment) =>
      segment.startsWith(":") ? segment : segment.toLowerCase(),
    )
    .join("/");
}

/** Replaces a URL or path with its page's route template, so record ids and
 * search terms stay out of PostHog. Another site's URL keeps only its origin. */
export function scrubLocation(value: string, params: ScrubContext): string {
  const isPath = value.startsWith("/");
  const parsed = R.fromThrowable(
    () => new URL(value, isPath ? params.origin : undefined),
  );
  // Not a location, such as the "$direct" referrer.
  if (!parsed.ok || !parsed.value.protocol.startsWith("http")) return value;
  const url = parsed.value;
  if (url.origin !== params.origin) return url.origin;
  const template = params.templates.get(url.pathname) ?? UNKNOWN_PAGE;
  return isPath ? template : `${url.origin}${template}`;
}

function scrubProperties(
  properties: Properties,
  scrub: (value: string) => string,
): Properties {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([key]) => !DROPPED_KEY.test(key))
      .map(([key, value]) => [
        key,
        typeof value === "string" && URL_KEY.test(key) ? scrub(value) : value,
      ]),
  );
}

export function scrubEvent(
  event: CaptureResult,
  params: ScrubContext,
): CaptureResult {
  const scrub = (value: string) => scrubLocation(value, params);
  return {
    ...event,
    properties: scrubProperties(event.properties, scrub),
    $set: event.$set && scrubProperties(event.$set, scrub),
    $set_once: event.$set_once && scrubProperties(event.$set_once, scrub),
  };
}

/** Drops every event until syncStaff has identified a staff member, so none
 * goes out under a previous staff member's id or anonymously. */
export function beforeSend(event: CaptureResult | null): CaptureResult | null {
  return event && staffIdentified
    ? scrubEvent(event, {
        origin: window.location.origin,
        templates: templatesByPathname,
      })
    : null;
}

/** Starts PostHog in a deployed build; development and test configs carry no key. */
export function initAnalytics(): void {
  const key = webEnv("VITE_PUBLIC_POSTHOG_KEY");
  if (!import.meta.env.PROD || key === undefined) return;
  posthog.init(key, {
    api_host: webEnv("VITE_PUBLIC_POSTHOG_HOST"),
    defaults: "2025-05-24",
    // The member site's cookie, on the parent domain, would otherwise lend
    // admin its identity and session. The name keeps them apart when
    // localStorage fails and posthog-js falls back to a cookie.
    persistence: "localStorage",
    persistence_name: "admin",
    // useAnalytics sends page views once the route and staff member are known.
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_performance: false,
    disable_session_recording: true,
    disable_surveys: true,
    // The flags request sends person properties, such as the entry URL,
    // without passing them through before_send.
    advanced_disable_flags: true,
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false,
    },
    before_send: beforeSend,
  });
  registerSuperProperties();
}

/** Sends an error React Router catches, such as a loader's or a render's,
 * which no handler posthog-js installs sees. A not-found is expected, and
 * admin's loaders throw it as `Error("Not found")`. An error before a staff
 * member is identified waits for syncStaff, since one on a page's first load
 * always comes before `/auth/me` answers. */
export const captureRouteError: ClientOnErrorFunction = (
  error,
  { location, params },
) => {
  const notFound =
    isRouteErrorResponse(error) ||
    (error instanceof Error && error.message === "Not found");
  if (notFound || !posthog.__loaded) return;
  // The root error boundary replaces the page, so useAnalytics may not have
  // recorded this path's template. The params are decoded, as React Router
  // decodes the pathname it matches.
  templatesByPathname.set(
    location.pathname,
    routeTemplate({ pathname: decodePath(location.pathname), params }),
  );
  if (staffIdentified) posthog.captureException(error);
  else heldRouteErrors.push(error);
};

function decodePath(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) =>
      R.unwrapOr(
        R.fromThrowable(() =>
          decodeURIComponent(segment).replaceAll("/", "%2F"),
        ),
        segment,
      ),
    )
    .join("/");
}

function registerSuperProperties(): void {
  posthog.register({ app: "admin", ...posthogBuildProperties() });
}

interface Staff {
  id: number;
  email: string;
  name: string;
}

interface AuthSession {
  user: (Staff & { admin: boolean }) | undefined;
  isImpersonation: boolean;
  loading: boolean;
}

function sessionStaff(session: AuthSession): Staff | undefined {
  const { user, isImpersonation } = session;
  return user?.admin && !isImpersonation ? user : undefined;
}

function reset(): void {
  posthog.reset();
  // reset() also clears super-properties.
  registerSuperProperties();
}

/** Ties events to the staff member the API session belongs to, which can
 * change outside admin, such as by signing in as someone else on the member
 * site. */
export function syncStaff(staff: Staff | undefined): void {
  const identified = posthog.get_property("$user_state") === "identified";
  if (identified && posthog.get_distinct_id() !== staff?.id.toString()) {
    reset();
  }
  staffIdentified = staff !== undefined;
  const held = heldRouteErrors.splice(0);
  if (staff) {
    posthog.identify(staff.id.toString(), {
      email: staff.email,
      name: staff.name,
    });
    held.forEach((error) => posthog.captureException(error));
  }
}

/** Whether the root error boundary, which replaces Root and the identity it
 * settles, must identify staff itself, as on a page's first load. */
export function boundaryNeedsStaffIdentity(): boolean {
  return posthog.__loaded && !staffIdentified;
}

/** Settles identity for the root error boundary, sending or dropping held
 * errors, unless Root already identified staff. */
export function useBoundaryStaffIdentity(session: AuthSession): void {
  const { loading } = session;
  const staff = sessionStaff(session);
  useEffect(() => {
    if (!loading && !staffIdentified) syncStaff(staff);
  }, [loading, staff]);
}

/** Sends a page view per route once the session's staff member is known: an
 * admin signed in as themselves, since an impersonated admin's visits aren't
 * theirs. Identity settles once per page load, so signing out leaves the page
 * leave under the staff member's id, and the login page's load resets it. */
export function useAnalytics(session: AuthSession): void {
  const { loading } = session;
  const staff = sessionStaff(session);
  const { pathname } = useLocation();
  const leaf = useMatches().at(-1);
  const template = leaf ? routeTemplate(leaf) : UNKNOWN_PAGE;
  const [identityKnown, setIdentityKnown] = useState(false);

  useEffect(() => {
    if (loading || identityKnown) return;
    if (posthog.__loaded) syncStaff(staff);
    setIdentityKnown(true);
  }, [loading, staff, identityKnown]);

  useEffect(() => {
    templatesByPathname.set(pathname, template);
    if (posthog.__loaded && identityKnown) posthog.capture("$pageview");
  }, [pathname, template, identityKnown]);
}
