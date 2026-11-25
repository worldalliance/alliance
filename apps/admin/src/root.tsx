import { client } from "@alliance/shared/client/client.gen";
import { registerErrorStatus } from "@alliance/shared/lib/hey-api";
import {
  ShareLinkViewer,
  ShareLinkViewerProvider,
} from "@alliance/sharedweb/forms/BigLinkDisplay";
import { holdChunkReloads } from "@alliance/sharedweb/lib/lazyOrReload";
import { queryClient } from "@alliance/sharedweb/lib/queryClient";
import { useNumberInputScrollGuard } from "@alliance/sharedweb/lib/useNumberInputScrollGuard";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { Route } from "../.react-router/types/src/+types/root";
import { FullScreenError } from "./ConfigErrorScreen";
import {
  boundaryNeedsStaffIdentity,
  useAnalytics,
  useBoundaryStaffIdentity,
} from "./lib/analytics";
import { AuthProvider, useAuth } from "./lib/AuthContext";
import { getSiteUrl } from "./lib/config";
import { SiteOriginLinkProvider } from "./ui/SiteAppProvider";
import Spinner from "./ui/Spinner";
import { ToastProvider } from "./ui/ToastProvider";

registerErrorStatus(client);

// Admin pages keep unsaved work in memory, much of it without an unload prompt,
// so a chunk that fails to load shows its boundary's reload advice instead.
holdChunkReloads();

export function HydrateFallback() {
  return (
    <div className="flex items-center justify-center h-screen">
      <Spinner size="large" />
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <>
      {boundaryNeedsStaffIdentity() && (
        <AuthProvider>
          <StaffIdentity />
        </AuthProvider>
      )}
      <ErrorDetails error={error} />
    </>
  );
}

function StaffIdentity() {
  useBoundaryStaffIdentity(useAuth());
  return null;
}

function ErrorDetails({ error }: { error: unknown }) {
  if (isRouteErrorResponse(error)) {
    return (
      <FullScreenError title={`${error.status} ${error.statusText}`}>
        {typeof error.data === "string" && (
          <p className="text-fg-muted">{error.data}</p>
        )}
      </FullScreenError>
    );
  }
  return (
    <FullScreenError
      title="Something went wrong"
      detail={error instanceof Error ? error.stack : undefined}
    >
      {error instanceof Error && <p className="text-danger">{error.message}</p>}
    </FullScreenError>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  useNumberInputScrollGuard();

  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/svg+xml" href="/god.png" />
        <title>Alliance</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function Analytics() {
  useAnalytics(useAuth());
  return null;
}

// The providers read the runtime config, which entry.client loads before
// hydrating, so they stay out of Layout, which the build prerenders.
export default function Root() {
  return (
    <SiteOriginLinkProvider origin={getSiteUrl()}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Analytics />
          <ShareLinkViewerProvider value={ShareLinkViewer.Anonymous}>
            <ToastProvider>
              <Outlet />
            </ToastProvider>
          </ShareLinkViewerProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SiteOriginLinkProvider>
  );
}
