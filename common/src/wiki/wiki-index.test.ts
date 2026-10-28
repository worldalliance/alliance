import { parseWikiDocument } from "./markdown";
import { parseWikiIndex } from "./wiki-index";

function parse(markdown: string) {
  const { groups, problems } = parseWikiIndex(parseWikiDocument(markdown));
  return {
    groups,
    problems: problems.map((p) => `${p.position.line}: ${p.message}`),
  };
}

test("groups and entries come from level-two headings and their lists", () => {
  const { groups, problems } = parse(`# Wiki

Intro paragraph.

## Members & access

- [Signup](signup.md) — how members **join**.
- [Login](auth/login.md): sessions.

## Admin

- [Signup](signup.md) - listed twice.
`);
  expect(problems).toEqual([]);
  expect(
    groups.map(({ title, entries }) => ({
      title,
      entries: entries.map(({ path, title, description }) => ({
        path,
        title,
        description,
      })),
    })),
  ).toEqual([
    {
      title: "Members & access",
      entries: [
        {
          path: "docs/wiki/signup.md",
          title: "Signup",
          description: "how members join.",
        },
        {
          path: "docs/wiki/auth/login.md",
          title: "Login",
          description: "sessions.",
        },
      ],
    },
    {
      title: "Admin",
      entries: [
        {
          path: "docs/wiki/signup.md",
          title: "Signup",
          description: "listed twice.",
        },
      ],
    },
  ]);
});

test("titles and descriptions are rendered text, and a group needs a title", () => {
  const { groups, problems } = parse(
    "# Wiki\n\n## Members <b>x</b>\n\n- [S <kbd>k</kbd>](s.md) — d <em>e</em>.\n\n##\n\n- [T](t.md) — t.\n",
  );
  expect(problems).toEqual(["7: index group needs a title"]);
  expect(groups[0]?.title).toBe("Members x");
  expect(groups[0]?.entries[0]).toMatchObject({
    title: "S k",
    description: "d e.",
  });
});

test("a double hyphen separates the description too", () => {
  expect(
    parse("# Wiki\n\n## G\n\n- [S](s.md) -- d.\n").groups[0]?.entries[0]
      ?.description,
  ).toBe("d.");
});

test("an entry wrapped onto a second line is reported", () => {
  expect(
    parse("# W\n\n## G\n\n- [S](s.md) — d\n  more text\n").problems,
  ).toEqual(["5: index entries are one line: a link and a short description"]);
});

test("blocks other than a list under a group are reported", () => {
  expect(
    parse("# W\n\nIntro.\n\n## G\n\n- [A](a.md) — a.\n\n> - [B](b.md) — b.\n")
      .problems,
  ).toEqual(["9: index groups hold only a list of entries"]);
});

test("the title may follow front matter", () => {
  expect(
    parse("---\ntags: x\n---\n\n# Wiki\n\n## G\n\n- [S](s.md) — d.\n").problems,
  ).toEqual([]);
});

test("malformed entries and nesting are reported at their lines", () => {
  expect(
    parse(`# Wiki

- [Early](early.md) — before any group.

## Group

- Plain text
- [External](https://example.com) — not a page.
- [Section](signup.md#part) — not a page either.
- [Coverage](coverage.md) — the ledger, not a topic.
- [Index](index.md) — the index itself.
- [Readme](../../README.md) — outside the wiki.
- [Signup](signup.md)
- [Login](login.md) — valid.
- [Parent](parent.md) — nests another entry.
  - [Nested](nested.md) — nested.
- [](untitled.md) — no title.
- [ ] [Task](task.md) — a task item.

### Too deep

## Empty

## Broken

- Only malformed entries, so not also empty.

# Stray
`).problems,
  ).toEqual([
    "3: index entries belong under a group",
    "7: index entry must start with a link to a topic page",
    '8: index entry "https://example.com" is not a topic page',
    '9: index entry "signup.md#part" is not a topic page',
    '10: index entry "coverage.md" is not a topic page',
    '11: index entry "index.md" is not a topic page',
    '12: index entry "../../README.md" is not a topic page',
    '13: index entry "signup.md" needs a short description',
    "15: index entries are one line: a link and a short description",
    '17: index entry "untitled.md" needs a title',
    "18: index entries are one line: a link and a short description",
    "20: index groups are one level deep",
    '22: index group "Empty" is empty',
    "26: index entry must start with a link to a topic page",
    "28: only the index title is a level-one heading",
  ]);
});
