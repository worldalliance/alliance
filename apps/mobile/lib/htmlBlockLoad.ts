/**
 * Whether the HTML block's WebView loads `url` itself rather than handing it to
 * the link handler: its own document, `documentUrl`, an anchor in it, and
 * `about:blank`, which an iframe with no `src` loads.
 */
export const loadsInHtmlBlock = ({
  url,
  documentUrl,
}: {
  url: string;
  documentUrl: string;
}): boolean => url === "about:blank" || url.split("#")[0] === documentUrl;
