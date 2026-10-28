import { AnalyticsEvent } from "@alliance/common/analytics";
import { captureEvent } from "@alliance/shared/lib/analytics";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { zIndex } from "@alliance/sharedweb/ui/zIndex";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router";
import { useAuth } from "../lib/AuthContext";
import { SiteFooter } from "./Footer";
import { HOME_HREF, TASKS_HREF } from "./links";
import { NAV_HEIGHT, Navbar } from "./Navbar";
import { SiteRoot } from "./PageShell";
import { DisplayHeading, SITE_COL } from "./ui";

export const NOT_FOUND_TITLE = "Page not found — The Alliance";

export enum NotFoundSource {
  UnmatchedRoute = "unmatched_route",
  MissingRecord = "missing_record",
}

export function NotFoundPage({ source }: { source: NotFoundSource }) {
  const { isAuthenticated, loading } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => {
    captureEvent(AnalyticsEvent.NotFound, { path: pathname, source });
  }, [pathname, source]);

  return (
    <SiteRoot className="flex flex-col">
      <Navbar />
      <section
        className="flex-1 bg-[var(--site-surface)]"
        style={{ paddingTop: NAV_HEIGHT }}
      >
        <div
          className={cn(
            SITE_COL,
            "flex flex-col items-center gap-10 text-center pt-16 pb-32 min-[1020px]:pt-[104px]",
          )}
        >
          <DisplayHeading
            as="h1"
            leading={1.15}
            className="text-[clamp(2.5rem,7.5vw,3.75rem)] min-[1020px]:text-[clamp(3.25rem,4.7vw,5.25rem)]"
          >
            We couldn’t find that page
          </DisplayHeading>
          <div
            className={cn(
              "transition-opacity duration-300",
              loading && "pointer-events-none opacity-0",
            )}
            aria-hidden={loading}
          >
            {isAuthenticated ? (
              <Button to={TASKS_HREF} color={ButtonColor.Black} withArrow>
                My tasks
              </Button>
            ) : (
              <Button to={HOME_HREF} color={ButtonColor.Black} withArrow>
                Learn about the Alliance
              </Button>
            )}
          </div>
        </div>
      </section>
      <SiteFooter />
    </SiteRoot>
  );
}

/** For a page inside the app layout whose record doesn't exist; covers the app's own chrome. */
export function MissingRecordPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = NOT_FOUND_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

  return createPortal(
    <div className={cn("absolute inset-x-0 top-0 min-h-screen", zIndex.drawer)}>
      <NotFoundPage source={NotFoundSource.MissingRecord} />
    </div>,
    document.body,
  );
}
