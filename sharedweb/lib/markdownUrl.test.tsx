import { renderHook } from "@testing-library/react";
import type { Element } from "hast";
import React from "react";
import { defaultUrlTransform } from "react-markdown";
import { AuthoredLinkProvider, SiteAppProvider } from "../ui/SiteAppProvider";
import { imageSrcFromKey } from "./imageSrc";
import {
  resolveMarkdownImageSrc,
  transformMarkdownUrl,
  useMarkdownUrlTransform,
} from "./markdownUrl";

const element = (tagName: string): Element => ({
  type: "element",
  tagName,
  properties: {},
  children: [],
});

const IMG = element("img");
const ANCHOR = element("a");

describe("transformMarkdownUrl", () => {
  test("resolves an upload key in an image source", () => {
    expect(
      transformMarkdownUrl("1762925939234-8f14e45f.webp", "src", IMG),
    ).toBe(imageSrcFromKey("1762925939234-8f14e45f.webp"));
  });

  test("leaves an absolute image URL alone", () => {
    const url = "https://dj92mxbdjuclo.cloudfront.net/1770253183572.webp";

    expect(transformMarkdownUrl(url, "src", IMG)).toBe(url);
  });

  test("leaves a relative image path alone", () => {
    expect(transformMarkdownUrl("assets/logo.webp", "src", IMG)).toBe(
      "assets/logo.webp",
    );
  });

  test("leaves link hrefs unresolved, in-page anchors included", () => {
    expect(transformMarkdownUrl("#intro", "href", ANCHOR)).toBe("#intro");
    expect(transformMarkdownUrl("1762925939234.webp", "href", ANCHOR)).toBe(
      "1762925939234.webp",
    );
    expect(transformMarkdownUrl("/actions/12", "href", ANCHOR)).toBe(
      "/actions/12",
    );
  });

  test("strips dangerous protocols the built-in transform would have caught", () => {
    expect(transformMarkdownUrl("javascript:alert(1)", "href", ANCHOR)).toBe(
      "",
    );
    // The old `.webp` sniff neutralized this one only by accident.
    expect(
      transformMarkdownUrl("javascript:alert('x.webp')", "href", ANCHOR),
    ).toBe("");
    expect(transformMarkdownUrl("javascript:alert(1)", "src", IMG)).toBe("");
  });

  test("keeps protocols the built-in transform allows", () => {
    expect(transformMarkdownUrl("mailto:a@b.org", "href", ANCHOR)).toBe(
      "mailto:a@b.org",
    );
  });

  // `safeUrl` replaces `defaultUrlTransform` so mobile can share it. This
  // fails if a react-markdown upgrade moves the allowlist out from under it.
  test("accepts and rejects exactly what react-markdown's built-in does", () => {
    const urls = [
      "https://worldalliance.org/actions/12",
      "http://localhost:3000/images/1770255651460.webp",
      "mailto:contact@worldalliance.org",
      "xmpp:a@b.org",
      "irc://irc.example.org/room",
      "/actions/12",
      "#intro",
      "1770255651460.webp",
      "/actions/12?t=10:30",
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "about:reader?url=https%3A%2F%2Fexample.com",
      "worldalliance://actions/12",
      "vbscript:msgbox(1)",
    ];

    for (const url of urls) {
      expect(transformMarkdownUrl(url, "href", ANCHOR)).toBe(
        defaultUrlTransform(url),
      );
    }
  });
});

describe("resolveMarkdownImageSrc", () => {
  test("resolves the bare upload key an imgcap block carries", () => {
    expect(resolveMarkdownImageSrc("1762827853197.webp")).toBe(
      imageSrcFromKey("1762827853197.webp"),
    );
  });

  test("passes an absolute URL through instead of prefixing it", () => {
    const url = "https://worldalliance.org/api/images/1765308908685.webp";

    expect(resolveMarkdownImageSrc(url)).toBe(url);
  });

  test("does not turn a rejected URL into an images request", () => {
    expect(resolveMarkdownImageSrc("javascript:alert(1)")).toBe("");
  });
});

describe("useMarkdownUrlTransform", () => {
  const hrefIn = (wrapper: React.FC<React.PropsWithChildren>, url: string) =>
    renderHook(() => useMarkdownUrlTransform(), { wrapper }).result.current(
      url,
      "href",
      ANCHOR,
    );

  test("reduces a link to our own domain to a path", () => {
    expect(
      hrefIn(SiteAppProvider, "https://worldalliance.org/actions/135"),
    ).toBe("/actions/135");
  });

  test("leaves a link elsewhere absolute", () => {
    const url = "https://www.regulations.gov/document/FS-1";

    expect(hrefIn(SiteAppProvider, url)).toBe(url);
  });

  test("keeps the authored URL in an app that serves another domain", () => {
    const url = "https://worldalliance.org/actions/135";

    expect(hrefIn(AuthoredLinkProvider, url)).toBe(url);
  });

  test("fetches an image on our domain from the one being read", () => {
    expect(
      renderHook(() => useMarkdownUrlTransform(), {
        wrapper: SiteAppProvider,
      }).result.current(
        "https://worldalliance.org/api/images/1765308908685.webp",
        "src",
        IMG,
      ),
    ).toBe("/api/images/1765308908685.webp");
  });

  test("leaves an image hosted elsewhere alone", () => {
    const url = "https://dj92mxbdjuclo.cloudfront.net/1770253183572.webp";

    expect(
      renderHook(() => useMarkdownUrlTransform(), {
        wrapper: SiteAppProvider,
      }).result.current(url, "src", IMG),
    ).toBe(url);
  });

  test("still strips a dangerous protocol", () => {
    expect(hrefIn(SiteAppProvider, "javascript:alert(1)")).toBe("");
  });
});
