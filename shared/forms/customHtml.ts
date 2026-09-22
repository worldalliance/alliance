/**
 * Runtime contract for `customhtml` fields, shared by the three places that
 * render authored HTML/CSS/JS: the web form, the mobile WebView, and the
 * admin builder's preview.
 *
 * The authored script runs with one global, `Alliance`:
 *
 *   Alliance.value                current answer (string, "" when unanswered)
 *   Alliance.setValue(v)          set the answer
 *   Alliance.onValue(cb)          observe answers set from anywhere
 *   Alliance.onDestroy(cb)        clean up when the field is removed
 *   Alliance.root                 the element the authored HTML was put in
 *
 * Alongside it, whichever element carries `data-alliance-value` is read
 * automatically on `input`/`change`, so markup like
 *
 *   <select data-alliance-value><option value="y">Yes</option></select>
 *
 * needs no script at all. A saved answer is written back onto that element
 * before the authored script runs, which is what makes resuming a form and
 * navigating back to a page restore the answer.
 */

/** Marks the element an answer is read from. */
export const CUSTOM_HTML_VALUE_ATTRIBUTE = "data-alliance-value";

/** Marks the wrapper authored CSS is scoped to. */
export const CUSTOM_HTML_SCOPE_ATTRIBUTE = "data-alliance-custom-html";

// ---------------------------------------------------------------------------
// CSS scoping
// ---------------------------------------------------------------------------

/**
 * At-rules whose body is a list of style rules, so their contents are scoped
 * like any other rule. Everything else — `@keyframes`, whose "selectors" are
 * `from`/`50%`; `@font-face` and `@page`, whose bodies are descriptors —
 * passes through untouched, because prefixing inside them produces CSS the
 * browser drops.
 */
const NESTED_STYLE_AT_RULES = new Set([
  "media",
  "supports",
  "container",
  "layer",
  "scope",
  "starting-style",
  "document",
]);

/**
 * Selectors that mean "the element this CSS lives in" once scoped. An author
 * writing `body { font-size: 20px }` means their own block, and
 * `<scope> body` would match nothing.
 */
const ROOT_SELECTORS = new Set([":root", "html", "body", "&", ":scope", "*"]);

/**
 * Scan to the matching `}`, respecting strings, comments and nesting, and
 * return the block's body plus what follows. Returns null for an unbalanced
 * block, which is authored CSS the browser would discard anyway.
 */
function readBlock(
  css: string,
  openIndex: number,
): { body: string; end: number } | null {
  let depth = 0;
  for (let i = openIndex; i < css.length; i++) {
    const char = css[i];
    if (char === "'" || char === '"') {
      i = skipString(css, i);
      continue;
    }
    if (char === "/" && css[i + 1] === "*") {
      i = skipComment(css, i);
      continue;
    }
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return { body: css.slice(openIndex + 1, i), end: i + 1 };
    }
  }
  return null;
}

function skipString(css: string, start: number): number {
  const quote = css[start];
  for (let i = start + 1; i < css.length; i++) {
    if (css[i] === "\\") i++;
    else if (css[i] === quote) return i;
  }
  return css.length;
}

function skipComment(css: string, start: number): number {
  const end = css.indexOf("*/", start + 2);
  return end === -1 ? css.length : end + 1;
}

/**
 * Drop comments from a selector list. They are inert to the browser, but a
 * comma inside one would otherwise split a selector in two.
 */
function stripComments(selectors: string): string {
  let out = "";
  for (let i = 0; i < selectors.length; i++) {
    const char = selectors[i];
    if (char === "'" || char === '"') {
      const end = skipString(selectors, i);
      out += selectors.slice(i, end + 1);
      i = end;
      continue;
    }
    if (char === "/" && selectors[i + 1] === "*") {
      i = skipComment(selectors, i);
      continue;
    }
    out += char;
  }
  return out;
}

/** Split a selector list on top-level commas, ignoring those inside `:is(…)`. */
function splitSelectorList(selectors: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < selectors.length; i++) {
    const char = selectors[i];
    if (char === "'" || char === '"') {
      const end = skipString(selectors, i);
      current += selectors.slice(i, end + 1);
      i = end;
      continue;
    }
    if (char === "(" || char === "[") depth++;
    else if (char === ")" || char === "]") depth--;
    else if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

function scopeSelectorList(selectors: string, scope: string): string {
  return splitSelectorList(selectors)
    .map((selector) => {
      const trimmed = selector.trim();
      if (!trimmed) return trimmed;
      if (ROOT_SELECTORS.has(trimmed)) return scope;
      return `${scope} ${trimmed}`;
    })
    .filter(Boolean)
    .join(", ");
}

/**
 * Prefix every style rule in `css` with `scope`, so authored CSS cannot reach
 * past its own field. `#example { color: red }` still applies to the author's
 * own `#example`; a stray `select { }` no longer restyles the rest of the form.
 *
 * This is a scanner, not a full CSS parser: it finds rule boundaries and
 * rewrites selector lists, and leaves declarations untouched.
 */
export function scopeCustomCss(css: string, scope: string): string {
  if (!css.trim()) return "";

  let out = "";
  let cursor = 0;

  while (cursor < css.length) {
    const braceIndex = findRuleStart(css, cursor);
    if (braceIndex === -1) {
      // Trailing text with no block: a stray `@import`, or junk. Either way it
      // declares nothing scopeable.
      out += css.slice(cursor);
      break;
    }

    const block = readBlock(css, braceIndex);
    if (!block) {
      out += css.slice(cursor);
      break;
    }

    // Statements like `@import …;` end at a `;` and share the scan up to the
    // next `{` with the rule after them; that rule still needs its scope.
    const statementsEnd = lastStatementEnd(css, cursor, braceIndex);
    out += css.slice(cursor, statementsEnd);
    const prelude = css.slice(statementsEnd, braceIndex);

    const trimmedPrelude = prelude.trim();
    if (trimmedPrelude.startsWith("@")) {
      const name = /^@([\w-]+)/.exec(trimmedPrelude)?.[1]?.toLowerCase() ?? "";
      out += NESTED_STYLE_AT_RULES.has(name)
        ? `${prelude}{${scopeCustomCss(block.body, scope)}}`
        : `${prelude}{${block.body}}`;
    } else {
      // Keep the prelude's leading whitespace so the output stays readable
      // and indented the way it was authored.
      const indent = /^\s*/.exec(prelude)?.[0] ?? "";
      out += `${indent}${scopeSelectorList(stripComments(prelude), scope)} {${block.body}}`;
    }

    cursor = block.end;
  }

  return out;
}

/**
 * Index just past the last top-level `;` in `css[from, to)`, skipping strings,
 * comments and parentheses, or `from` when there is none.
 */
function lastStatementEnd(css: string, from: number, to: number): number {
  let end = from;
  let depth = 0;
  for (let i = from; i < to; i++) {
    const char = css[i];
    if (char === "'" || char === '"') {
      i = skipString(css, i);
      continue;
    }
    if (char === "/" && css[i + 1] === "*") {
      i = skipComment(css, i);
      continue;
    }
    if (char === "(" || char === "[") depth++;
    else if (char === ")" || char === "]") depth--;
    else if (char === ";" && depth === 0) end = i + 1;
  }
  return end;
}

/** Index of the `{` that opens the next rule, skipping strings and comments. */
function findRuleStart(css: string, from: number): number {
  for (let i = from; i < css.length; i++) {
    const char = css[i];
    if (char === "'" || char === '"') {
      i = skipString(css, i);
      continue;
    }
    if (char === "/" && css[i + 1] === "*") {
      i = skipComment(css, i);
      continue;
    }
    if (char === "{") return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Value reading
// ---------------------------------------------------------------------------

/**
 * Read an answer off the marked element. `.value` covers inputs, selects and
 * textareas; a checkbox reports its checked state, since its `.value` is a
 * constant the author set; an element containing radios reports the checked
 * one's value, which is how a radio group is marked; anything else falls back
 * to its text, which is what a widget built from divs would put there.
 *
 * Written as a string of source rather than a function because the mobile
 * renderer has to inject it into a WebView document, where it cannot close
 * over anything in this module.
 */
const READ_VALUE_SOURCE = `
  function readValue(element) {
    if (!element) return "";
    var tag = element.tagName;
    if (tag === "INPUT" && (element.type === "checkbox" || element.type === "radio")) {
      return element.checked ? (element.value || "true") : "";
    }
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
      return element.value == null ? "" : String(element.value);
    }
    if (element.querySelector('input[type="radio"]')) {
      var checked = element.querySelector('input[type="radio"]:checked');
      return checked ? checked.value : "";
    }
    if (element.isContentEditable) return element.textContent || "";
    if (element.value != null) return String(element.value);
    return element.textContent || "";
  }
`;

/**
 * Source for the `Alliance` global and the auto-capture wiring, given
 * expressions for the root element and the initial value, and the name of a
 * function to call with each new answer.
 *
 * Both renderers build the same object this way, so a script written against
 * one behaves the same in the other.
 */
export function customHtmlRuntimeSource(params: {
  rootExpression: string;
  initialValueExpression: string;
  /** Called with the new answer, as a string. */
  publishFunction: string;
}): string {
  const { rootExpression, initialValueExpression, publishFunction } = params;
  return `
    ${READ_VALUE_SOURCE}
    var __root = ${rootExpression};
    var __value = ${initialValueExpression} || "";
    var __listeners = [];
    var __cleanups = [];
    var __publish = ${publishFunction};

    // Run whatever the authored script registered, when the field goes away:
    // its own timers, observers and document-level listeners, which removing
    // the markup would otherwise leave running.
    function __runDestroy() {
      for (var i = 0; i < __cleanups.length; i++) {
        try { __cleanups[i](); } catch (error) { console.error(error); }
      }
      __cleanups = [];
      __listeners = [];
    }

    function __setValue(next) {
      var normalized = next == null ? "" : String(next);
      if (normalized === __value) return;
      __value = normalized;
      Alliance.value = normalized;
      __publish(normalized);
      for (var i = 0; i < __listeners.length; i++) {
        try { __listeners[i](normalized); } catch (error) { console.error(error); }
      }
    }

    var Alliance = {
      root: __root,
      value: __value,
      setValue: __setValue,
      onValue: function (callback) { __listeners.push(callback); },
      onDestroy: function (callback) { __cleanups.push(callback); },
    };

    var __marked = __root.querySelector("[${CUSTOM_HTML_VALUE_ATTRIBUTE}]");
    if (__marked) {
      // Restore a saved answer before the authored script runs, so a script
      // reading its own control on startup sees the restored value.
      if (__value) {
        var __tag = __marked.tagName;
        if (__tag === "INPUT" && (__marked.type === "checkbox" || __marked.type === "radio")) {
          __marked.checked = true;
        } else if (__tag === "INPUT" || __tag === "SELECT" || __tag === "TEXTAREA") {
          __marked.value = __value;
        } else if (__marked.querySelector('input[type="radio"]')) {
          var __radios = __marked.querySelectorAll('input[type="radio"]');
          for (var __i = 0; __i < __radios.length; __i++) {
            __radios[__i].checked = __radios[__i].value === __value;
          }
        } else if (__marked.isContentEditable) {
          __marked.textContent = __value;
        }
      } else {
        // Nothing saved: adopt whatever the markup already shows, so a select
        // sitting on its first option counts as answered rather than empty.
        __setValue(readValue(__marked));
      }
      var __onInput = function () { __setValue(readValue(__marked)); };
      __marked.addEventListener("input", __onInput);
      __marked.addEventListener("change", __onInput);
    }
  `;
}

/** Wraps authored JS so a `return` or a syntax error cannot escape the field. */
export function wrapAuthoredScript(js: string | undefined): string {
  if (!js || !js.trim()) return "";
  return `
    try {
      (function () {
        ${js}
      })();
    } catch (error) {
      console.error("[custom html field] script failed:", error);
    }
  `;
}

// ---------------------------------------------------------------------------
// Standalone document
// ---------------------------------------------------------------------------

/**
 * Defaults for a document rendering a field on its own — the mobile WebView and
 * the admin builder's preview. Authored CSS comes after and overrides any of
 * it without needing extra specificity.
 */
export const CUSTOM_HTML_BASE_STYLES = `
  html, body { margin: 0; padding: 0; background: transparent; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 15px;
    line-height: 1.5;
    color: #18181b;
    overflow-wrap: break-word;
    -webkit-text-size-adjust: 100%;
  }
  a { color: rgb(98, 161, 36); }
  img, video { max-width: 100%; height: auto; }
  table { display: block; max-width: 100%; overflow-x: auto; }
`;

/** Wrapper the authored markup is placed in, and what its CSS is scoped to. */
const DOCUMENT_ROOT_ID = "alliance-root";

/**
 * Build a whole document rendering one field, for the hosts that cannot put the
 * markup in their own page: the mobile WebView, and the builder's preview.
 *
 * `postFunction` is JS source for a function taking one JSON-serializable
 * message — each host bridges it differently — and receives two kinds:
 *
 *   { type: "value", value: string }   the answer changed
 *   { type: "height", height: number } the document resized
 *
 * The height message exists because neither host can size itself around
 * content it does not control.
 */
export function buildCustomHtmlDocument(params: {
  field: { html: string; css?: string; js?: string };
  initialValue: string;
  postFunction: string;
  baseStyles?: string;
}): string {
  const { field, initialValue, postFunction, baseStyles } = params;

  // The document is already its own scope; scoping still matters so `body` and
  // `:root` rules land on the wrapper rather than fighting the base styles.
  const scopedCss = scopeCustomCss(field.css ?? "", `#${DOCUMENT_ROOT_ID}`);

  const runtime = customHtmlRuntimeSource({
    rootExpression: `document.getElementById(${JSON.stringify(DOCUMENT_ROOT_ID)})`,
    initialValueExpression: JSON.stringify(initialValue),
    publishFunction: `function (next) { __post({ type: "value", value: next }); }`,
  });

  return `<!doctype html>
<html>
  <head>
    <!-- First thing in the head, before any authored bytes: a srcdoc document
         inherits its parent's encoding, but one loaded on its own (the mobile
         WebView) falls back to the locale default and renders every non-ASCII
         character as mojibake. -->
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${baseStyles ?? CUSTOM_HTML_BASE_STYLES}</style>
    <style>${scopedCss}</style>
  </head>
  <body>
    <div id="${DOCUMENT_ROOT_ID}">${field.html}</div>
    <script>
      var __post = ${postFunction};
      (function () {
        try {
          ${runtime}
          ${wrapAuthoredScript(field.js)}
        } catch (error) {
          console.error("[custom html field] failed to initialize:", error);
        }
      })();
      (function () {
        var root = document.getElementById(${JSON.stringify(DOCUMENT_ROOT_ID)});
        function report() {
          // Measure the wrapper, not the document: an iframe's documentElement
          // reports its viewport height, which would pad every short field out
          // to whatever the host guessed first.
          var rect = root.getBoundingClientRect();
          __post({ type: "height", height: Math.ceil(rect.bottom + window.scrollY) });
        }
        new ResizeObserver(report).observe(root);
        report();
      })();
    </script>
  </body>
</html>`;
}
