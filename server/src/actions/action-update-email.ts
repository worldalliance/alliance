import { safeMarkdownUrl } from "@alliance/common/markdown-url";
import { siteHref, withOrigin } from "@alliance/common/url";
import MarkdownIt, { type Token } from "markdown-it";
import { siteBaseUrl } from "src/search/approutes";

// Admin-authored HTML blocks pass through, as the web app renders them.
const markdown = new MarkdownIt({ html: true, linkify: true, breaks: true });

const URL_ATTRIBUTES = new Map([
  ["link_open", "href"],
  ["image", "src"],
]);

function absolutize(params: { tokens: Token[]; origin: string }) {
  const { tokens, origin } = params;
  for (const token of tokens) {
    const attribute = URL_ATTRIBUTES.get(token.type);
    const url = attribute ? token.attrGet(attribute) : null;
    if (attribute && url !== null) {
      const safe = safeMarkdownUrl({
        url,
        attribute,
        tagName: token.tag,
        apiUrl: `${origin}/api`,
      });
      token.attrSet(
        attribute,
        safe && withOrigin({ url: siteHref(safe), origin }),
      );
    }
    if (token.children) absolutize({ tokens: token.children, origin });
  }
}

/** An action update's Markdown email body as HTML, its site paths made absolute. */
export function actionUpdateEmailHtml(body: string): string {
  const origin = siteBaseUrl();
  if (!origin) {
    throw new Error("APP_URL is not set, so an email link has no host");
  }
  const tokens = markdown.parse(body, {});
  absolutize({ tokens, origin });
  return markdown.renderer.render(tokens, markdown.options, {});
}
