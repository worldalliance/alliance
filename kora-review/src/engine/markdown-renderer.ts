import type { MarkdownRendererCtx } from "./context.js";
import type { Inline } from "./markdown-parser.js";
import type { View } from "./types.js";

type Segment = { text: string; index: number; word: boolean };

export function createMarkdownRenderer(ctx: MarkdownRendererCtx) {
  const { h, mathNodes, mathText, parseBlocks, parseTex } = ctx;

  const segmenter =
    typeof Intl !== "undefined" && Intl.Segmenter
      ? new Intl.Segmenter(undefined, { granularity: "word" })
      : null;
  function segments(text: string): Segment[] {
    if (segmenter)
      return Array.from(segmenter.segment(text), (s) => ({
        text: s.segment,
        index: s.index,
        word: !!s.isWordLike,
      }));
    const out: Segment[] = [];
    const re = /\S+|\s+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)))
      out.push({ text: m[0], index: m.index, word: /\S/.test(m[0]) });
    return out;
  }
  function renderMarkdown(
    container: HTMLElement,
    src: string,
    mi: number,
    tokenize: boolean,
  ): View {
    const view: View = { mi, tokens: [], gaps: {}, content: src };
    let blk = 0;
    const emit = (parent: HTMLElement, text: string, start: number) => {
      if (!tokenize) {
        parent.append(text);
        return;
      }
      for (const sg of segments(text)) {
        if (sg.word) {
          const el = h(
            "span",
            { class: "tk", "data-m": mi, "data-t": view.tokens.length },
            sg.text,
          );
          view.tokens.push({
            start: start + sg.index,
            end: start + sg.index + sg.text.length,
            text: sg.text,
            el,
            blk,
          });
          parent.append(el);
        } else {
          const k = view.tokens.length - 1;
          const el = h(
            "span",
            { class: "gap", "data-m": mi, "data-after": k },
            sg.text,
          );
          (view.gaps[k] ||= []).push(el);
          parent.append(el);
        }
      }
    };
    const inl = (parent: HTMLElement, nodes: Inline[]) => {
      for (const n of nodes) {
        if (n.type === "text") emit(parent, n.text, n.start);
        else if (n.type === "strong") {
          const s = h("strong");
          inl(s, n.children);
          parent.append(s);
        } else if (n.type === "em") {
          const s = h("em");
          inl(s, n.children);
          parent.append(s);
        } else if (n.type === "code") {
          const c = h("code");
          emit(c, n.text, n.start);
          parent.append(c);
        } else if (n.type === "math") {
          const tree = parseTex(n.tex),
            text = mathText(tree).trim();
          const el = h(
            "span",
            {
              class: "math" + (n.display ? " display" : ""),
              role: "math",
              "aria-label": text,
            },
            mathNodes(tree),
          );
          if (tokenize) {
            el.classList.add("tk");
            el.dataset.m = String(mi);
            el.dataset.t = String(view.tokens.length);
            view.tokens.push({ start: n.start, end: n.end, text, el, blk });
          }
          parent.append(el);
        } else {
          const a = h("span", {
            class: "lnk",
            title: n.href,
            role: "link",
            "aria-disabled": "true",
          });
          inl(a, n.children);
          parent.append(a);
        }
      }
    };
    for (const b of parseBlocks(src)) {
      if (b.type === "p") {
        const p = h("p");
        inl(p, b.inl);
        container.append(p);
        blk++;
      } else if (b.type === "code") {
        const pre = h("pre"),
          c = h("code");
        emit(c, b.text, b.start);
        pre.append(c);
        container.append(pre);
        blk++;
      } else if (b.type === "hr") container.append(h("hr"));
      else if (b.type === "h") {
        const el = h("p", { class: "md-h md-h" + Math.min(b.level, 4) });
        inl(el, b.inl);
        container.append(el);
        blk++;
      } else if (b.type === "quote") {
        const q = h("blockquote");
        for (const l of b.lines) {
          const p = h("p");
          inl(p, l);
          q.append(p);
          blk++;
        }
        container.append(q);
      } else if (b.type === "table") {
        // Every cell is its own block, so a mark across cells reads with a space between them.
        const cells = (row: Inline[][], tag: "th" | "td") =>
          h(
            "tr",
            {},
            row.map((c) => {
              const el = h(tag);
              inl(el, c);
              blk++;
              return el;
            }),
          );
        container.append(
          h(
            "div",
            { class: "md-table" },
            h(
              "table",
              {},
              h("thead", {}, cells(b.head, "th")),
              h(
                "tbody",
                {},
                b.rows.map((r) => cells(r, "td")),
              ),
            ),
          ),
        );
      } else {
        const l = h(
          b.type,
          b.type === "ol" && b.items[0].num !== 1
            ? { start: b.items[0].num }
            : {},
        );
        for (const it of b.items) {
          const li = h("li", it.sub ? { class: "sub" } : {});
          inl(li, it.inl);
          l.append(li);
          blk++;
        }
        container.append(l);
      }
    }
    return view;
  }
  function spanText(v: View, lo: number, hi: number) {
    let s = "";
    for (let k = lo; k <= hi; k++) {
      s += v.tokens[k].text;
      if (k < hi) {
        s += (v.gaps[k] || []).map((g) => g.textContent).join("");
        if (v.tokens[k + 1].blk !== v.tokens[k].blk) s += " ";
      }
    }
    return s.replace(/\s+/g, " ").trim();
  }

  return { renderMarkdown, spanText };
}
