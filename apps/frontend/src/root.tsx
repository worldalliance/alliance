import { PostHogConfig } from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { Route } from "../.react-router/types/src/+types/root";
import { HtmlBackgroundManager } from "./components/HtmlBackgroundManager";
import { AuthProvider } from "./lib/AuthContext";

const options: Partial<PostHogConfig> = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
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
  },
};

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (!import.meta.env.PROD) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        {error instanceof Error && (
          <p className="text-red-500">{error.message}</p>
        )}
        {isRouteErrorResponse(error) ? (
          <p>
            {error.status} {error.statusText}
          </p>
        ) : (
          <p>Please try again</p>
        )}
      </div>
    );
  }
  if (isRouteErrorResponse(error)) {
    return (
      <>
        <h1>
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
      </>
    );
  } else if (error instanceof Error) {
    return (
      <div className="p-2">
        <h3>Error</h3>
        <p>{error.message}</p>
        <pre className="text-red-500">{error.stack}</pre>
      </div>
    );
  } else {
    return <h1>Unknown Error</h1>;
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/svg+xml" href="/planet-earth.png" />
        <title>Alliance</title>
        <Meta />
        <Links />
      </head>
      <body>
        {import.meta.env.PROD ? (
          <PostHogProvider
            apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
            options={options}
          >
            <AuthProvider>
              <HtmlBackgroundManager>{children}</HtmlBackgroundManager>
            </AuthProvider>
          </PostHogProvider>
        ) : (
          <AuthProvider>
            <HtmlBackgroundManager>{children}</HtmlBackgroundManager>
          </AuthProvider>
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
