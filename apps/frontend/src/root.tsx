import { MOBILE_OAUTH_RETURN_PATH } from "@alliance/common/oauth";
import type { WebRuntimeConfig } from "@alliance/common/web-env";
import { client } from "@alliance/shared/client/client.gen";
import { registerAnalytics } from "@alliance/shared/lib/analytics";
import { registerErrorStatus } from "@alliance/shared/lib/hey-api";
import { registerPosthogRequestContext } from "@alliance/shared/lib/posthog-request";
import { webEnv } from "@alliance/sharedweb/lib/env";
import {
  setWebRuntimeConfig,
  webRuntimeConfig,
} from "@alliance/sharedweb/lib/runtimeConfig";
import { useNumberInputScrollGuard } from "@alliance/sharedweb/lib/useNumberInputScrollGuard";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import posthog from "posthog-js";
import "posthog-js/dist/exception-autocapture";
import { PostHogProvider } from "posthog-js/react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRouteLoaderData,
} from "react-router";
import { HtmlBackgroundManager } from "./components/HtmlBackgroundManager";
import {
  isNotFound,
  ErrorBoundary as RootErrorBoundary,
} from "./ErrorBoundary";
import { AuthProvider } from "./lib/AuthContext";
import { getApiUrl, getPosthogHost } from "./lib/config";
import { useLinkOpenings } from "./lib/linkOpenings";
import { posthogOptions } from "./lib/posthogOptions";
import { posthogRequestContext } from "./lib/posthogRequestContext";
import { queryClient } from "./lib/queryClient";
import { ShareLinkViewerFromAuth } from "./lib/ShareLinkViewerFromAuth";
import { socialPreviewMeta } from "./lib/socialPreviewMeta";
import { useFullLoadOnNewBuild } from "./lib/useFullLoadOnNewBuild";
import { InviteSessionProvider } from "./site/invite/InviteSession";
import { NOT_FOUND_TITLE } from "./site/NotFoundPage";

client.setConfig({
  baseUrl: getApiUrl(),
});

registerErrorStatus(client);

registerAnalytics(posthog);
registerPosthogRequestContext({
  client,
  getContext: () => posthogRequestContext(posthog),
});

export function meta({
  error,
  loaderData,
}: {
  error?: unknown;
  loaderData?: WebRuntimeConfig;
}) {
  const title = isNotFound(error) ? NOT_FOUND_TITLE : "Alliance";
  return loaderData ? socialPreviewMeta({ title }) : [{ title }];
}

export function loader() {
  return webRuntimeConfig();
}

export const shouldRevalidate = () => false;

// React Router passes `error` only to a declared export, not to a re-export.
export const ErrorBoundary = RootErrorBoundary;

export function Layout({ children }: { children: React.ReactNode }) {
  // Set during render, before any child reads it. Absent when the root loader
  // didn't run, as for a document POST that renders an error.
  const config = useRouteLoaderData<typeof loader>("root");
  if (config) setWebRuntimeConfig(config);
  useNumberInputScrollGuard();
  const { pathname } = useLocation();
  // A deployed environment's config can't lack the key (webRuntimeConfigSchema).
  const posthogKey =
    config && import.meta.env.PROD && pathname !== MOBILE_OAUTH_RETURN_PATH
      ? webEnv("VITE_PUBLIC_POSTHOG_KEY")
      : undefined;
  const withPosthog = posthogKey !== undefined;
  // Here rather than in Root, so an arrival on an error page is sent too.
  useLinkOpenings({ withPosthog });

  const inner = (
    <SiteAppProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
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
        {posthogKey !== undefined ? (
          <PostHogProvider
            apiKey={posthogKey}
            options={{ ...posthogOptions, api_host: getPosthogHost() }}
          >
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
  useFullLoadOnNewBuild(webEnv("VITE_APP_GIT_SHA"));
  return <Outlet />;
}
