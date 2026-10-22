import { makeFormResponse, makeUser } from "@alliance/shared/lib/testFixtures";
import { buildResponsesCsv } from "./responsesCsvExport";

it("writes one row per response with uniquely named question columns", () => {
  const response = makeFormResponse({
    id: 3,
    sid: "s1",
    answers: { a: 'say "hi"', b: "line\nbreak, comma" },
  });
  const csv = buildResponsesCsv({
    responses: [response],
    orderedFieldIds: ["a", "b"],
    fieldLabels: new Map([
      ["a", "Name"],
      ["b", "Name"],
    ]),
  });

  expect(csv.split("\n")).toEqual([
    "Response ID,User ID,User Name,SID,Name,Name (2)",
    '3,,3,s1,"say ""hi""","line break, comma"',
  ]);
});

it("adds a Variant column when given variant names", () => {
  const csv = buildResponsesCsv({
    responses: [makeFormResponse({ id: 3 })],
    orderedFieldIds: [],
    fieldLabels: new Map(),
    variantName: () => "Short",
  });

  expect(csv).toBe("Response ID,User ID,User Name,SID,Variant\n3,,3,,Short");
});

it("fills the user columns from the respondent's account", () => {
  const csv = buildResponsesCsv({
    responses: [
      makeFormResponse({ id: 3, user: makeUser({ id: 7, name: "Ada" }) }),
    ],
    orderedFieldIds: [],
    fieldLabels: new Map(),
  });

  expect(csv.split("\n")[1]).toBe("3,7,Ada,");
});

it("names an unlabeled column by its field id and formats each answer", () => {
  const csv = buildResponsesCsv({
    responses: [
      makeFormResponse({
        id: 3,
        answers: { a: { name: "Paris", key: "paris" } },
      }),
    ],
    orderedFieldIds: ["a", "b"],
    fieldLabels: new Map(),
  });

  expect(csv.split("\n")).toEqual([
    "Response ID,User ID,User Name,SID,a,b",
    "3,,3,,Paris,NULL",
  ]);
});

it("adds a column per field of the rows responses were submitted with", () => {
  const csv = buildResponsesCsv({
    responses: [
      makeFormResponse({
        id: 3,
        assignedRow: {
          key: '["Springfield"]',
          values: { jurisdiction: "Springfield", email: null },
        },
      }),
      makeFormResponse({ id: 4 }),
    ],
    orderedFieldIds: [],
    fieldLabels: new Map(),
  });

  expect(csv.split("\n")).toEqual([
    "Response ID,User ID,User Name,SID,row.jurisdiction,row.email",
    "3,,3,,Springfield,",
    "4,,4,,,",
  ]);
});
