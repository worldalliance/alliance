/* eslint-disable @typescript-eslint/ban-ts-comment -- typed in the next step of the engine split */
// @ts-nocheck

export function createPresentation(ctx) {
  const { catLabel, fmt, h, hueOf, icon, vcls } = ctx;

  function catChip(c) {
    return h(
      "span",
      { class: "chip", style: `--h:${hueOf(c)}`, title: catLabel(c) },
      h("span", { class: "dot", "aria-hidden": "true" }),
      catLabel(c),
    );
  }
  function brandMark() {
    return h(
      "span",
      { class: "mark", "aria-hidden": "true" },
      h("b", { class: "p" }, "+1"),
      h("b", { class: "n" }, "−1"),
    );
  }

  // Challenge markup. [ … ] marks a clause the way a +1 or −1 mark looks in a reply, coloured by the :+1: or :-1: inside it,
  // which shows there as a small thumb. *text* is bold. Outside brackets, :+1: and :-1: are "+1"/"−1" chips.
  function challengeNodes(text) {
    const thumb = (v, small) =>
      small
        ? h(
            "span",
            {
              class: "cthumb " + vcls(v),
              role: "img",
              "aria-label": v > 0 ? "(plus one)" : "(minus one)",
            },
            icon(v > 0 ? "up" : "down"),
          )
        : h(
            "span",
            { class: "cicon " + vcls(v) },
            icon(v > 0 ? "up" : "down"),
            v > 0 ? "+1" : "−1",
          );
    const inline = (str, small) =>
      str
        .split(/(\*[^*\n]+\*|:\+1:|:-1:)/)
        .filter(Boolean)
        .map((p) =>
          p === ":+1:"
            ? thumb(1, small)
            : p === ":-1:"
              ? thumb(-1, small)
              : p.length > 2 && p[0] === "*" && p.endsWith("*")
                ? h("b", {}, p.slice(1, -1))
                : p,
        );
    return text
      .split(/(\[[^\]]+\])/)
      .filter(Boolean)
      .map((p) => {
        if (p[0] !== "[" || !p.endsWith("]")) return inline(p, false);
        const inner = p.slice(1, -1),
          v = inner.includes(":-1:") ? -1 : inner.includes(":+1:") ? 1 : 0;
        return h("span", { class: "cspan " + vcls(v) }, inline(inner, true));
      });
  }

  // A mark is +1, −1, or 0: a neutral note, shown with a pencil and counted towards neither side.
  const markCls = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "note");
  const markBadge = (v, cls) =>
    v
      ? h(
          "span",
          { class: cls + " " + vcls(v) },
          h("span", { "aria-hidden": "true" }, fmt(v)),
          h("span", { class: "sr" }, v > 0 ? "Plus one:" : "Minus one:"),
        )
      : h(
          "span",
          { class: cls + " v-note" },
          icon("pencil"),
          h("span", { class: "sr" }, "Note:"),
        );

  return { brandMark, catChip, challengeNodes, markBadge, markCls };
}
