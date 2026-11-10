/* eslint-disable @typescript-eslint/ban-ts-comment -- typed in the next step of the engine split */
// @ts-nocheck

export function createMarkdownParser(ctx) {
  const { mathAt } = ctx;

  /* ---------- Limited Markdown with source offsets ---------- */
  function listMatch(t) {
    let m = t.match(/^(\s*)([-*+])\s+/);
    if (m) return { ordered: false, indent: m[1].length, prefix: m[0].length };
    m = t.match(/^(\s*)(\d{1,3})[.)]\s+/);
    if (m)
      return {
        ordered: true,
        indent: m[1].length,
        num: +m[2],
        prefix: m[0].length,
      };
    return null;
  }
  const HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/,
    HEADING = /^\s{0,3}(#{1,6})\s+/,
    QUOTE = /^\s{0,3}>\s?/;
  const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
  // Cells of a table row as [start, end) offsets into src, trimmed, with the outer pipes dropped.
  function tableCells(L) {
    const cells = [];
    let from = 0;
    const t = L.text;
    for (let k = 0; k <= t.length; k++) {
      if (k < t.length && (t[k] !== "|" || t[k - 1] === "\\")) continue;
      let a = from,
        b = k;
      while (a < b && /\s/.test(t[a])) a++;
      while (b > a && /\s/.test(t[b - 1])) b--;
      cells.push([L.start + a, L.start + b]);
      from = k + 1;
    }
    if (/^\s*\|/.test(t)) cells.shift();
    if (/\|\s*$/.test(t)) cells.pop();
    return cells;
  }
  function parseBlocks(src) {
    const lines = [];
    let pos = 0;
    for (const text of src.split("\n")) {
      lines.push({ text, start: pos });
      pos += text.length + 1;
    }
    const blank = (l) => /^\s*$/.test(l.text),
      fence = (l) => /^\s*```/.test(l.text);
    const tableAt = (i) =>
      lines[i].text.includes("|") &&
      i + 1 < lines.length &&
      TABLE_SEP.test(lines[i + 1].text) &&
      lines[i + 1].text.includes("-");
    const startsBlock = (i) =>
      fence(lines[i]) ||
      HR.test(lines[i].text) ||
      HEADING.test(lines[i].text) ||
      QUOTE.test(lines[i].text) ||
      !!listMatch(lines[i].text) ||
      tableAt(i);
    const lineInl = (L, skip) =>
      parseInline(src, L.start + skip, L.start + L.text.trimEnd().length);
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
      const L = lines[i];
      if (blank(L)) {
        i++;
        continue;
      }
      if (fence(L)) {
        let j = i + 1;
        while (j < lines.length && !/^\s*```\s*$/.test(lines[j].text)) j++;
        const inner = lines.slice(i + 1, j);
        blocks.push({
          type: "code",
          start: inner.length ? inner[0].start : L.start + L.text.length,
          text: inner.map((l) => l.text).join("\n"),
        });
        i = j + 1;
        continue;
      }
      if (HR.test(L.text)) {
        blocks.push({ type: "hr" });
        i++;
        continue;
      }
      const hm = L.text.match(HEADING);
      if (hm) {
        blocks.push({
          type: "h",
          level: hm[1].length,
          inl: lineInl(L, hm[0].length),
        });
        i++;
        continue;
      }
      if (QUOTE.test(L.text)) {
        const q = { type: "quote", lines: [] };
        for (; i < lines.length && QUOTE.test(lines[i].text); i++)
          q.lines.push(lineInl(lines[i], lines[i].text.match(QUOTE)[0].length));
        blocks.push(q);
        continue;
      }
      if (tableAt(i)) {
        const row = (l) =>
          tableCells(l).map(([a, b]) => parseInline(src, a, b));
        const t = { type: "table", head: row(L), rows: [] };
        for (
          i += 2;
          i < lines.length && !blank(lines[i]) && lines[i].text.includes("|");
          i++
        )
          t.rows.push(row(lines[i]));
        blocks.push(t);
        continue;
      }
      const lm = listMatch(L.text);
      if (lm) {
        // One level of nesting: an indented item, of either kind, is shown as a sub-item of the list it sits in.
        const list = { type: lm.ordered ? "ol" : "ul", items: [] };
        while (i < lines.length) {
          const m = listMatch(lines[i].text);
          if (!m || (m.indent < 2 && m.ordered !== lm.ordered)) break;
          list.items.push({
            num: m.num,
            sub: m.indent >= 2,
            inl: lineInl(lines[i], m.prefix),
          });
          i++;
        }
        blocks.push(list);
        continue;
      }
      let j = i;
      while (j < lines.length && !blank(lines[j]) && !(j > i && startsBlock(j)))
        j++;
      blocks.push({
        type: "p",
        inl: parseInline(
          src,
          L.start,
          lines[j - 1].start + lines[j - 1].text.length,
        ),
      });
      i = j;
    }
    return blocks;
  }
  function parseInline(src, s, e) {
    const out = [];
    let i = s,
      from = s;
    const flush = (to) => {
      if (to > from)
        out.push({ type: "text", start: from, text: src.slice(from, to) });
    };
    const word = (ch) => ch && /[\p{L}\p{N}]/u.test(ch);
    while (i < e) {
      const c = src[i];
      if (c === "\\" || c === "$") {
        const m = mathAt(src, i, e);
        if (m) {
          flush(i);
          out.push({
            type: "math",
            start: m.start,
            end: m.end,
            tex: m.tex,
            display: m.display,
          });
          i = from = m.end;
          continue;
        }
      }
      if (c === "*" && src[i + 1] === "*") {
        const close = src.indexOf("**", i + 2);
        if (close > i + 2 && close + 2 <= e) {
          flush(i);
          out.push({
            type: "strong",
            children: parseInline(src, i + 2, close),
          });
          i = from = close + 2;
          continue;
        }
      }
      // *italic* or _italic_: the opener must touch a word, and an underscore must not sit inside one (snake_case stays as is).
      if (
        (c === "*" || c === "_") &&
        src[i + 1] &&
        !/\s/.test(src[i + 1]) &&
        src[i + 1] !== c &&
        !(c === "_" && word(src[i - 1]))
      ) {
        let close = src.indexOf(c, i + 1);
        while (
          close !== -1 &&
          close < e &&
          (/\s/.test(src[close - 1]) ||
            src[close + 1] === c ||
            (c === "_" && word(src[close + 1])))
        )
          close = src.indexOf(c, close + 1);
        if (close > i + 1 && close < e) {
          flush(i);
          out.push({ type: "em", children: parseInline(src, i + 1, close) });
          i = from = close + 1;
          continue;
        }
      }
      if (c === "`") {
        const close = src.indexOf("`", i + 1);
        if (close > i + 1 && close < e) {
          flush(i);
          out.push({
            type: "code",
            start: i + 1,
            text: src.slice(i + 1, close),
          });
          i = from = close + 1;
          continue;
        }
      }
      if (c === "[") {
        const m = /^\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(src.slice(i, e));
        if (m) {
          flush(i);
          out.push({
            type: "link",
            href: m[2],
            children: parseInline(src, i + 1, i + 1 + m[1].length),
          });
          i = from = i + m[0].length;
          continue;
        }
      }
      i++;
    }
    flush(e);
    return out;
  }

  return { parseBlocks };
}
