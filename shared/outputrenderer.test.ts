import { ExceptionEvent } from "@alliance/common/analytics";
import type {
  AnyField,
  FormSchema,
  FormValue,
  ListField,
  NumberField,
  OutputFieldBlock,
} from "@alliance/common/forms/form-schema";
import {
  redactToOutput,
  type ResolveOutputParams,
} from "@alliance/common/forms/output-resolution";
import type {
  Condition,
  VisibleIfFormula,
} from "@alliance/common/forms/visible-if-formula";
import {
  __resetAnalyticsForTests,
  registerAnalytics,
  type AnalyticsProperties,
} from "./lib/analytics";
import { captureErrors } from "./lib/testing/captureErrors";
import { resolveOutputItems } from "./outputrenderer";

const numberField = (id: string, label: string): NumberField => ({
  id,
  type: "input",
  kind: "number",
  label,
});

const schemaWithVariable = (overrides: Partial<FormSchema>): FormSchema => ({
  pages: [{ id: "p1", fields: [numberField("qty", "Quantity")] }],
  outputViews: [],
  variables: [
    {
      name: "total",
      inputs: { input1: { kind: "field", fieldId: "qty" } },
      formula: "input1 * 2",
    },
  ],
  ...overrides,
});

const resolve = (schema: FormSchema) =>
  resolveOutputItems({
    schema,
    answers: { qty: 21 },
    publicAnswers: { qty: true },
  });

describe("resolveOutputItems interpolates variables", () => {
  it("leaves a failed variable's reference as written and still fills the rest", () => {
    const [item] = resolve(
      schemaWithVariable({
        pages: [
          {
            id: "p1",
            fields: [numberField("qty", "#{broken} of #{total} units")],
          },
        ],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [{ id: "ob1", fieldId: "qty", showLabel: true }],
          },
        ],
        variables: [
          { name: "broken", inputs: {}, formula: "this" },
          {
            name: "total",
            inputs: { input1: { kind: "field", fieldId: "qty" } },
            formula: "input1 * 2",
          },
        ],
      }),
    ).items;

    if (item.type !== "field") throw new Error("expected a field item");
    expect(item.label).toBe("#{broken} of 42 units");
  });

  it("leaves a variable reading a field kind this build doesn't know as written", () => {
    const [item] = resolve(
      schemaWithVariable({
        pages: [
          {
            id: "p1",
            fields: [
              numberField("qty", "#{total} units"),
              JSON.parse(
                '{ "id": "future", "type": "input", "kind": "future", "label": "Future" }',
              ),
            ],
          },
        ],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [{ id: "ob1", fieldId: "qty", showLabel: true }],
          },
        ],
        variables: [
          {
            name: "total",
            inputs: { input1: { kind: "field", fieldId: "future" } },
            formula: "input1 ?? 'n/a'",
          },
        ],
      }),
    ).items;

    if (item.type !== "field") throw new Error("expected a field item");
    expect(item.label).toBe("#{total} units");
  });

  it("substitutes into a label override", () => {
    const [item] = resolve(
      schemaWithVariable({
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [
              {
                id: "ob1",
                fieldId: "qty",
                labelOverride: "#{total} saved",
                showLabel: true,
              },
            ],
          },
        ],
      }),
    ).items;

    if (item.type !== "field") throw new Error("expected a field item");
    expect(item.label).toBe("42 saved");
    expect(item.renderField?.label).toBe("42 saved");
    expect(item.block.labelOverride).toBe("42 saved");
  });

  it("substitutes into the field's own label when there is no override", () => {
    const [item] = resolve(
      schemaWithVariable({
        pages: [{ id: "p1", fields: [numberField("qty", "#{total} units")] }],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [{ id: "ob1", fieldId: "qty", showLabel: true }],
          },
        ],
      }),
    ).items;

    if (item.type !== "field") throw new Error("expected a field item");
    expect(item.label).toBe("42 units");
    expect(item.renderField?.label).toBe("42 units");
  });

  it("substitutes into list sub-field labels", () => {
    const list: ListField = {
      id: "list",
      type: "input",
      kind: "list",
      label: "Items",
      fields: [numberField("sub", "Weight of #{total}")],
    };
    const { items } = resolveOutputItems({
      schema: schemaWithVariable({
        pages: [{ id: "p1", fields: [numberField("qty", "Quantity"), list] }],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [{ id: "ob1", fieldId: "list" }],
          },
        ],
      }),
      answers: { qty: 21, list: [{ sub: 1 }] },
      publicAnswers: { list: true },
    });

    const [item] = items;
    if (item.type !== "field") throw new Error("expected a field item");
    const renderField = item.renderField;
    if (renderField?.kind !== "list") throw new Error("expected a list field");
    expect(renderField.fields[0].label).toBe("Weight of 42");
  });

  it("reads a list input's rows as stored, whatever account state their conditions name", () => {
    const list: ListField = {
      id: "list",
      type: "input",
      kind: "list",
      label: "Items",
      fields: [
        numberField("weight", "Weight"),
        {
          ...numberField("extra", "Extra"),
          visibleIfFormula: {
            conditions: { c1: { kind: "userHasCity", userHasCity: true } },
            formula: "c1",
          },
        },
      ],
    };
    const { items } = resolveOutputItems({
      schema: schemaWithVariable({
        pages: [{ id: "p1", fields: [list] }],
        variables: [
          {
            name: "summary",
            inputs: {
              input1: {
                kind: "list",
                fieldId: "list",
                properties: { weight: "weight", extra: "extra" },
              },
            },
            formula:
              "input1.map(row => row.weight + ':' + (row.extra ?? '-')).join()",
          },
        ],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [
              { id: "ob1", type: "display", kind: "text", text: "#{summary}" },
            ],
          },
        ],
      }),
      answers: {
        list: [
          { weight: 1, extra: 5 },
          { weight: 2, extra: 6 },
        ],
      },
    });

    const [item] = items;
    if (item.type !== "display") throw new Error("expected a display item");
    if (item.block.kind !== "text") throw new Error("expected a text block");
    expect(item.block.text).toBe("1:5,2:6");
  });

  it("reads a stored cell its row hides as unanswered in a list input", () => {
    const list: ListField = {
      id: "list",
      type: "input",
      kind: "list",
      label: "Items",
      fields: [
        numberField("weight", "Weight"),
        {
          ...numberField("extra", "Extra"),
          visibleIfFormula: {
            conditions: { c1: { kind: "equals", when: "weight", equals: 1 } },
            formula: "c1",
          },
        },
      ],
    };
    const { items } = resolveOutputItems({
      schema: schemaWithVariable({
        pages: [{ id: "p1", fields: [list] }],
        variables: [
          {
            name: "summary",
            inputs: {
              input1: {
                kind: "list",
                fieldId: "list",
                properties: { weight: "weight", extra: "extra" },
              },
            },
            formula:
              "input1.map(row => row.weight + ':' + (row.extra ?? '-')).join()",
          },
        ],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [
              { id: "ob1", type: "display", kind: "text", text: "#{summary}" },
            ],
          },
        ],
      }),
      answers: {
        list: [
          { weight: 1, extra: 5 },
          { weight: 2, extra: 6 },
        ],
      },
    });

    const [item] = items;
    if (item.type !== "display") throw new Error("expected a display item");
    if (item.block.kind !== "text") throw new Error("expected a text block");
    expect(item.block.text).toBe("1:5,2:-");
  });

  it("substitutes into display blocks", () => {
    const [item] = resolve(
      schemaWithVariable({
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [
              { id: "ob1", type: "display", kind: "text", text: "#{total} kg" },
            ],
          },
        ],
      }),
    ).items;

    if (item.type !== "display") throw new Error("expected a display item");
    if (item.block.kind !== "text") throw new Error("expected a text block");
    expect(item.block.text).toBe("42 kg");
  });

  it("leaves no reference behind in any text the view draws", () => {
    const names: string[] = [];
    const ref = () => {
      const name = `v${names.length}`;
      names.push(name);
      return `#{${name}}`;
    };
    const schema = schemaWithVariable({
      pages: [
        {
          id: "p1",
          fields: [
            {
              ...numberField("qty", ref()),
              description: ref(),
            },
            {
              id: "memo",
              type: "input",
              kind: "text",
              label: ref(),
              placeholder: ref(),
            },
            {
              id: "pick",
              type: "input",
              kind: "radio",
              label: ref(),
              options: [{ value: "a", label: ref() }],
            },
            {
              id: "rows",
              type: "input",
              kind: "list",
              label: ref(),
              fields: [numberField("weight", ref())],
            },
          ],
        },
      ],
      outputViews: [
        {
          id: "v1",
          type: "default",
          blocks: [
            { id: "o-qty", fieldId: "qty", showLabel: true },
            { id: "o-memo", fieldId: "memo" },
            { id: "o-pick", fieldId: "pick", labelOverride: ref() },
            { id: "o-rows", fieldId: "rows" },
            { type: "display", kind: "header", text: ref() },
            { type: "display", kind: "text", text: ref() },
            { type: "display", kind: "label", text: ref() },
            { type: "display", kind: "quote", text: ref(), userName: ref() },
            { type: "display", kind: "copytext", text: ref(), title: ref() },
            { type: "display", kind: "biglink", text: ref(), url: "x" },
            { type: "display", kind: "video", src: "x", caption: ref() },
            {
              type: "display",
              kind: "images",
              images: [{ src: "x", alt: ref(), caption: ref() }],
            },
            {
              type: "display",
              kind: "chatTranscript",
              leftName: ref(),
              rightName: ref(),
              messages: [{ side: "left", text: ref() }],
            },
            {
              type: "display",
              kind: "previousAnswer",
              sourceFormId: 1,
              sourceFieldId: "x",
              title: ref(),
              emptyText: ref(),
              showLabel: true,
            },
            {
              type: "display",
              kind: "userLocation",
              title: ref(),
              emptyText: ref(),
            },
            {
              type: "display",
              kind: "accordion",
              sections: [
                {
                  title: ref(),
                  blocks: [{ type: "display", kind: "text", text: ref() }],
                },
              ],
            },
          ],
        },
      ],
    });
    schema.variables = names.map((name) => ({
      name,
      inputs: { input1: { kind: "field", fieldId: "qty" } },
      formula: "input1 * 2",
    }));
    const { items } = resolveOutputItems({
      schema,
      answers: { qty: 21, memo: "m", pick: "a", rows: [{ weight: 1 }] },
      publicAnswers: { qty: true, memo: true, pick: true, rows: true },
    });

    expect(items).toHaveLength(16);
    expect(JSON.stringify(items)).not.toContain("#{");
  });
});

describe("resolveOutputItems and blank list cards", () => {
  const list: ListField = {
    id: "shipment-weights",
    type: "input",
    kind: "list",
    label: "Items",
    fields: [numberField("weight", "Weight"), numberField("note", "Note")],
    outputViewHiddenFieldIds: ["note"],
  };
  const resolveList = (
    value: FormValue,
    {
      format,
      publicAnswer = true,
      blocks = [{ id: "ob1", fieldId: list.id, format }],
      field = list,
    }: {
      format?: OutputFieldBlock["format"];
      publicAnswer?: boolean;
      blocks?: OutputFieldBlock[];
      field?: ListField;
    } = {},
  ) =>
    resolveOutputItems({
      schema: {
        pages: [{ id: "p1", fields: [field] }],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks,
          },
        ],
      },
      answers: { [list.id]: value },
      publicAnswers: { [list.id]: publicAnswer },
    }).items;

  const reported: (AnalyticsProperties | undefined)[] = [];

  beforeEach(() => {
    reported.length = 0;
    registerAnalytics({
      capture: () => {},
      captureException: (_error, properties) => reported.push(properties),
    });
  });

  afterEach(() => {
    __resetAnalyticsForTests();
  });

  it("leaves out a list whose cards answer only what the view hides", () => {
    expect(resolveList([{ weight: "" }, { note: 3 }])).toEqual([]);
  });

  it("keeps a list with one card the view shows an answer for", () => {
    expect(resolveList([{ weight: "" }, { weight: 2 }])).toHaveLength(1);
  });

  it("leaves out a count block for a list the view shows nothing of", () => {
    expect(
      resolveList([{ weight: "" }, { note: 3 }], { format: "textonly" }),
    ).toEqual([]);
  });

  it("counts only the cards the view shows an answer for", () => {
    const [item] = resolveList([{ weight: "" }, { weight: 2 }], {
      format: "textonly",
    });

    if (item.type !== "field") throw new Error("expected a field item");
    expect(item.formattedValue).toBe("1 item");
  });

  it("reports a malformed list answer once when multiple blocks reference it", () => {
    const logged = captureErrors(() => {
      expect(
        resolveList(["Ada"], {
          blocks: [
            { id: "ob1", fieldId: list.id },
            { id: "ob2", fieldId: list.id, format: "textonly" },
          ],
        }),
      ).toEqual([]);
    });

    expect(logged).toEqual([
      ["Stored answer for list field shipment-weights is not a list of rows"],
    ]);
    expect(reported).toEqual([
      expect.objectContaining({
        event: ExceptionEvent.MalformedListAnswer,
        properties: { fieldId: list.id },
      }),
    ]);
  });

  it("leaves out a malformed private answer without logging it", () => {
    const logged = captureErrors(() => {
      expect(resolveList(["Ada"], { publicAnswer: false })).toEqual([]);
    });

    expect(logged).toEqual([]);
    expect(reported).toEqual([]);
  });

  it("leaves out a malformed answer to a hidden field without logging it", () => {
    const hidden: ListField = {
      ...list,
      visibleIfFormula: {
        conditions: { a: { kind: "equals", when: "gate", equals: "yes" } },
        formula: "a",
      },
    };

    const logged = captureErrors(() => {
      expect(resolveList(["Ada"], { field: hidden })).toEqual([]);
    });

    expect(logged).toEqual([]);
    expect(reported).toEqual([]);
  });
});

describe("resolveOutputItems and hidden list cells", () => {
  it("drops a list cell the row's own answers hide", () => {
    const list: ListField = {
      id: "list",
      type: "input",
      kind: "list",
      label: "Items",
      fields: [
        numberField("weight", "Weight"),
        {
          ...numberField("extra", "Extra"),
          visibleIfFormula: {
            conditions: { c1: { kind: "equals", when: "weight", equals: 1 } },
            formula: "c1",
          },
        },
      ],
    };
    const { items } = resolveOutputItems({
      schema: schemaWithVariable({
        pages: [{ id: "p1", fields: [list] }],
        variables: [],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [{ id: "ob1", fieldId: "list" }],
          },
        ],
      }),
      answers: {
        list: [
          { weight: 1, extra: 5 },
          { weight: 2, extra: 6 },
        ],
      },
      publicAnswers: { list: true },
    });

    const [item] = items;
    if (item.type !== "field") throw new Error("expected a field item");
    expect(item.value).toEqual([{ weight: 1, extra: 5 }, { weight: 2 }]);
  });
});

describe("resolveOutputItems and a cell the response can't judge", () => {
  const listGatedBy = (condition: Condition): ListField => ({
    id: "list",
    type: "input",
    kind: "list",
    label: "Items",
    fields: [
      numberField("weight", "Weight"),
      {
        ...numberField("extra", "Extra"),
        visibleIfFormula: { conditions: { c1: condition }, formula: "c1" },
      },
    ],
  });
  const resolveGated = (
    condition: Condition,
    context: Partial<Parameters<typeof resolveOutputItems>[0]> = {},
  ) => {
    const { items } = resolveOutputItems({
      schema: schemaWithVariable({
        pages: [{ id: "p1", fields: [listGatedBy(condition)] }],
        variables: [],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [{ id: "ob1", fieldId: "list" }],
          },
        ],
      }),
      answers: { list: [{ weight: 2, extra: 6 }] },
      publicAnswers: { list: true },
      ...context,
    });
    const [item] = items;
    if (item.type !== "field") throw new Error("expected a field item");
    return item.value;
  };

  it("keeps a cell gated on a validator the response recorded no verdict for", () => {
    expect(resolveGated({ kind: "validator", validatorId: 7 })).toEqual([
      { weight: 2, extra: 6 },
    ]);
  });

  it("drops that cell once the response carries the verdict", () => {
    expect(
      resolveGated(
        { kind: "validator", validatorId: 7 },
        { validatorResults: { 7: false } },
      ),
    ).toEqual([{ weight: 2 }]);
  });

  it("keeps a cell gated on a device the response didn't record", () => {
    expect(
      resolveGated({ kind: "deviceType", deviceType: ["mobile"] }),
    ).toEqual([{ weight: 2, extra: 6 }]);
  });

  it("keeps a cell gated on a field whose own device condition can't replay", () => {
    const gate: NumberField = {
      ...numberField("gate", "Gate"),
      visibleIfFormula: {
        conditions: { c1: { kind: "deviceType", deviceType: ["mobile"] } },
        formula: "c1",
      },
    };
    const { items } = resolveOutputItems({
      schema: schemaWithVariable({
        pages: [
          {
            id: "p1",
            fields: [
              gate,
              listGatedBy({ kind: "equals", when: "gate", equals: 1 }),
            ],
          },
        ],
        variables: [],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [{ id: "ob1", fieldId: "list" }],
          },
        ],
      }),
      answers: { gate: 1, list: [{ weight: 2, extra: 6 }] },
      publicAnswers: { list: true },
    });
    const [item] = items;
    if (item.type !== "field") throw new Error("expected a field item");
    expect(item.value).toEqual([{ weight: 2, extra: 6 }]);
  });
});

describe("resolveOutputItems and a whole field the response can't judge", () => {
  const resolveGatedField = (
    condition: Condition,
    context: Partial<Parameters<typeof resolveOutputItems>[0]> = {},
  ) =>
    resolveOutputItems({
      schema: schemaWithVariable({
        pages: [
          {
            id: "p1",
            fields: [
              {
                ...numberField("qty", "Quantity"),
                visibleIfFormula: {
                  conditions: { c1: condition },
                  formula: "c1",
                },
              },
            ],
          },
        ],
        variables: [],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [{ id: "ob1", fieldId: "qty" }],
          },
        ],
      }),
      answers: { qty: 3 },
      publicAnswers: { qty: true },
      ...context,
    }).items;

  it("shows a field gated on the respondent's account", () => {
    expect(
      resolveGatedField({ kind: "userHasCity", userHasCity: true }),
    ).toHaveLength(1);
  });

  it("shows a field gated on a validator the response recorded no verdict for", () => {
    expect(
      resolveGatedField({ kind: "validator", validatorId: 7 }),
    ).toHaveLength(1);
  });

  it("hides that field once the response carries the verdict", () => {
    expect(
      resolveGatedField(
        { kind: "validator", validatorId: 7 },
        { validatorResults: { 7: false } },
      ),
    ).toEqual([]);
  });

  it("shows a field gated on a device the response didn't record", () => {
    expect(
      resolveGatedField({ kind: "deviceType", deviceType: ["mobile"] }),
    ).toHaveLength(1);
  });

  it("hides that field once the response records another device", () => {
    expect(
      resolveGatedField(
        { kind: "deviceType", deviceType: ["mobile"] },
        { deviceType: "desktop" },
      ),
    ).toEqual([]);
  });
});

describe("resolveOutputItems and a field inside a group", () => {
  it("hides a field whose group a recorded verdict hides", () => {
    const { items } = resolveOutputItems({
      schema: schemaWithVariable({
        pages: [
          {
            id: "p1",
            fields: [
              {
                id: "g1",
                type: "group",
                kind: "group",
                fields: [numberField("qty", "Quantity")],
                visibleIfFormula: {
                  conditions: { c1: { kind: "validator", validatorId: 7 } },
                  formula: "c1",
                },
              },
            ],
          },
        ],
        variables: [],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [{ id: "ob1", fieldId: "qty" }],
          },
        ],
      }),
      answers: { qty: 3 },
      publicAnswers: { qty: true },
      validatorResults: { 7: false },
    });
    expect(items).toEqual([]);
  });
});

describe("resolveOutputItems and a field on a hidden page", () => {
  it("hides a field whose page a recorded verdict hides", () => {
    const { items } = resolveOutputItems({
      schema: schemaWithVariable({
        pages: [
          {
            id: "p1",
            fields: [numberField("qty", "Quantity")],
            visibleIfFormula: {
              conditions: { c1: { kind: "validator", validatorId: 7 } },
              formula: "c1",
            },
          },
        ],
        variables: [],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [{ id: "ob1", fieldId: "qty" }],
          },
        ],
      }),
      answers: { qty: 3 },
      publicAnswers: { qty: true },
      validatorResults: { 7: false },
    });
    expect(items).toEqual([]);
  });

  const blockOnQty = (pageFormula: VisibleIfFormula) =>
    resolveOutputItems({
      schema: schemaWithVariable({
        pages: [
          {
            id: "p1",
            fields: [numberField("qty", "Quantity")],
            visibleIfFormula: pageFormula,
          },
        ],
        variables: [],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [
              {
                id: "ob1",
                type: "display",
                kind: "text",
                text: "Has a quantity",
                visibleIfFormula: {
                  conditions: {
                    c1: { kind: "hasValue", when: "qty", hasValue: true },
                  },
                  formula: "c1",
                },
              },
            ],
          },
        ],
      }),
      answers: { qty: 3 },
      validatorResults: { 7: false },
    }).items.map((item) => item.key);

  it("reads a field its page hides as unanswered in a block's condition", () => {
    expect(
      blockOnQty({
        conditions: { c1: { kind: "validator", validatorId: 7 } },
        formula: "c1",
      }),
    ).toEqual([]);
  });

  it("reads a field in a block's condition when its page could have shown", () => {
    expect(
      blockOnQty({
        conditions: { c1: { kind: "userHasCity", userHasCity: true } },
        formula: "c1",
      }),
    ).toEqual(["ob1"]);
  });

  it("reads a field its page hides as unanswered in a field block's condition", () => {
    const { items } = resolveOutputItems({
      schema: schemaWithVariable({
        pages: [
          {
            id: "p1",
            fields: [numberField("qty", "Quantity")],
            visibleIfFormula: {
              conditions: { c1: { kind: "validator", validatorId: 7 } },
              formula: "c1",
            },
          },
          { id: "p2", fields: [numberField("price", "Price")] },
        ],
        variables: [],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [
              {
                id: "ob1",
                fieldId: "price",
                visibleIfFormula: {
                  conditions: {
                    c1: { kind: "hasValue", when: "qty", hasValue: true },
                  },
                  formula: "c1",
                },
              },
            ],
          },
        ],
      }),
      answers: { qty: 3, price: 5 },
      publicAnswers: { price: true },
      validatorResults: { 7: false },
    });
    expect(items).toEqual([]);
  });
});

describe("resolveOutputItems and conditions the response partly replays", () => {
  const ruledOutByWeight = {
    conditions: {
      c1: { kind: "equals", when: "weight", equals: 1 },
      c2: { kind: "userHasCity", userHasCity: true },
    },
    formula: { op: "AND", left: "c1", right: "c2" },
  } as const;
  const resolveBlock = (
    fields: AnyField[],
    answers: Record<string, FormValue>,
  ) =>
    resolveOutputItems({
      schema: schemaWithVariable({
        pages: [{ id: "p1", fields }],
        variables: [],
        outputViews: [
          {
            id: "v1",
            type: "default",
            blocks: [{ id: "ob1", fieldId: fields[fields.length - 1].id }],
          },
        ],
      }),
      answers,
      publicAnswers: { qty: true, list: true },
    }).items;

  it("hides a field its replayable conditions rule out", () => {
    expect(
      resolveBlock(
        [
          numberField("weight", "Weight"),
          {
            ...numberField("qty", "Quantity"),
            visibleIfFormula: ruledOutByWeight,
          },
        ],
        { weight: 2, qty: 3 },
      ),
    ).toEqual([]);
  });

  it("hides a field another field's answer rules out whether or not that field showed", () => {
    expect(
      resolveBlock(
        [
          {
            ...numberField("weight", "Weight"),
            visibleIfFormula: {
              conditions: {
                c1: { kind: "deviceType", deviceType: ["desktop", "mobile"] },
              },
              formula: "c1",
            },
          },
          {
            ...numberField("qty", "Quantity"),
            visibleIfFormula: {
              conditions: { c1: { kind: "equals", when: "weight", equals: 1 } },
              formula: "c1",
            },
          },
        ],
        { weight: 2, qty: 3 },
      ),
    ).toEqual([]);
  });

  it("drops a cell its replayable conditions rule out", () => {
    const [item] = resolveBlock(
      [
        {
          id: "list",
          type: "input",
          kind: "list",
          label: "Items",
          fields: [
            numberField("weight", "Weight"),
            {
              ...numberField("extra", "Extra"),
              visibleIfFormula: ruledOutByWeight,
            },
          ],
        },
      ],
      { list: [{ weight: 2, extra: 6 }] },
    );
    if (item.type !== "field") throw new Error("expected a field item");
    expect(item.value).toEqual([{ weight: 2 }]);
  });
});

describe("redactToOutput", () => {
  const gateIs = (value: string) =>
    ({
      conditions: { c1: { kind: "equals", when: "gate", equals: value } },
      formula: "c1",
    }) as const;
  const schema: FormSchema = {
    pages: [
      {
        id: "p1",
        fields: [
          { id: "gate", type: "input", kind: "text", label: "Gate" },
          numberField("secret", "Secret"),
          {
            ...numberField("shown", "Shown"),
            visibleIfFormula: gateIs("open"),
          },
          {
            ...numberField("hidden", "Hidden"),
            visibleIfFormula: gateIs("shut"),
          },
          {
            id: "list",
            type: "input",
            kind: "list",
            label: "Items",
            fields: [
              { id: "name", type: "input", kind: "text", label: "Name" },
              {
                ...numberField("extra", "Extra"),
                visibleIfFormula: gateIs("shut"),
              },
            ],
          },
        ],
      },
    ],
    variables: [
      {
        name: "double",
        inputs: { input1: { kind: "field", fieldId: "secret" } },
        formula: "input1 * 2",
      },
    ],
    outputViews: [
      {
        id: "v1",
        type: "default",
        blocks: [
          {
            type: "display",
            kind: "text",
            text: "Twice: #{double}",
          },
          { id: "b-shown", fieldId: "shown" },
          { id: "b-hidden", fieldId: "hidden" },
          { id: "b-list", fieldId: "list" },
          {
            type: "display",
            kind: "text",
            text: "Open",
            visibleIfFormula: gateIs("open"),
          },
        ],
      },
    ],
  };
  const params = {
    schema,
    answers: {
      gate: "open",
      secret: 21,
      shown: 1,
      hidden: 2,
      list: [{ name: "Ada", extra: 3 }],
    },
    publicAnswers: { shown: true, hidden: true, list: true },
  };
  const redacted = redactToOutput(params);
  const drawn = (resolved: ReturnType<typeof resolveOutputItems>) =>
    resolved.items.map((item) =>
      item.type === "display"
        ? {
            key: item.key,
            block: { ...item.block, visibleIfFormula: undefined },
          }
        : {
            key: item.key,
            label: item.label,
            value: item.value,
            formattedValue: item.formattedValue,
          },
    );

  it("draws the same items as the whole response", () => {
    expect(
      drawn(
        resolveOutputItems({
          ...redacted,
          publicAnswers: params.publicAnswers,
        }),
      ),
    ).toEqual(drawn(resolveOutputItems(params)));
  });

  it("keeps only the answers the view draws", () => {
    expect(redacted.answers).toEqual({ shown: 1, list: [{ name: "Ada" }] });
  });

  it("keeps no condition or variable that could read the rest", () => {
    const text = JSON.stringify(redacted.schema);
    expect(text).not.toContain("visibleIfFormula");
    expect(text).not.toContain("secret");
    expect(text).not.toContain("gate");
    expect(redacted.schema.variables).toEqual([]);
  });

  it("drops the list cells and rows the view hides", () => {
    const listSchema: FormSchema = {
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "people",
              type: "input",
              kind: "list",
              label: "People",
              outputViewHiddenFieldIds: ["phone"],
              fields: [
                { id: "name", type: "input", kind: "text", label: "Name" },
                { id: "phone", type: "input", kind: "text", label: "Phone" },
              ],
            },
          ],
        },
      ],
      outputViews: [
        {
          id: "v1",
          type: "default",
          blocks: [{ id: "b-people", fieldId: "people" }],
        },
      ],
    };
    const listParams: ResolveOutputParams = {
      schema: listSchema,
      answers: {
        people: [{ name: "Ada", phone: "555-0100" }, { phone: "555-0101" }],
      },
      publicAnswers: { people: true },
    };
    const redactedList = redactToOutput(listParams);

    expect(redactedList.answers).toEqual({ people: [{ name: "Ada" }] });
    expect(JSON.stringify(redactedList)).not.toContain("phone");
    expect(
      resolveOutputItems({
        ...redactedList,
        publicAnswers: listParams.publicAnswers,
      }).items.map((item) => item.type === "field" && item.formattedValue),
    ).toEqual(
      resolveOutputItems(listParams).items.map(
        (item) => item.type === "field" && item.formattedValue,
      ),
    );
  });
});
