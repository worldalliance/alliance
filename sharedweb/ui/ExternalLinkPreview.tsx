import { LinkPreviewDto } from "@alliance/shared/client";
import { useLinkPreview } from "@alliance/shared/lib/useLinkPreview";
import { cn } from "@alliance/shared/styles/util";
import React, { useState } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./HoverCard";
import { useIsViewerAuthenticated } from "./ViewerAuthenticationProvider";

/**
 * Returns the href when it's an absolute http(s) URL worth a hover card,
 * null otherwise (relative paths, mailto:, anchors, ...).
 */
export function getPreviewableUrl(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:" ? href : null;
  } catch {
    return null;
  }
}

/**
 * Whether the preview endpoint would accept this URL. Mirrors the server's
 * `parseHttpUrl` port rule — it 400s explicit non-default ports, so asking
 * would only burn the user's rate-limit budget. Links that fail this still
 * get a hover card, just the static hostname/URL fallback.
 */
export function isFetchableUrl(url: string): boolean {
  try {
    const port = new URL(url).port;
    return port === "" || port === "80" || port === "443";
  } catch {
    return false;
  }
}

function displayHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

type ExternalLinkPreviewProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "ref"
> & {
  /** mdast node passed by react-markdown; discarded so it isn't spread to the DOM */
  node?: unknown;
};

/**
 * Renders an external link that shows a hover card previewing the target
 * page (OpenGraph title / description / site name, plus the site's favicon).
 * All of it — favicon included, inlined as a `data:` URI — is fetched
 * through our server, so hovering never makes the reader's browser contact
 * the linked page's host. og:image stays excluded by design: showing it
 * would mean either hotlinking it (leaks the reader's IP to the linked
 * host) or proxying multi-megabyte images through our server.
 *
 * Falls back to a plain same-tab anchor for hrefs that aren't absolute
 * http(s) URLs (in-page anchors, relative paths, mailto:, ...). When the
 * preview can't be fetched — the viewer is logged out (the
 * endpoint requires auth) or the server would reject the URL — the card
 * still opens, showing the static hostname/URL fallback without sending
 * any request.
 */
export default function ExternalLinkPreview({
  node: _node,
  href,
  children,
  className,
  ...rest
}: ExternalLinkPreviewProps) {
  const isViewerAuthenticated = useIsViewerAuthenticated();
  const url = getPreviewableUrl(href);
  const canFetch = url != null && isViewerAuthenticated && isFetchableUrl(url);
  const [open, setOpen] = useState(false);

  // Only fetch once the user actually hovers, so a page full of links
  // doesn't fan out into a request per link on mount.
  const { data, isError } = useLinkPreview(canFetch ? url : null, {
    enabled: open,
  });

  if (url == null) {
    // Plain anchor, not the Link component: Link forces target="_blank",
    // which would send in-page anchors and relative paths to a new tab.
    return (
      <a href={href} className={cn("text-link", className)} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger
        href={href}
        target="_blank"
        rel="noreferrer"
        delay={100}
        className={cn(
          "text-link inline whitespace-normal underline-offset-2",
          className,
        )}
        {...rest}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        sideOffset={6}
        className="overflow-hidden p-0"
      >
        <LinkPreviewBody
          preview={data}
          showFallback={isError || !canFetch}
          url={url}
        />
      </HoverCardContent>
    </HoverCard>
  );
}

function LinkPreviewBody({
  preview,
  showFallback,
  url,
}: {
  preview: LinkPreviewDto | undefined;
  /** No fetch happened (or it failed) — skip the skeleton and show the static card. */
  showFallback: boolean;
  url: string;
}) {
  const hostname = displayHostname(url);

  if (showFallback || (preview && !preview.title && !preview.description)) {
    // No metadata available — still show where the link goes.
    return (
      <div className="w-72 p-3">
        <div className="flex items-center gap-x-1.5">
          <Favicon dataUri={preview?.faviconDataUri} />
          <p className="truncate text-sm font-semibold text-zinc-900">
            {hostname}
          </p>
        </div>
        <p className="truncate text-xs text-zinc-500">{url}</p>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="flex w-72 flex-col gap-y-1 p-3 text-left">
        <div className="animate-pulse" aria-hidden>
          <div className="mb-1.5 h-3.5 w-3/4 rounded bg-zinc-200" />
          <div className="mb-1.5 h-2.5 w-full rounded bg-zinc-100" />
          <div className="h-2.5 w-5/6 rounded bg-zinc-100" />
        </div>
        <div className="flex items-center gap-x-1.5">
          <p className="truncate text-[11px] font-medium text-zinc-500">
            {hostname}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-72 flex-col text-left">
      <div className="flex flex-col gap-y-1 p-3">
        {preview.title && (
          <p className="line-clamp-2 text-sm font-semibold text-zinc-900">
            {preview.title}
          </p>
        )}
        {preview.description && (
          <p className="line-clamp-3 text-xs leading-relaxed text-zinc-600">
            {preview.description}
          </p>
        )}
        <div className="flex items-center gap-x-1.5">
          <Favicon dataUri={preview.faviconDataUri} />
          <p className="truncate text-[11px] font-medium text-zinc-500">
            {preview.siteName ?? hostname}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The `data:` URI comes from the server, which only inlines raster formats
 * it validated by magic bytes — never a URL on the linked site's host.
 */
function Favicon({ dataUri }: { dataUri: string | undefined }) {
  if (!dataUri) return null;
  return (
    <img
      src={dataUri}
      alt=""
      aria-hidden
      className="h-4 w-4 shrink-0 rounded-sm"
    />
  );
}
