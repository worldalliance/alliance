import { CoverageDisposition, parseCoverage } from "./coverage";
import { parseWikiDocument } from "./markdown";

const A = "../provenance/01a00000-0000-7000-8000-00000000000a-a";
const B = "../provenance/01a00000-0000-7000-8000-00000000000b-b";

function parse(
  rows: string[],
  header = "| Record | Disposition | Topics | Notes |",
) {
  const { entries, problems } = parseCoverage(
    parseWikiDocument(`# Coverage

${header}
| --- | --- | --- | --- |
${rows.join("\n")}
`),
  );
  return {
    entries,
    problems: problems.map((p) => `${p.position.line}: ${p.message}`),
  };
}

test("rows parse into records, dispositions, topics, and notes", () => {
  const { entries, problems } = parse([
    `| [req](${A}/REQUIREMENTS.md) [dec](${A}/DECISIONS.md) | current, superseded | [Signup](signup.md) [Login](auth/login.md#flow) | The 2024 rule was replaced. |`,
    `| [b](${B}/) | pending | | |`,
  ]);
  expect(problems).toEqual([]);
  expect(entries.map(({ position: _, ...entry }) => entry)).toEqual([
    {
      record: "docs/provenance/01a00000-0000-7000-8000-00000000000a-a",
      dispositions: [
        CoverageDisposition.Current,
        CoverageDisposition.Superseded,
      ],
      topics: ["docs/wiki/signup.md", "docs/wiki/auth/login.md"],
      notes: "The 2024 rule was replaced.",
    },
    {
      record: "docs/provenance/01a00000-0000-7000-8000-00000000000b-b",
      dispositions: [CoverageDisposition.Pending],
      topics: [],
      notes: "",
    },
  ]);
});

test("each disposition requires its evidence", () => {
  expect(
    parse([
      `| [a](${A}/) | current | | Notes alone. |`,
      `| [a](${A}/) | blocked | [Signup](signup.md) | |`,
      `| [a](${A}/) | unimplemented | | |`,
      `| [a](${A}/) | pending, current | [Signup](signup.md) | |`,
      `| [a](${A}/) | done | | |`,
      `| [a](${A}/) | | | |`,
      `| [a](${A}/) | pending, pending | | |`,
    ]).problems,
  ).toEqual([
    "5: current needs at least one topic page",
    "6: blocked needs notes explaining the disposition",
    "7: unimplemented needs notes explaining the disposition",
    "8: pending cannot be combined with other dispositions",
    "9: dispositions are a comma-separated list of: current, superseded, unimplemented, implementation-only, blocked, pending",
    "10: dispositions are a comma-separated list of: current, superseded, unimplemented, implementation-only, blocked, pending",
    "11: each disposition appears once",
  ]);
});

test("records and topics must link the right places", () => {
  expect(
    parse([
      `| [a](${A}/) [b](${B}/) | pending | | |`,
      "| no link | pending | | |",
      `| [a](https://github.com/x) | pending | | |`,
      `| [w](signup.md) | pending | | |`,
      `| [a](${A}/) | current | [Index](index.md) | |`,
      `| [a](${A}/) | current | [Out](../../server/x.ts) | |`,
      `| [a](${A}/) | pending |`,
    ]).problems,
  ).toEqual([
    "5: the Record cell links one provenance directory or its files",
    "6: the Record cell links one provenance directory or its files",
    '7: "https://github.com/x" is not a repository link',
    "8: the Record cell links one provenance directory or its files",
    "9: the Topics cell links only topic pages, not docs/wiki/index.md",
    "10: the Topics cell links only topic pages, not server/x.ts",
    "11: each row has 4 cells",
  ]);
});

test("a record listed twice points at its first row", () => {
  expect(
    parse([
      `| [a](${A}/) | pending | | |`,
      `| [a](${A}/DECISIONS.md) | pending | | |`,
    ]).problems,
  ).toEqual([
    "6: docs/provenance/01a00000-0000-7000-8000-00000000000a-a already has a row at line 5",
  ]);
});

test("the ledger needs exactly one table with the expected columns", () => {
  expect(parse([], "| Record | Status | Topics | Notes |").problems).toEqual([
    "3: coverage columns are: Record, Disposition, Topics, Notes",
  ]);
  expect(
    parseCoverage(parseWikiDocument("# Coverage\n")).problems.map(
      (p) => p.message,
    ),
  ).toEqual(["coverage holds exactly one table"]);
});
