import { R, type Result } from "@alliance/common/result";
import {
  findWaitlistEmailPlaceholders,
  replaceWaitlistEmailPlaceholders,
  WaitlistEmailPlaceholder,
  waitlistEmailToken,
} from "@alliance/common/waitlistEmail";
import { randomBytes } from "crypto";
import MarkdownIt, { type Token } from "markdown-it";

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true });
// Linking after emphasis parses, rather than during, keeps a closing `_` out
// of the URL before it.
markdown.inline.ruler.disable("linkify");

export type WaitlistEmailValues = Record<
  WaitlistEmailPlaceholder,
  string | null
>;

const IS_LINK: Record<WaitlistEmailPlaceholder, boolean> = {
  [WaitlistEmailPlaceholder.Name]: false,
  [WaitlistEmailPlaceholder.OrganizationName]: false,
  [WaitlistEmailPlaceholder.SignupLink]: true,
  [WaitlistEmailPlaceholder.PersonalShareLink]: true,
};

// Values go in after Markdown parses the body, so an entrant's name can't add
// formatting, links, or HTML, and goes into a link target URL-encoded, so it
// can't pick its scheme. A link placeholder parses as a URL, so it links
// wherever a typed URL would and stays plain inside link text or code.
const SENTINEL_ID = randomBytes(6).toString("hex");
const sentinel = (placeholder: WaitlistEmailPlaceholder): string =>
  IS_LINK[placeholder]
    ? `https://${SENTINEL_ID}-${placeholder.toLowerCase()}.invalid/`
    : `${SENTINEL_ID}${placeholder}${SENTINEL_ID}`;

const TEXT_SENTINELS = Object.values(WaitlistEmailPlaceholder)
  .filter((placeholder) => !IS_LINK[placeholder])
  .map((placeholder) => sentinel(placeholder).toLowerCase());

// Linkify reads a name placeholder followed by something like `.com` as a
// domain; the entrant's name stays text instead of becoming every recipient's
// own broken link. A name after the host, as in a query, stays linked.
const unlinkText = (tokens: Token[]): Token[] => {
  const kept: Token[] = [];
  let unlinking = false;
  for (const token of tokens) {
    const href = token.attrGet("href")?.toLowerCase() ?? "";
    const authority = /^[a-z][\w+.-]*:(\/\/)?[^/?#]*/.exec(href)?.[0] ?? href;
    if (
      token.type === "link_open" &&
      token.markup === "linkify" &&
      TEXT_SENTINELS.some((textSentinel) => authority.includes(textSentinel))
    ) {
      unlinking = true;
    } else if (unlinking && token.type === "link_close") {
      unlinking = false;
    } else {
      kept.push(token);
    }
  }
  return kept;
};

const fillTokens = (params: {
  tokens: Token[];
  used: Set<WaitlistEmailPlaceholder>;
  valueOf: (placeholder: WaitlistEmailPlaceholder) => string;
}): void => {
  const { tokens, used, valueOf } = params;
  const fill = (text: string, inUrl: boolean): string => {
    let filled = text;
    for (const placeholder of used) {
      const value = valueOf(placeholder);
      filled = filled
        .split(sentinel(placeholder))
        .join(
          inUrl && !IS_LINK[placeholder] ? encodeURIComponent(value) : value,
        );
    }
    return filled;
  };
  for (const token of tokens) {
    token.content = fill(token.content, false);
    token.info = fill(token.info, false);
    token.attrs =
      token.attrs?.map(([name, value]) => [
        name,
        fill(value, name === "href" || name === "src"),
      ]) ?? null;
    if (token.children) {
      token.children = unlinkText(token.children);
      fillTokens({ tokens: token.children, used, valueOf });
    }
  }
};

export const missingValuesMessage = (
  missing: WaitlistEmailPlaceholder[],
): string => `No value for ${missing.map(waitlistEmailToken).join(", ")}`;

export type RenderedWaitlistEmail = { subject: string; bodyHtml: string };

/** Fails with the placeholders the content uses that have no value. */
export function renderWaitlistEmail(params: {
  subject: string;
  body: string;
  values: WaitlistEmailValues;
}): Result<RenderedWaitlistEmail, WaitlistEmailPlaceholder[]> {
  const { subject, body, values } = params;
  const { used, unknown } = findWaitlistEmailPlaceholders([subject, body]);
  if (unknown.length) {
    throw new Error(`unknown waitlist email placeholders: ${unknown}`);
  }
  const missing = [...used].filter(
    (placeholder) => values[placeholder] === null,
  );
  if (missing.length) {
    return R.failure(missing);
  }
  const valueOf = (placeholder: WaitlistEmailPlaceholder): string =>
    (values[placeholder] ?? "").replace(/\s+/g, " ").trim();
  const tokens = markdown.parse(
    replaceWaitlistEmailPlaceholders(body, sentinel),
    {},
  );
  fillTokens({ tokens, used, valueOf });
  return R.success({
    subject: replaceWaitlistEmailPlaceholders(subject, valueOf),
    bodyHtml: markdown.renderer.render(tokens, markdown.options, {}),
  });
}
