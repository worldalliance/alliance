import { R } from "@alliance/common/result";
import { siteHref } from "@alliance/common/url";
// eslint-disable-next-line api-client/named-hooks-only -- one-off request whose result no query cache holds
import { customLinksResolve } from "@alliance/shared/client";
import { redirect } from "react-router";

export async function loader({
  params,
  request,
}: {
  params: { customLinkSlug: string };
  request: Request;
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
  let destination = siteHref(result.value.data.destination);
  const incoming = new URL(request.url);
  const target = new URL(destination, incoming);
  if (target.origin === incoming.origin && incoming.search) {
    for (const key of incoming.searchParams.keys()) {
      target.searchParams.delete(key);
    }
    for (const [key, value] of incoming.searchParams) {
      target.searchParams.append(key, value);
    }
    destination = siteHref(target.href);
  }
  return redirect(destination, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}

export default function CustomLinkRedirect() {
  return null;
}
