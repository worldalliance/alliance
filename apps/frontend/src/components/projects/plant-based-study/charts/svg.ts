type Attrs = Record<string, string | number>;

const NS = "http://www.w3.org/2000/svg";

export function E<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs,
  parent?: Element,
): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(n);
  return n;
}
export function T(
  parent: Element,
  x: number,
  y: number,
  str: string,
  attrs?: Attrs,
): SVGTextElement {
  const t = E("text", { x, y, ...(attrs ?? {}) }, parent);
  t.textContent = str;
  return t;
}
export function mkSvg(
  container: HTMLElement,
  w: number,
  h: number,
): SVGSVGElement {
  const s = E("svg", {
    viewBox: `0 0 ${w} ${h}`,
    "aria-hidden": "true",
    focusable: "false",
  });
  container.appendChild(s);
  return s;
}
