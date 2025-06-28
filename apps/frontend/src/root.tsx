import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { getApiUrl } from "./lib/config";
import { client } from "@alliance/shared/client/client.gen";
import { AuthProvider } from "./lib/AuthContext";
import { PostHogProvider } from "posthog-js/react";
import { PostHogConfig } from "posthog-js";

client.setConfig({
  baseUrl: getApiUrl(),
  credentials: "include",
});

const options: Partial<PostHogConfig> = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  defaults: "2025-05-24",
};

export function Layout({ children }: { children: React.ReactNode }) {
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
        <PostHogProvider
          apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
          options={options}
        >
          <AuthProvider>{children}</AuthProvider>
        </PostHogProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}
