import { MOBILE_OAUTH_RETURN_PATH } from "@alliance/common/oauth";
import { client } from "@alliance/shared/client/client.gen";
import { registerAnalytics } from "@alliance/shared/lib/analytics";
import { registerErrorStatus } from "@alliance/shared/lib/hey-api";
import { registerPosthogRequestContext } from "@alliance/shared/lib/posthog-request";
import { retryUnlessRefused } from "@alliance/shared/lib/retryQuery";
import { useNumberInputScrollGuard } from "@alliance/sharedweb/lib/useNumberInputScrollGuard";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { milliseconds } from "date-fns";
import posthog, { PostHogConfig } from "posthog-js";
import "posthog-js/dist/exception-autocapture";
import { PostHogProvider } from "posthog-js/react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";
import { HtmlBackgroundManager } from "./components/HtmlBackgroundManager";
import { ErrorBoundary as RootErrorBoundary } from "./ErrorBoundary";
import { AuthProvider } from "./lib/AuthContext";
import { getApiUrl, getPosthogHost } from "./lib/config";
import { registerArrival, useLinkOpenings } from "./lib/linkOpenings";
import PosthogBuildTag from "./lib/PosthogBuildTag";
import { posthogRequestContext } from "./lib/posthogRequestContext";
import { ShareLinkViewerFromAuth } from "./lib/ShareLinkViewerFromAuth";
import { socialPreviewMeta } from "./lib/socialPreviewMeta";
import { InviteSessionProvider } from "./site/invite/InviteSession";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: milliseconds({ days: 1 }),
      retry: retryUnlessRefused(3),
    },
  },
});

client.setConfig({
  baseUrl: getApiUrl(),
});

registerErrorStatus(client);

registerAnalytics(posthog);
registerPosthogRequestContext({
  client,
  getContext: () => posthogRequestContext(posthog),
});

export function meta() {
  return socialPreviewMeta({ title: "Alliance" });
}

const options: Partial<PostHogConfig> = {
  api_host: getPosthogHost(),
  loaded: registerArrival,
  defaults: "2025-05-24",
  capture_exceptions: {
    capture_unhandled_errors: true,
    capture_unhandled_rejections: true,
    capture_console_errors: true,
  },
  session_recording: {
    maskAllInputs: false,
    maskInputFn: (text, element) => {
      if (element?.nodeName === "TEXTAREA") {
        return text;
      }
      return "*".repeat(text.length);
    },
    maskCapturedNetworkRequestFn: (request) => {
      if (request.name.includes("auth")) {
        request.requestBody = undefined;
        return request;
      }
      return request;
    },
  },
};

// React Router passes `error` only to a declared export, not to a re-export.
export const ErrorBoundary = RootErrorBoundary;

export function Layout({ children }: { children: React.ReactNode }) {
  useNumberInputScrollGuard();
  const { pathname } = useLocation();
  const withPosthog =
    import.meta.env.PROD && pathname !== MOBILE_OAUTH_RETURN_PATH;
  // Here rather than in Root, so an arrival on an error page is sent too.
  useLinkOpenings({ withPosthog });

  const inner = (
    <SiteAppProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider queryClient={queryClient}>
          <InviteSessionProvider>
            <ShareLinkViewerFromAuth>
              <ToastProvider>
                <HtmlBackgroundManager>{children}</HtmlBackgroundManager>
              </ToastProvider>
            </ShareLinkViewerFromAuth>
          </InviteSessionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SiteAppProvider>
  );

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/png" href="/planet-earth.png" />
        <Meta />
        <Links />
      </head>
      <body>
        {/* PostHog records the full URL, and the mobile app's sign-in handoff
            arrives in this page's query string. */}
        {withPosthog ? (
          <PostHogProvider
            apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
            options={options}
          >
            <PosthogBuildTag />
            {inner}
          </PostHogProvider>
        ) : (
          inner
        )}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}
