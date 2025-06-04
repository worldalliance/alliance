import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { getApiUrl } from "./lib/config";
import { client } from "@alliance/shared/client/client.gen";
import { AuthProvider } from "./lib/AuthContext";

client.setConfig({
  baseUrl: getApiUrl(),
  credentials: "include",
});

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
        <AuthProvider>{children}</AuthProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function Root() {
  return <Outlet />;
}
