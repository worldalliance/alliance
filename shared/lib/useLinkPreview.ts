import { useQuery } from "@tanstack/react-query";
import { linkPreviewGetPreview } from "../client";
import { queryKeys } from "./queryKeys";

/**
 * Fetches OpenGraph preview data for an external URL via the server's
 * `link-preview` endpoint. Pass `enabled: false` until the preview is
 * actually needed (e.g. the user hovers the link) so a page full of links
 * doesn't fan out into a request per link on mount.
 */
export function useLinkPreview(
  url: string | null,
  params?: { enabled?: boolean },
) {
  const { enabled = true } = params ?? {};
  // The server treats URLs differing only by fragment as the same page (a
  // fragment never goes on the wire); mirror that here so anchor links into
  // one page share a single query cache entry and request.
  const fragmentless = url == null ? null : stripFragment(url);
  return useQuery({
    queryKey: queryKeys.linkPreview(fragmentless ?? ""),
    queryFn: () =>
      linkPreviewGetPreview({
        query: { url: fragmentless! },
        throwOnError: true,
      }).then((r) => r.data),
    enabled: enabled && url != null,
    // Previews are best-effort; retrying just multiplies requests (and
    // fights the server's rate limit when the failure is a 429).
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

function stripFragment(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return url;
  }
}
