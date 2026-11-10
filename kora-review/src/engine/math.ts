/* eslint-disable @typescript-eslint/ban-ts-comment -- typed in the next step of the engine split */
// @ts-nocheck

export function createMath(ctx) {
  const { h } = ctx;

  /* ---------- Math: a small LaTeX subset (what chat models write for school maths) ---------- */
  // \( \) and $ $ are inline; \[ \] and $$ $$ are display. A single $ counts as maths only when it reads like a formula,
  // so prices ("$40k", "$10 = pick my loadout") stay as text.
  const MATH_SYM = {
    cdot: "·",
    times: "×",
    div: "÷",
    pm: "±",
    mp: "∓",
    Rightarrow: "⇒",
    rightarrow: "→",
    to: "→",
    Leftarrow: "⇐",
    leftarrow: "←",
    Leftrightarrow: "⇔",
    iff: "⇔",
    implies: "⇒",
    le: "≤",
    leq: "≤",
    ge: "≥",
    geq: "≥",
    neq: "≠",
    ne: "≠",
    approx: "≈",
    equiv: "≡",
    sim: "∼",
    infty: "∞",
    pi: "π",
    theta: "θ",
    alpha: "α",
    beta: "β",
    gamma: "γ",
    delta: "δ",
    Delta: "Δ",
    lambda: "λ",
    mu: "μ",
    sigma: "σ",
    Sigma: "Σ",
    omega: "ω",
    degree: "°",
    circ: "°",
    checkmark: "✓",
    ldots: "…",
    dots: "…",
    cdots: "⋯",
    percent: "%",
    angle: "∠",
    triangle: "△",
    perp: "⊥",
    parallel: "∥",
    ",": " ",
    ";": " ",
    ":": " ",
    "!": "",
    quad: " ",
    qquad: "  ",
    " ": " ",
    "%": "%",
    $: "$",
    "{": "{",
    "}": "}",
    "&": "&",
    "#": "#",
    _: "_",
  };
  const MATH_OPS = new Set([
    "=",
    "+",
    "−",
    "×",
    "·",
    "÷",
    "±",
    "⇒",
    "→",
    "⇐",
    "←",
    "⇔",
    "≤",
    "≥",
    "≠",
    "≈",
    "≡",
    "<",
    ">",
  ]);
  const MATH_DROP = new Set([
    "left",
    "right",
    "big",
    "Big",
    "bigg",
    "displaystyle",
    "textstyle",
    "mathrm",
    "mathbf",
    "mathit",
    "operatorname",
  ]);
  function mathAt(src, i, e) {
    const c = src[i];
    const pairs = [
      ["\\(", "\\)", false],
      ["\\[", "\\]", true],
      ["$$", "$$", true],
    ];
    for (const [op, cl, display] of pairs) {
      if (!src.startsWith(op, i)) continue;
      const close = src.indexOf(cl, i + op.length);
      if (
        close > i + op.length &&
        close + cl.length <= e &&
        src.slice(i + op.length, close).trim()
      )
        return {
          start: i,
          end: close + cl.length,
          tex: src.slice(i + op.length, close),
          display,
        };
      return null;
    }
    if (
      c !== "$" ||
      src[i - 1] === "\\" ||
      src[i - 1] === "$" ||
      /[\p{L}\p{N}]/u.test(src[i - 1] || "") ||
      !src[i + 1] ||
      /\s/.test(src[i + 1])
    )
      return null;
    const nl = src.indexOf("\n", i);
    const lineEnd = Math.min(e, nl === -1 ? e : nl);
    const close = src.indexOf("$", i + 1);
    if (
      close === -1 ||
      close >= lineEnd ||
      /\s/.test(src[close - 1]) ||
      /[\p{L}\p{N}]/u.test(src[close + 1] || "")
    )
      return null;
    const tex = src.slice(i + 1, close);
    // Reads like a formula: no prose words (three or more letters outside \commands and \text{}), and maths in it.
    const bare = tex
      .replace(/\\text\{[^}]*\}/g, "")
      .replace(/\\[a-zA-Z]+/g, "");
    if (
      /[a-zA-Z]{3,}/.test(bare) ||
      !/[=+\-^_\\<>]|^\d*(\.\d+)?[a-zA-Z]$/.test(tex)
    )
      return null;
    return { start: i, end: close + 1, tex, display: false };
  }
  // Parses the TeX into a small tree: strings, {t:'frac'|'sup'|'sub'|'sqrt'|'text'|'box', ...}.
  function parseTex(tex) {
    let i = 0;
    const group = () => {
      while (tex[i] === " ") i++;
      if (tex[i] === "{") {
        i++;
        const g = seq("}");
        i++;
        return g;
      }
      if (tex[i] === "\\") {
        const a = atom();
        return a == null ? [] : [a];
      }
      return i < tex.length ? [tex[i++]] : [];
    };
    const rawGroup = () => {
      while (tex[i] === " ") i++;
      if (tex[i] !== "{") return i < tex.length ? tex[i++] : "";
      let depth = 0;
      const from = ++i;
      for (; i < tex.length; i++) {
        if (tex[i] === "{") depth++;
        else if (tex[i] === "}") {
          if (!depth) break;
          depth--;
        }
      }
      return tex.slice(from, i++);
    };
    const atom = () => {
      const c = tex[i];
      if (c === "\\") {
        const m = /^\\([a-zA-Z]+|.)/.exec(tex.slice(i));
        i += m[0].length;
        const name = m[1];
        if (name === "frac" || name === "dfrac" || name === "tfrac") {
          const num = group(),
            den = group();
          return { t: "frac", num, den };
        }
        if (name === "sqrt") {
          return { t: "sqrt", body: group() };
        }
        if (name === "text" || name === "textbf" || name === "mbox") {
          return { t: "text", text: rawGroup() };
        }
        if (name === "boxed") {
          return { t: "box", body: group() };
        }
        if (name === "overline" || name === "bar") {
          return { t: "over", body: group() };
        }
        if (MATH_DROP.has(name)) return null;
        if (name in MATH_SYM) return MATH_SYM[name];
        return name;
      }
      if (c === "{") {
        i++;
        const g = seq("}");
        i++;
        return { t: "grp", body: g };
      }
      i++;
      return c === "-" ? "−" : c === "*" ? "×" : c;
    };
    const seq = (end) => {
      const out = [];
      while (i < tex.length && tex[i] !== end) {
        if (tex[i] === "^" || tex[i] === "_") {
          const t = tex[i++] === "^" ? "sup" : "sub";
          out.push({ t, body: group() });
          continue;
        }
        if (tex[i] === "\n" || tex[i] === "\t") {
          i++;
          out.push(" ");
          continue;
        }
        if (tex[i] === "&") {
          i++;
          continue;
        }
        if (tex.startsWith("\\\\", i)) {
          i += 2;
          out.push("\n");
          continue;
        }
        const a = atom();
        if (a != null) out.push(a);
      }
      return out;
    };
    return seq(null);
  }
  // The tree as nodes for the page, and as plain text (what a mark's quoted text and the export show).
  function mathNodes(tree) {
    const out = [];
    let prev = null;
    const operand = (x) =>
      x != null &&
      x !== " " &&
      !(typeof x === "string" && (MATH_OPS.has(x) || x === "(" || x === "["));
    for (let k = 0; k < tree.length; k++) {
      const x = tree[k];
      if (typeof x === "string") {
        if (x === " ") continue;
        if (x === "\n") {
          out.push(h("br"));
          prev = null;
          continue;
        }
        // A sign is spaced as an operator only between two operands: "6x − 12", not "(−4)".
        if (
          MATH_OPS.has(x) &&
          !((x === "−" || x === "+" || x === "±") && !operand(prev))
        ) {
          out.push(h("span", { class: "mo" }, x));
          prev = x;
          continue;
        }
        out.push(
          /^[a-zA-Z]$/.test(x)
            ? h("i", {}, x)
            : x.length > 1 && /^[a-zA-Z]+$/.test(x)
              ? h("span", { class: "mfn" }, x)
              : x,
        );
        prev = x;
        continue;
      }
      if (x.t === "frac")
        out.push(
          h(
            "span",
            { class: "mfrac" },
            h("span", { class: "mnum" }, mathNodes(x.num)),
            h("span", { class: "mden" }, mathNodes(x.den)),
          ),
        );
      else if (x.t === "sup") out.push(h("sup", {}, mathNodes(x.body)));
      else if (x.t === "sub") out.push(h("sub", {}, mathNodes(x.body)));
      else if (x.t === "sqrt")
        out.push(
          h(
            "span",
            { class: "msqrt" },
            "√",
            h("span", { class: "mrad" }, mathNodes(x.body)),
          ),
        );
      else if (x.t === "text") out.push(h("span", { class: "mtext" }, x.text));
      else if (x.t === "box")
        out.push(h("span", { class: "mbox" }, mathNodes(x.body)));
      else if (x.t === "over")
        out.push(h("span", { class: "mover" }, mathNodes(x.body)));
      else out.push(...mathNodes(x.body));
      prev = "x";
    }
    return out;
  }
  const SUP = {
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
    "−": "⁻",
    "+": "⁺",
    n: "ⁿ",
  };
  function mathText(tree) {
    let s = "",
      prev = null;
    const operand = (x) =>
      x != null &&
      x !== " " &&
      !(typeof x === "string" && (MATH_OPS.has(x) || x === "(" || x === "["));
    const wrap = (t) => (t.length > 1 && /[^\w.]/.test(t) ? `(${t})` : t);
    for (const x of tree) {
      if (typeof x === "string") {
        const unary = (x === "−" || x === "+" || x === "±") && !operand(prev);
        s += MATH_OPS.has(x) && !unary ? ` ${x} ` : x === "\n" ? " " : x;
        if (x !== " ") prev = x;
        continue;
      }
      prev = "x";
      const body = x.body && mathText(x.body).trim();
      if (x.t === "frac")
        s += `${wrap(mathText(x.num).trim())}/${wrap(mathText(x.den).trim())}`;
      else if (x.t === "sup")
        s += [...body].every((ch) => SUP[ch])
          ? [...body].map((ch) => SUP[ch]).join("")
          : `^${wrap(body)}`;
      else if (x.t === "sub") s += `_${wrap(body)}`;
      else if (x.t === "sqrt") s += `√${wrap(body)}`;
      else if (x.t === "text") s += x.text;
      else s += body;
    }
    return s.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")");
  }

  return { mathAt, mathNodes, mathText, parseTex };
}
