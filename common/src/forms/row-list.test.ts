import { describe, expect, it } from "bun:test";
import { R } from "../result";
import type { FormSchema } from "./form-schema";
import { validateFormSchema } from "./form-schema-validate";
import {
  memberSchema,
  rowConditionMet,
  rowKey,
  rowListErrors,
  schemaForRow,
} from "./row-list";
import {
  RowConditionKind,
  rowListSchema,
  type Row,
  type RowCondition,
} from "./row-list-schema";

const springfieldCity: Row = {
  jurisdiction: "Springfield",
  type: "City",
  prrFilingMode: "Website",
  prrWebsite: "https://springfield.example.gov/requests/new",
  email: null,
};

const springfieldCounty: Row = {
  jurisdiction: "Springfield",
  type: "County",
  prrFilingMode: "Email",
  prrWebsite: "https://county.example.gov/records",
  email: "records@county.example.gov",
};

const formFor = (overrides: Partial<FormSchema> = {}): FormSchema => ({
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "intro",
          type: "display",
          kind: "text",
          text: "File with #{row.jurisdiction} (#{row.type}). Email: #{row.email}",
        },
        {
          id: "portal",
          type: "display",
          kind: "biglink",
          text: "Open the #{row.jurisdiction} portal",
          url: "#{row.prrWebsite}",
          rowCondition: {
            kind: RowConditionKind.Equals,
            field: "prrFilingMode",
            value: "Website",
          },
        },
        {
          id: "to",
          type: "input",
          kind: "email",
          label: "Send it to #{row.jurisdiction}",
          defaultValue: "#{row.email}",
          rowCondition: { kind: RowConditionKind.HasValue, field: "email" },
          required: true,
        },
        {
          id: "confirmation",
          type: "input",
          kind: "text",
          label: "Confirmation number",
          description: "From #{row.prrWebsite}",
        },
      ],
    },
  ],
  outputViews: [
    {
      id: "v1",
      type: "default",
      blocks: [
        {
          id: "filed",
          type: "display",
          kind: "text",
          text: "Filed with #{row.jurisdiction}",
        },
        {
          id: "website-only",
          type: "display",
          kind: "text",
          text: "Online",
          rowCondition: {
            kind: RowConditionKind.IsOneOf,
            field: "prrFilingMode",
            values: ["Website"],
          },
        },
      ],
    },
  ],
  rowList: {
    rows: [springfieldCity, springfieldCounty],
    keyFields: ["jurisdiction", "type"],
  },
  ...overrides,
});

describe("rowKey", () => {
  it("tells apart rows that share a jurisdiction", () => {
    expect(rowKey(springfieldCity, ["jurisdiction", "type"])).not.toBe(
      rowKey(springfieldCounty, ["jurisdiction", "type"]),
    );
  });

  it("ignores edits to non-key fields", () => {
    expect(
      rowKey({ ...springfieldCity, email: "new@example.gov" }, [
        "jurisdiction",
        "type",
      ]),
    ).toBe(rowKey(springfieldCity, ["jurisdiction", "type"]));
  });
});

describe("rowConditionMet", () => {
  it.each([
    [{ kind: RowConditionKind.Equals, field: "type", value: "City" }, true],
    [{ kind: RowConditionKind.NotEquals, field: "type", value: "City" }, false],
    [{ kind: RowConditionKind.HasValue, field: "email" }, false],
    [{ kind: RowConditionKind.IsEmpty, field: "email" }, true],
    [{ kind: RowConditionKind.IsEmpty, field: "missing" }, true],
    [
      {
        kind: RowConditionKind.IsOneOf,
        field: "type",
        values: ["County", "City"],
      },
      true,
    ],
    [{ kind: RowConditionKind.IsOneOf, field: "email", values: [null] }, true],
  ] satisfies [RowCondition, boolean][])(
    "%o is %p for the city row",
    (condition, met) => {
      expect(rowConditionMet(condition, springfieldCity)).toBe(met);
    },
  );
});

describe("schemaForRow", () => {
  it("fills placeholders, drops failing items, and strips the list and conditions", () => {
    const served = schemaForRow(formFor(), springfieldCity);
    expect(served.rowList).toBeUndefined();
    expect(JSON.stringify(served)).not.toContain("rowCondition");
    expect(JSON.stringify(served)).not.toContain("#{row.");
    expect(served.pages[0].fields).toEqual([
      {
        id: "intro",
        type: "display",
        kind: "text",
        text: "File with Springfield (City). Email: ",
      },
      {
        id: "portal",
        type: "display",
        kind: "biglink",
        text: "Open the Springfield portal",
        url: "https://springfield.example.gov/requests/new",
      },
      {
        id: "confirmation",
        type: "input",
        kind: "text",
        label: "Confirmation number",
        description: "From https://springfield.example.gov/requests/new",
      },
    ]);
    expect(served.outputViews[0].blocks.map((block) => block.id)).toEqual([
      "filed",
      "website-only",
    ]);
  });

  it("prefills a default value and drops what the other row hides", () => {
    const served = schemaForRow(formFor(), springfieldCounty);
    const ids = served.pages[0].fields.map((item) => item.id);
    expect(ids).toEqual(["intro", "to", "confirmation"]);
    expect(served.pages[0].fields[1]).toMatchObject({
      label: "Send it to Springfield",
      defaultValue: "records@county.example.gov",
    });
    expect(served.outputViews[0].blocks.map((block) => block.id)).toEqual([
      "filed",
    ]);
  });

  it("leaves a form without row placeholders as it was", () => {
    const plain: FormSchema = {
      pages: [
        {
          id: "p1",
          fields: [
            { id: "t", type: "display", kind: "text", text: "Hi #{name}" },
          ],
        },
      ],
      outputViews: [],
    };
    expect(schemaForRow(plain, springfieldCity)).toEqual(plain);
  });
});

describe("row list validation", () => {
  const messages = (schema: FormSchema) =>
    rowListErrors(schema).map(({ message }) => message);

  it("accepts a well-formed list", () => {
    expect(messages(formFor())).toEqual([]);
    expect(validateFormSchema(formFor())).toEqual([]);
  });

  it("round-trips the list through its schema", () => {
    const list = formFor().rowList;
    expect(rowListSchema.parse(list)).toEqual(
      R.unwrap(R.fromNullable(list, "no list")),
    );
    expect(
      rowListSchema.safeParse({ rows: [{ nested: { a: 1 } }], keyFields: [] })
        .success,
    ).toBe(false);
  });

  it("rejects an empty list", () => {
    expect(
      messages(formFor({ rowList: { rows: [], keyFields: ["jurisdiction"] } })),
    ).toContain("The row list has no rows");
  });

  it("rejects rows sharing a key", () => {
    expect(
      messages(
        formFor({
          rowList: {
            rows: [springfieldCity, springfieldCounty],
            keyFields: ["jurisdiction"],
          },
        }),
      ),
    ).toEqual(['Two rows share the key ["Springfield"]']);
  });

  it("rejects a key field a row leaves empty", () => {
    expect(
      messages(
        formFor({
          rowList: {
            rows: [springfieldCity, springfieldCounty],
            keyFields: ["jurisdiction", "email"],
          },
        }),
      ),
    ).toContain('Every row needs a value for key field "email"');
  });

  it("rejects placeholders and conditions naming a field no row has", () => {
    const schema = formFor();
    schema.pages[0].fields.push({
      id: "typo",
      type: "display",
      kind: "text",
      text: "#{row.emial}",
      rowCondition: { kind: RowConditionKind.HasValue, field: "fax" },
    });
    expect(messages(schema)).toEqual([
      '#{row.emial} uses row field "emial", which no row has',
      'Row condition uses row field "fax", which no row has',
    ]);
  });

  it("rejects row placeholders on a form with no list", () => {
    expect(messages(formFor({ rowList: undefined }))).toContain(
      '#{row.jurisdiction} uses row field "jurisdiction", but the form has no row list',
    );
  });
});

describe("schemaForRow on a list field", () => {
  it("drops sub-fields whose row condition fails", () => {
    const served = schemaForRow(
      {
        pages: [
          {
            id: "p1",
            fields: [
              {
                id: "contacts",
                type: "input",
                kind: "list",
                label: "Contacts at #{row.jurisdiction}",
                fields: [
                  { id: "name", type: "input", kind: "text", label: "Name" },
                  {
                    id: "email",
                    type: "input",
                    kind: "email",
                    label: "Email",
                    rowCondition: {
                      kind: RowConditionKind.HasValue,
                      field: "email",
                    },
                  },
                ],
              },
            ],
          },
        ],
        outputViews: [],
      },
      springfieldCity,
    );
    expect(served.pages[0].fields[0]).toMatchObject({
      label: "Contacts at Springfield",
      fields: [{ id: "name" }],
    });
  });
});

describe("memberSchema", () => {
  it("fills from the saved row", () => {
    const served = memberSchema(formFor(), {
      key: rowKey(springfieldCounty, ["jurisdiction", "type"]),
      values: springfieldCounty,
    });
    expect(served.pages[0].fields[0]).toMatchObject({
      text: "File with Springfield (County). Email: records@county.example.gov",
    });
  });

  it("strips the list and blanks placeholders without a row", () => {
    const served = memberSchema(formFor(), null);
    expect(served.rowList).toBeUndefined();
    expect(served.pages[0].fields[0]).toMatchObject({
      text: "File with  (). Email: ",
    });
  });

  it("leaves a form without a list untouched", () => {
    const plain = formFor({ rowList: undefined });
    expect(memberSchema(plain, null)).toBe(plain);
  });
});

describe("row list key fields", () => {
  it("requires at least one", () => {
    expect(
      rowListErrors(
        formFor({ rowList: { rows: [springfieldCity], keyFields: [] } }),
      ).map(({ message }) => message),
    ).toContain("Pick at least one field that identifies a row");
  });
});
