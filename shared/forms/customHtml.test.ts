import { buildCustomHtmlDocument, scopeCustomCss } from "./customHtml";

const SCOPE = '[data-alliance-custom-html="f1"]';

/** Collapses whitespace so assertions read as CSS rather than as formatting. */
const normalize = (css: string) => css.replace(/\s+/g, " ").trim();

describe("scopeCustomCss", () => {
  it("prefixes a plain rule", () => {
    expect(normalize(scopeCustomCss("#example { color: red; }", SCOPE))).toBe(
      `${SCOPE} #example { color: red; }`,
    );
  });

  it("prefixes every selector in a list", () => {
    expect(normalize(scopeCustomCss("h1, .intro p { margin: 0 }", SCOPE))).toBe(
      `${SCOPE} h1, ${SCOPE} .intro p { margin: 0 }`,
    );
  });

  it("keeps a bare element selector from reaching the rest of the form", () => {
    // The whole point of scoping: this must not restyle the form's own selects.
    expect(normalize(scopeCustomCss("select { border: 0 }", SCOPE))).toBe(
      `${SCOPE} select { border: 0 }`,
    );
  });

  it("maps document-level selectors onto the field's own wrapper", () => {
    // `[scope] body` would match nothing, and the author meant their own block.
    for (const selector of [":root", "html", "body", "&", "*"]) {
      expect(
        normalize(scopeCustomCss(`${selector} { color: red }`, SCOPE)),
      ).toBe(`${SCOPE} { color: red }`);
    }
  });

  it("scopes rules inside conditional at-rules", () => {
    expect(
      normalize(
        scopeCustomCss("@media (width < 500px) { .a { color: red } }", SCOPE),
      ),
    ).toBe(`@media (width < 500px) { ${SCOPE} .a { color: red } }`);
  });

  it("leaves keyframe selectors alone", () => {
    // `[scope] from` is not a selector; prefixing here breaks the animation.
    const css = "@keyframes spin { from { opacity: 0 } to { opacity: 1 } }";
    expect(normalize(scopeCustomCss(css, SCOPE))).toBe(normalize(css));
  });

  it("leaves @font-face descriptors alone", () => {
    const css = '@font-face { font-family: "X"; src: url(x.woff2) }';
    expect(normalize(scopeCustomCss(css, SCOPE))).toBe(normalize(css));
  });

  it("does not treat braces inside strings or comments as rule boundaries", () => {
    const css = `.a { content: "} not a rule {" } /* } */ .b { color: red }`;
    const scoped = normalize(scopeCustomCss(css, SCOPE));
    expect(scoped).toContain(`${SCOPE} .a {`);
    expect(scoped).toContain(`${SCOPE} .b {`);
  });

  it("does not split a selector list on a comma inside :is()", () => {
    expect(
      normalize(scopeCustomCss(":is(h1, h2) span { color: red }", SCOPE)),
    ).toBe(`${SCOPE} :is(h1, h2) span { color: red }`);
  });

  it("returns empty for empty or whitespace-only css", () => {
    expect(scopeCustomCss("", SCOPE)).toBe("");
    expect(scopeCustomCss("   \n ", SCOPE)).toBe("");
  });

  it("passes unbalanced css through rather than dropping it", () => {
    expect(scopeCustomCss(".a { color: red", SCOPE)).toBe(".a { color: red");
  });

  it("scopes a rule that follows a statement at-rule", () => {
    for (const statement of [
      "@import url('https://fonts.example/css?family=Inter;wght@400');",
      "@import url(https://fonts.example/css?family=Inter;wght@400);",
      '@import "a;b.css";',
      "@layer base, theme;",
      '@charset "utf-8";',
    ]) {
      expect(
        normalize(scopeCustomCss(`${statement} body p { color: red }`, SCOPE)),
      ).toBe(`${statement} ${SCOPE} body p { color: red }`);
    }
  });

  it("scopes rules after several statements", () => {
    expect(
      normalize(
        scopeCustomCss(
          '@charset "utf-8"; @layer a; select { border: 0 }',
          SCOPE,
        ),
      ),
    ).toBe(`@charset "utf-8"; @layer a; ${SCOPE} select { border: 0 }`);
  });

  it("does not treat a semicolon inside an attribute selector as a statement end", () => {
    expect(
      normalize(scopeCustomCss('[data-x="a;b"] { color: red }', SCOPE)),
    ).toBe(`${SCOPE} [data-x="a;b"] { color: red }`);
  });
});

describe("buildCustomHtmlDocument", () => {
  const build = (
    field: { html: string; css?: string; js?: string },
    value = "",
  ) =>
    buildCustomHtmlDocument({
      field,
      initialValue: value,
      postFunction: "function (message) { collect(message); }",
    });

  it("places the authored markup inside the scoped root", () => {
    expect(build({ html: "<b>hi</b>" })).toContain(
      '<div id="alliance-root"><b>hi</b></div>',
    );
  });

  it("scopes authored css to the root", () => {
    expect(build({ html: "", css: "p { color: red }" })).toContain(
      "#alliance-root p { color: red }",
    );
  });

  it("embeds the saved answer so it can be restored", () => {
    expect(build({ html: "" }, 'say "yes"')).toContain('"say \\"yes\\""');
  });

  it("wires the host's post function to both message kinds", () => {
    const document = build({ html: "" });
    expect(document).toContain("var __post = function (message) {");
    expect(document).toContain('type: "value"');
    expect(document).toContain('type: "height"');
  });

  it("declares utf-8 before any authored bytes", () => {
    // Loaded on its own rather than as srcdoc, the document has no parent to
    // inherit an encoding from; without this every non-ASCII character in the
    // authored markup or script is mojibake.
    const document = build({
      html: "<p>caf\u00e9 \u2014 \u201Cquoted\u201D</p>",
    });
    expect(document.indexOf('<meta charset="utf-8" />')).toBeLessThan(
      document.indexOf("caf\u00e9"),
    );
  });

  it("omits the script wrapper when no js was authored", () => {
    expect(build({ html: "<b>hi</b>" })).not.toContain("script failed");
  });
});
