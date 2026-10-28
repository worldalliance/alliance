import { parseWikiDocument } from "./markdown";

test("headings get GitHub's anchors, with repeats numbered", () => {
  const document = parseWikiDocument(`# Sign up & log in

## Email \`check\`

## Email check

## Émigré rules
`);
  expect(document.title).toBe("Sign up & log in");
  expect(document.headings.map((h) => h.id)).toEqual([
    "sign-up--log-in",
    "email-check",
    "email-check-1",
    "émigré-rules",
  ]);
});

test("raw HTML and image alt text stay out of heading anchors and the title", () => {
  const document = parseWikiDocument(`# <b>Bold</b> title

## <a id="x"></a>Foo

## ![logo](x.png) Setup
`);
  expect(document.title).toBe("Bold title");
  expect(document.headings.map((h) => h.id)).toEqual([
    "bold-title",
    "foo",
    "-setup",
  ]);
});

test("front matter is neither a heading nor in the way of the title", () => {
  const document = parseWikiDocument(`---
user: x
task: y
---

# Title

## Rules
`);
  expect(document.title).toBe("Title");
  expect(document.headings.map((h) => h.id)).toEqual(["title", "rules"]);
});

test("raw HTML carrying a link is recorded, but comments are not", () => {
  const document = parseWikiDocument(`# T

<!-- see href=x -->

   <!-- indented href=x -->

See <a href="x.md">x</a>.

<!-- c --> <a href="y.md">y</a>

<picture><source srcset="z.png"></picture>

<span data-href="x">not a link</span>
`);
  expect(document.htmlLinks).toEqual([
    { line: 7, column: 5 },
    { line: 9, column: 1 },
    { line: 11, column: 10 },
  ]);
});

test("the title is only a leading level-one heading", () => {
  expect(parseWikiDocument("Intro\n\n# Later\n").title).toBeUndefined();
  expect(parseWikiDocument("# \n").title).toBeUndefined();
  expect(parseWikiDocument("# ![logo](x.png) Title\n").title).toBe("Title");
});

test("links include images, reference definitions, and table cells", () => {
  const document = parseWikiDocument(`# T

![img](a.png) [ref][r]

| a |
| - |
| [cell](b.md) |

[r]: c.md
`);
  expect(document.links.map((l) => [l.url, l.position.line])).toEqual([
    ["a.png", 3],
    ["b.md", 7],
    ["c.md", 9],
  ]);
});
