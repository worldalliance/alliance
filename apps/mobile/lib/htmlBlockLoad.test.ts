import { expect, it } from "bun:test";
import { loadsInHtmlBlock } from "./htmlBlockLoad";

const site = "https://thealliance.org";
const documentUrl = `${site}/html-block`;
const loads = (url: string) => loadsInHtmlBlock({ url, documentUrl });

it("loads its own document", () => {
  expect(loads(documentUrl)).toBe(true);
  expect(loads("about:blank")).toBe(true);
});

it("keeps an anchor in its own document", () => {
  expect(loads(`${documentUrl}#faq`)).toBe(true);
});

it("hands a link to the site, resolved against the document, to the link handler", () => {
  expect(loads(`${site}/actions/53`)).toBe(false);
  expect(loads(`${site}/actions/53#faq`)).toBe(false);
  expect(loads(site)).toBe(false);
  expect(loads(`${site}/`)).toBe(false);
  expect(loads(`${site}/#join`)).toBe(false);
});
