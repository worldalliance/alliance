import { getBaseUrl } from "@alliance/sharedweb/lib/config";

interface SocialPreviewOptions {
  /** Page title, used for the document title and og/twitter titles. */
  title: string;
  /** Short description for search results and link previews. */
  description?: string;
  /** An absolute URL or a root-relative path. Defaults to the site thumbnail. */
  image?: string;
  /** Root-relative canonical path for this page (e.g. "/signup"). */
  url?: string;
}

export const DEFAULT_PREVIEW_IMAGE = "/link-thumbnail.png";

/**
 * Builds an Open Graph + Twitter Card meta descriptor array for a route's
 * `meta()` export. Resolves root-relative image/url paths against the
 * environment's base URL so crawlers receive absolute URLs.
 */
export function socialPreviewMeta({
  title,
  description,
  image = DEFAULT_PREVIEW_IMAGE,
  url,
}: SocialPreviewOptions) {
  const base = getBaseUrl();
  const toAbsolute = (path: string) =>
    path.startsWith("http") ? path : `${base}${path}`;
  const imageUrl = image ? toAbsolute(image) : undefined;

  return [
    { title },
    { property: "og:title", content: title },
    { property: "og:site_name", content: "The Alliance" },
    { property: "og:type", content: "website" },
    ...(url ? [{ property: "og:url", content: toAbsolute(url) }] : []),
    ...(description
      ? [
          { name: "description", content: description },
          { property: "og:description", content: description },
        ]
      : []),
    ...(imageUrl
      ? [
          { property: "og:image", content: imageUrl },
          { name: "twitter:image", content: imageUrl },
        ]
      : []),
    {
      name: "twitter:card",
      content: imageUrl ? "summary_large_image" : "summary",
    },
    { name: "twitter:title", content: title },
    ...(description
      ? [{ name: "twitter:description", content: description }]
      : []),
  ];
}
