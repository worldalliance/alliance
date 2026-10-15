import { STAGING_SITE_URL } from "@alliance/common/url";

/**
 * Hands an app-store review account to staging as a top-level form post, so
 * staging can set its cookies even from the legacy domain, where it is
 * cross-site and a fetch's cookies would be dropped. The password travels in
 * the body, never the URL.
 */
export function signInOnStaging(credentials: {
  email: string;
  password: string;
}): void {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${STAGING_SITE_URL}/api/auth/review-login`;
  for (const [name, value] of Object.entries(credentials)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  form.submit();
}
