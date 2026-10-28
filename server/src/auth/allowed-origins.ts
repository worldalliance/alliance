import { socketCorsOrigins } from "src/utils/cors-origins";

/**
 * nginx serves the two public sites under `www.` as well, and the admin hosts
 * have no such alias, which is why only these two grow the variant. Staging
 * grows one too, which nothing serves.
 */
function allowedOrigins(): (string | RegExp)[] {
  const configured = socketCorsOrigins({
    nodeEnv: process.env.NODE_ENV,
    appUrl: process.env.APP_URL,
    altAppUrl: process.env.ALT_APP_URL,
    adminUrl: process.env.ADMIN_URL,
    altAdminUrl: process.env.ALT_ADMIN_URL,
  });

  const www = [process.env.APP_URL, process.env.ALT_APP_URL]
    .filter((url): url is string => !!url)
    .map((url) => new URL(url))
    .map((url) => `${url.protocol}//www.${url.host}`);

  return [...configured, ...www];
}

/**
 * Whether `origin` is one of the sites this server answers for, which come
 * from config and never from the request.
 */
export function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins().some((allowed) =>
    typeof allowed === "string" ? allowed === origin : allowed.test(origin),
  );
}
