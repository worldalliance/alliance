import { checkWiki, EntryKind, type RepoReader } from "./check";

/** An in-memory checkout of `files`, keyed by repo-relative path; directories are implied by the paths. */
function memoryRepo(files: Record<string, string>): RepoReader {
  const kind = (path: string) => {
    if (path in files) return EntryKind.File;
    return Object.keys(files).some((file) => file.startsWith(`${path}/`))
      ? EntryKind.Directory
      : undefined;
  };
  return {
    kind,
    read(path) {
      const text = files[path];
      if (text === undefined) throw new Error(`no fixture file ${path}`);
      return text;
    },
    list: (dir) =>
      [
        ...new Set(
          Object.keys(files)
            .filter((file) => file.startsWith(`${dir}/`))
            .map((file) => file.slice(dir.length + 1).split("/")[0] ?? ""),
        ),
      ].sort(),
  };
}

const RECORD = "01a00000-0000-7000-8000-000000000001-sample";

const INDEX = `# Wiki

## Members

- [Signup](signup.md) — how members join.
`;

const SIGNUP = `# Signup

## Email check

See [the handler](../../server/src/signup.ts#L2-L3) and [coverage](coverage.md).
`;

function coverage(rows: string[]): string {
  return `# Coverage

| Record | Disposition | Topics | Notes |
| --- | --- | --- | --- |
${rows.join("\n")}
`;
}

const CURRENT_ROW = `| [record](../provenance/${RECORD}/REQUIREMENTS.md) | current | [Signup](signup.md) | |`;

function fixture(overrides: Record<string, string | undefined> = {}) {
  const files: Record<string, string | undefined> = {
    "docs/wiki/index.md": INDEX,
    "docs/wiki/coverage.md": coverage([CURRENT_ROW]),
    "docs/wiki/signup.md": SIGNUP,
    [`docs/provenance/${RECORD}/REQUIREMENTS.md`]: "# Sample\n\n## Rules\n",
    "server/src/signup.ts": "export {};\nconst a = 1;\nconst b = 2;\n",
    ...overrides,
  };
  return memoryRepo(
    Object.fromEntries(
      Object.entries(files).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    ),
  );
}

function messages(overrides: Record<string, string | undefined> = {}) {
  return checkWiki(fixture(overrides)).problems.map(
    (p) => `${p.path}:${p.position.line}: ${p.message}`,
  );
}

test("a consistent wiki passes and counts pages and records", () => {
  expect(checkWiki(fixture())).toEqual({
    problems: [],
    pageCount: 3,
    recordCount: 1,
  });
});

test("a missing index or coverage file is reported before anything else", () => {
  expect(messages({ "docs/wiki/index.md": undefined })).toEqual([
    "docs/wiki/index.md:1: required wiki file is missing",
  ]);
  expect(messages({ "docs/wiki/coverage.md": undefined })).toEqual([
    "docs/wiki/coverage.md:1: required wiki file is missing",
  ]);
});

test("a link to a missing file fails at its line", () => {
  expect(
    messages({
      "docs/wiki/signup.md": `${SIGNUP}\nSee [gone](gone.md).\n`,
    }),
  ).toEqual([
    "docs/wiki/signup.md:7: broken link: docs/wiki/gone.md does not exist",
  ]);
});

test("a fragment must name a heading in the target page", () => {
  expect(
    messages({
      "docs/wiki/signup.md": `${SIGNUP}\n[Rules](../provenance/${RECORD}/REQUIREMENTS.md#rules) [Gone](index.md#gone) [Self](#email-check)\n`,
    }),
  ).toEqual(["docs/wiki/signup.md:7: no heading #gone in docs/wiki/index.md"]);
});

test("links written as raw HTML fail, since their targets go unchecked", () => {
  expect(
    messages({
      "docs/wiki/signup.md": `${SIGNUP}\n<img src="gone.png" width="400">\n\nSee <a href="gone.md">gone</a>.\n`,
    }),
  ).toEqual([
    "docs/wiki/signup.md:7: use Markdown link syntax so wikicheck can check this link",
    "docs/wiki/signup.md:9: use Markdown link syntax so wikicheck can check this link",
  ]);
});

test("source citations take only in-range line anchors", () => {
  expect(
    messages({
      "docs/wiki/signup.md": `${SIGNUP}\n[a](../../server/src/signup.ts#L4) [b](../../server/src/signup.ts#top) [c](../../server/src/empty.ts#L1) [d](../../server/src/signup.ts#L3-L2)\n`,
      "server/src/empty.ts": "",
    }),
  ).toEqual([
    "docs/wiki/signup.md:7: lines 4-4 are outside server/src/signup.ts, which has 3",
    'docs/wiki/signup.md:7: "../../server/src/signup.ts#top" cites a source file with a fragment other than #L<n> or #L<n>-L<m>',
    "docs/wiki/signup.md:7: lines 1-1 are outside server/src/empty.ts, which has 0",
    'docs/wiki/signup.md:7: "../../server/src/signup.ts#L3-L2" cites an empty or reversed line range',
  ]);
});

test("links must stay inside the repository and be relative", () => {
  expect(
    messages({
      "docs/wiki/signup.md": `${SIGNUP}\n[a](../../../etc/passwd) [b](/server/src/signup.ts) [c](https://example.com/x#y)\n`,
    }),
  ).toEqual([
    'docs/wiki/signup.md:7: "../../../etc/passwd" points outside the repository',
    'docs/wiki/signup.md:7: use a relative path instead of "/server/src/signup.ts"',
  ]);
});

test("a fragment on a directory link fails", () => {
  expect(
    messages({
      "docs/wiki/signup.md": `${SIGNUP}\n[a](../provenance/${RECORD}/#x)\n`,
    }),
  ).toEqual([
    `docs/wiki/signup.md:7: "../provenance/${RECORD}/#x" puts a fragment on a directory`,
  ]);
});

test("a page in any subdirectory needs a title and a place in the index", () => {
  expect(
    messages({
      "docs/wiki/members/extra.md": "Untitled\n",
      "docs/wiki/members/diagram.png": "",
    }),
  ).toEqual([
    "docs/wiki/members/extra.md:1: a wiki page starts with a level-one title",
    "docs/wiki/index.md:1: docs/wiki/members/extra.md is not listed in the index",
  ]);
});

test("a provenance directory without a coverage row fails", () => {
  expect(
    messages({
      "docs/provenance/01a00000-0000-7000-8000-000000000002-new/REQUIREMENTS.md":
        "# New\n",
    }),
  ).toEqual([
    "docs/wiki/coverage.md:1: docs/provenance/01a00000-0000-7000-8000-000000000002-new has no coverage row",
  ]);
});

test("misnamed Markdown and reference links in the ledger fail", () => {
  expect(
    messages({
      "docs/wiki/Other.MD": "no title [x](gone.md)\n",
      "docs/wiki/coverage.md": `${coverage([CURRENT_ROW, "| [r][x] | pending | | |"])}\n[x]: ../provenance/${RECORD}/\n`,
    }),
  ).toEqual([
    "docs/wiki/Other.MD:1: wiki pages use the .md extension",
    "docs/wiki/coverage.md:6: use inline links in coverage cells",
  ]);
});

test("a coverage row must name a provenance directory, not a loose file", () => {
  expect(
    messages({
      "docs/provenance/README.md": "# Provenance\n",
      "docs/wiki/coverage.md": coverage([
        CURRENT_ROW,
        "| [readme](../provenance/README.md) | pending | | |",
      ]),
    }),
  ).toEqual([
    "docs/wiki/coverage.md:6: docs/provenance/README.md is not a provenance directory",
  ]);
});

test("a malformed row or entry is reported alone, not also as missing", () => {
  expect(
    messages({
      "docs/wiki/index.md": "# Wiki\n\n## Members\n\n- [Signup](signup.md)\n",
      "docs/wiki/coverage.md": coverage([
        `| [record](../provenance/${RECORD}/REQUIREMENTS.md) | current | | |`,
      ]),
    }),
  ).toEqual([
    'docs/wiki/index.md:5: index entry "signup.md" needs a short description',
    "docs/wiki/coverage.md:5: current needs at least one topic page",
  ]);
});

test("a coverage row for a removed record fails as a broken link", () => {
  expect(
    messages({
      "docs/wiki/coverage.md": coverage([
        CURRENT_ROW,
        "| [gone](../provenance/01a00000-0000-7000-8000-00000000000f-gone/) | pending | | |",
      ]),
    }),
  ).toEqual([
    "docs/wiki/coverage.md:6: broken link: docs/provenance/01a00000-0000-7000-8000-00000000000f-gone does not exist",
  ]);
});
