import { PlaceKind } from "@alliance/common/forms/form-conditions";
import type {
  FormSchema,
  Page,
  PageItem,
} from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { describe, expect, test } from "bun:test";
import type { ExpressionBuffer } from "../components/form-fields/conditions/expressionBuffers";
import { collectFormIssues, IssueTargetKind } from "./formIssues";
import {
  deriveVisibilityGroups,
  type VisibilityGroups,
} from "./visibilityGroups";

const reads = (when: string): VisibleIfFormula => ({
  conditions: { c1: { kind: "hasValue", when, hasValue: true } },
  formula: "c1",
});

const text = (
  id: string,
  formulas: {
    visibleIfFormula?: VisibleIfFormula;
    requiredIfFormula?: VisibleIfFormula;
  } = {},
): PageItem => ({ id, type: "input", kind: "text", label: id, ...formulas });

const form = (
  pages: Page[],
  extra: Partial<Omit<FormSchema, "pages">> = {},
): FormSchema => ({
  outputViews: [],
  ...extra,
  pages,
});

const issuesOf = (
  schema: FormSchema,
  {
    expressions = {},
    groups = deriveVisibilityGroups(schema.pages),
  }: {
    expressions?: Record<string, ExpressionBuffer>;
    groups?: VisibilityGroups;
  } = {},
) =>
  collectFormIssues({
    schema,
    groups,
    expressions,
    validation: { sourceForms: new Map() },
  });

describe("collectFormIssues", () => {
  test("a valid form has none", () => {
    expect(
      issuesOf(
        form([
          {
            id: "p1",
            fields: [text("a"), text("b", { visibleIfFormula: reads("a") })],
          },
        ]),
      ),
    ).toEqual([]);
  });

  test("places validation errors by the id they name", () => {
    const schema = form([
      { id: "p1", fields: [text("a")] },
      {
        id: "p2",
        fields: [
          {
            id: "list",
            type: "input",
            kind: "list",
            label: "List",
            fields: [
              {
                id: "sub",
                type: "input",
                kind: "range",
                label: "Sub",
                optionCount: 1,
              },
            ],
          },
          { id: "pics", type: "display", kind: "images", images: [] },
        ],
      },
    ]);
    expect(
      issuesOf(schema).map(({ target, inConditions }) => ({
        target,
        inConditions,
      })),
    ).toEqual([
      {
        target: {
          kind: IssueTargetKind.Place,
          place: {
            kind: PlaceKind.SubField,
            pageIndex: 1,
            index: 0,
            subIndex: 0,
          },
        },
        inConditions: false,
      },
      {
        target: {
          kind: IssueTargetKind.Place,
          place: { kind: PlaceKind.Element, pageIndex: 1, index: 1 },
        },
        inConditions: false,
      },
    ]);
  });

  test("places an output view's error on its view, and an unplaceable one on the form", () => {
    const issues = issuesOf(
      form(
        [
          {
            id: "p1",
            fields: [{ type: "display", kind: "images", images: [] }],
          },
        ],
        {
          outputViews: [
            {
              type: "default",
              id: "v1",
              blocks: [
                {
                  id: "out",
                  type: "display",
                  kind: "text",
                  text: "",
                  visibleIfFormula: {
                    conditions: {
                      c1: {
                        kind: "outputBlockVisible",
                        outputBlockVisible: "gone",
                      },
                    },
                    formula: "c1",
                  },
                },
              ],
            },
          ],
        },
      ),
    );
    expect(issues.map((issue) => issue.target)).toEqual([
      { kind: IssueTargetKind.Form },
      { kind: IssueTargetKind.OutputView, viewId: "v1" },
    ]);
  });

  test("opens a formula's validation error on Conditions", () => {
    const negative: VisibleIfFormula = {
      conditions: { c1: { kind: "completedActionCount", atLeast: -1 } },
      formula: "c1",
    };
    const issues = issuesOf(
      form([
        {
          id: "p1",
          fields: [
            text("a", { visibleIfFormula: negative }),
            text("b", { requiredIfFormula: negative }),
          ],
        },
      ]),
    );
    expect(issues.map(({ inConditions }) => inConditions)).toEqual([
      true,
      true,
    ]);
  });

  test("places a variable's error on Variables", () => {
    const [issue] = issuesOf(
      form([{ id: "p1", fields: [] }], {
        variables: [{ name: "bad name", inputs: {}, formula: "1" }],
      }),
    );
    expect(issue?.target).toEqual({ kind: IssueTargetKind.Variables });
  });

  test("flags a formula naming a rule it doesn't define", () => {
    const issues = issuesOf(
      form([
        {
          id: "p1",
          fields: [
            text("a"),
            text("b", {
              visibleIfFormula: {
                conditions: reads("a").conditions,
                formula: { op: "AND", left: "c1", right: "c2" },
              },
            }),
          ],
        },
      ]),
    );
    expect(issues).toEqual([
      {
        target: {
          kind: IssueTargetKind.Place,
          place: { kind: PlaceKind.Element, pageIndex: 0, index: 1 },
        },
        message: "Visibility expression uses c2, which no rule defines",
        inConditions: true,
      },
    ]);
  });

  test("flags a rule reading a question the form lacks, visibility and required-if", () => {
    const issues = issuesOf(
      form([
        {
          id: "p1",
          fields: [
            text("a", {
              visibleIfFormula: reads("gone"),
              requiredIfFormula: reads("gone"),
            }),
          ],
        },
      ]),
    );
    expect(issues.map((issue) => issue.message)).toEqual([
      'Visibility reads question "gone", which this form doesn\'t have',
      'Required-if reads question "gone", which this form doesn\'t have',
    ]);
  });

  test("leaves a page's missing question to validation, reporting it once", () => {
    const issues = issuesOf(
      form([{ id: "p1", fields: [], visibleIfFormula: reads("gone") }]),
    );
    expect(issues.map((issue) => issue.message)).toEqual([
      'Page visibility references field "gone", which must be on an earlier page',
    ]);
  });

  test("flags typed text that doesn't parse while the schema holds its formula", () => {
    const visibleIfFormula = reads("a");
    const schema = form([
      { id: "p1", fields: [text("a"), text("b", { visibleIfFormula })] },
    ]);
    const typed = { "element:p1/b": { text: "c1 AND", formula: "c1" } };
    const [issue] = issuesOf(schema, { expressions: typed });
    expect(issue?.target).toEqual({
      kind: IssueTargetKind.Place,
      place: { kind: PlaceKind.Element, pageIndex: 0, index: 1 },
    });
    expect(issue?.message).toStartWith("Visibility expression isn't saved: ");

    const replaced = { "element:p1/b": { text: "c1 AND", formula: "c9" } };
    expect(issuesOf(schema, { expressions: replaced })).toEqual([]);
  });

  test("reports text naming a missing rule once, rather than also the formula", () => {
    const schema = form([
      {
        id: "p1",
        fields: [
          text("a"),
          text("b", {
            visibleIfFormula: {
              conditions: {},
              formula: "c1",
            },
          }),
        ],
      },
    ]);
    const issues = issuesOf(schema, {
      expressions: { "element:p1/b": { text: "c1", formula: "c1" } },
    });
    expect(issues.map((issue) => issue.message)).toEqual([
      "Visibility expression isn't saved: No rule is named c1. Use the name of a rule below, or add a rule and use its name.",
    ]);
  });

  test("checks a list sub-field's, a page's, and an output block's text by their keys", () => {
    const schema = form(
      [
        {
          id: "p1",
          fields: [
            {
              id: "list",
              type: "input",
              kind: "list",
              label: "List",
              fields: [
                { id: "sub", type: "input", kind: "text", label: "Sub" },
              ],
            },
          ],
        },
      ],
      {
        outputViews: [
          {
            type: "default",
            id: "v1",
            title: "View",
            blocks: [{ id: "out", type: "display", kind: "text", text: "" }],
          },
        ],
      },
    );
    const issues = issuesOf(schema, {
      expressions: {
        "page:p1": { text: "(", formula: null },
        "element:p1/list/sub": { text: "(", formula: null },
        "output:v1/out": { text: "(", formula: null },
      },
    });
    expect(issues.map((issue) => issue.target)).toEqual([
      {
        kind: IssueTargetKind.Place,
        place: { kind: PlaceKind.Page, pageIndex: 0 },
      },
      {
        kind: IssueTargetKind.Place,
        place: {
          kind: PlaceKind.SubField,
          pageIndex: 0,
          index: 0,
          subIndex: 0,
        },
      },
      { kind: IssueTargetKind.OutputView, viewId: "v1" },
    ]);
  });

  test("reports a group's shared rule once, on the group", () => {
    const shared: VisibleIfFormula = {
      conditions: {},
      formula: "c1",
    };
    const schema = form([
      {
        id: "p1",
        fields: [
          text("a", { visibleIfFormula: shared }),
          text("b", { visibleIfFormula: shared }),
        ],
      },
    ]);
    const groups = deriveVisibilityGroups(schema.pages);
    const issues = issuesOf(schema, { groups });
    expect(issues).toEqual([
      {
        target: {
          kind: IssueTargetKind.Group,
          pageIndex: 0,
          key: groups.get("a")!,
        },
        message: "Visibility expression uses c1, which no rule defines",
        inConditions: true,
      },
    ]);
  });

  test("reports a shared rule's validation error once, on the group", () => {
    const shared: VisibleIfFormula = {
      conditions: { c1: { kind: "completedActionCount", atLeast: -1 } },
      formula: "c1",
    };
    const schema = form([
      {
        id: "p1",
        fields: [
          text("a", { visibleIfFormula: shared }),
          text("b", { visibleIfFormula: shared }),
          text("c", { visibleIfFormula: shared }),
        ],
      },
    ]);
    const groups = deriveVisibilityGroups(schema.pages);
    expect(issuesOf(schema, { groups })).toEqual([
      {
        target: {
          kind: IssueTargetKind.Group,
          pageIndex: 0,
          key: groups.get("a")!,
        },
        message: '"completedActionCount" condition has an invalid count: -1',
        inConditions: true,
      },
    ]);
  });

  test("counts each of an accordion's repeated errors", () => {
    const issues = issuesOf(
      form([
        {
          id: "p1",
          fields: [
            {
              id: "acc",
              type: "display",
              kind: "accordion",
              sections: [1, 2].map((n) => ({
                id: `s${n}`,
                title: `Section ${n}`,
                blocks: [
                  {
                    id: `pics${n}`,
                    type: "display",
                    kind: "images",
                    images: [],
                  },
                ],
              })),
            },
          ],
        },
      ]),
    );
    expect(issues).toHaveLength(2);
  });

  test("flags an output block's rule reading a question the form lacks", () => {
    const issues = issuesOf(
      form([{ id: "p1", fields: [text("a")] }], {
        outputViews: [
          {
            type: "default",
            id: "v1",
            blocks: [
              {
                id: "out",
                type: "display",
                kind: "text",
                text: "Hi",
                visibleIfFormula: reads("gone"),
              },
            ],
          },
        ],
      }),
    );
    expect(issues).toEqual([
      {
        target: { kind: IssueTargetKind.OutputView, viewId: "v1" },
        message:
          'Visibility reads question "gone", which this form doesn\'t have',
        inConditions: true,
      },
    ]);
  });
});
