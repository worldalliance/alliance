export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

type Attr = readonly [string, string | number | undefined | null];

const attrs = (pairs: Attr[]): string =>
  pairs
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    )
    .map(([name, value]) => ` ${name}="${escapeXml(String(value))}"`)
    .join("");

export const tag = (name: string, pairs: Attr[], inner: string): string =>
  `<${name}${attrs(pairs)}>${inner}</${name}>`;
