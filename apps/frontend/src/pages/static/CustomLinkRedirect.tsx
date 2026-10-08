import { R } from "@alliance/common/result";
import { siteHref } from "@alliance/common/url";
import { customLinksResolve } from "@alliance/shared/client";
import { redirect } from "react-router";

export async function loader({
  params,
}: {
  params: { customLinkSlug: string };
}) {
  const result = await R.fromPromise(
    customLinksResolve({
      path: { slug: params.customLinkSlug },
      credentials: "omit",
      throwOnError: false,
    }),
  );
  if (!result.ok)
    throw new Response("Custom links are unavailable", { status: 503 });
  if (!result.value.data) {
    throw new Response("Custom link not found", {
      status: result.value.response.status,
    });
  }
  return redirect(siteHref(result.value.data.destination), {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}

export default function CustomLinkRedirect() {
  return null;
}
