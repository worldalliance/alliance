import {
  type AnyField,
  type FormSchema,
  type FormValue,
  type TextField,
} from "@alliance/common/forms/form-schema";
import type { VariableSourceHistory } from "@alliance/common/forms/variable-evaluation";
import { uniformHash } from "@alliance/common/random";
import { renderHook } from "@testing-library/react";
import {
  VariableAggregatesStatus,
  type VariableAggregates,
} from "./forms/useVariableAggregates";
import {
  NO_SOURCE_HISTORIES,
  SourceHistoriesStatus,
  type SourceHistories,
} from "./forms/useVariableSourceHistories";
import {
  gatedOnYes,
  listField,
  lookupFor,
  NO_AGGREGATES_READY,
  NO_SOURCES_READY,
  schemaWith,
  SETTLED_INPUTS,
  textField,
  twoPageSchema,
} from "./lib/testing/formVisibility";
import {
  useFormSchemaMaps,
  useFormVisibility,
  useRandomizationKey,
} from "./useFormRenderer";

describe("useRandomizationKey", () => {
  it("keys on the acting user when there is one", () => {
    const { result } = renderHook(() =>
      useRandomizationKey({
        formId: 7,
        activeUserKey: "u9",
        persistKey: "draft",
      }),
    );
    expect(result.current).toBe("form:7:user:u9");
  });

  it("falls back to the persist key, then to the form alone", () => {
    expect(
      renderHook(() =>
        useRandomizationKey({
          formId: 7,
          activeUserKey: null,
          persistKey: "draft",
        }),
      ).result.current,
    ).toBe("form:7:persist:draft");

    expect(
      renderHook(() =>
        useRandomizationKey({ formId: 7, activeUserKey: null, persistKey: "" }),
      ).result.current,
    ).toBe("form:7");
  });
});

describe("useFormSchemaMaps", () => {
  it("looks up list sub-fields, so a condition can reference one", () => {
    const schema = schemaWith([
      listField("addresses", [textField("street"), textField("city")]),
    ]);
    const { result } = renderHook(() =>
      useFormSchemaMaps({ schema, userDefaultPublic: false, timeZone: "UTC" }),
    );

    expect(result.current.fieldLookup.has("addresses")).toBe(true);
    expect(result.current.fieldLookup.get("street")?.id).toBe("street");
    expect(result.current.fieldLookup.get("city")?.id).toBe("city");
  });

  it("defaults an output field to the user's preference unless it is private", () => {
    const schema = schemaWith([
      { ...textField("shared"), output: { output: true } },
      {
        ...textField("secret"),
        output: { output: true, privateByDefault: true },
      },
      textField("notOutput"),
    ]);

    const { result } = renderHook(() =>
      useFormSchemaMaps({ schema, userDefaultPublic: true, timeZone: "UTC" }),
    );

    expect(result.current.outputFieldDefaultPublic.get("shared")).toBe(true);
    expect(result.current.outputFieldDefaultPublic.get("secret")).toBe(false);
    expect(result.current.outputFieldIds.has("notOutput")).toBe(false);
  });

  it("seeds a timezone field with the given zone over the field's own default", () => {
    const schema = schemaWith([
      {
        id: "fixed",
        type: "input",
        kind: "timezone",
        label: "fixed",
        defaultValue: "America/Los_Angeles",
      },
      {
        id: "empty",
        type: "input",
        kind: "timezone",
        label: "empty",
        defaultValue: null,
      },
    ]);
    const initialProps: { timeZone: string | undefined } = {
      timeZone: "Asia/Kolkata",
    };
    const { result, rerender } = renderHook(
      ({ timeZone }) =>
        useFormSchemaMaps({ schema, userDefaultPublic: false, timeZone }),
      { initialProps },
    );

    expect(Object.fromEntries(result.current.defaultValueMap)).toEqual({
      fixed: "Asia/Kolkata",
      empty: "Asia/Kolkata",
    });

    rerender({ timeZone: "Europe/Paris" });
    expect(result.current.defaultValueMap.get("fixed")).toBe("Europe/Paris");

    rerender({ timeZone: undefined });
    expect(result.current.defaultValueMap.size).toBe(0);
  });

  it("reports the page bounds", () => {
    const { result } = renderHook(() =>
      useFormSchemaMaps({
        schema: { pages: [{ id: "a", fields: [] }], outputViews: [] },
        userDefaultPublic: false,
        timeZone: "UTC",
      }),
    );
    expect(result.current.pageCount).toBe(1);
    expect(result.current.maxPageIndex).toBe(0);
  });
});

function renderVisibility(args: {
  schema?: FormSchema;
  formData: Record<string, FormValue>;
  currentPageIndex?: number;
  setCurrentPageIndex?: (index: number) => void;
  setFormData?: Parameters<typeof useFormVisibility>[0]["setFormData"];
  sourceHistories?: SourceHistories;
  variableAggregates?: VariableAggregates;
  randomizationKey?: string;
  visibilityValidatorResults?: Record<number, boolean>;
  visibilityInputsLoading?: boolean;
}) {
  const schema = args.schema ?? twoPageSchema;
  return renderHook(() =>
    useFormVisibility({
      schema,
      formData: args.formData,
      readOnly: false,
      currentPageIndex: args.currentPageIndex ?? 0,
      setCurrentPageIndex: args.setCurrentPageIndex ?? (() => {}),
      setFormData: args.setFormData ?? (() => {}),
      effectiveDeviceType: "desktop",
      visibilityValidatorResults: args.visibilityValidatorResults ?? {},
      fieldLookup: lookupFor(schema),
      previousAnswerData: undefined,
      sourceHistories: args.sourceHistories ?? NO_SOURCES_READY,
      variableAggregates: args.variableAggregates ?? NO_AGGREGATES_READY,
      randomizationKey: args.randomizationKey ?? "form:1:user:1",
      userHasCity: false,
      firstContractSignedAt: null,
      completedActionCount: 0,
      visibilityInputs: {
        ...SETTLED_INPUTS,
        userLoading: args.visibilityInputsLoading ?? false,
      },
    }),
  );
}

describe("useFormVisibility", () => {
  it("strips a hidden field's answer without losing it from formData", () => {
    const formData = { gate: "no", detail: "typed earlier" };
    const { result } = renderVisibility({ formData });

    expect(result.current.effectiveFormData.detail).toBeUndefined();
    expect(result.current.visiblePageIndices).toEqual([0]);
    expect(formData.detail).toBe("typed earlier");
  });

  it("restores the answer once the field is visible again", () => {
    const { result } = renderVisibility({
      formData: { gate: "yes", detail: "typed earlier" },
    });

    expect(result.current.effectiveFormData.detail).toBe("typed earlier");
    expect(result.current.visiblePageIndices).toEqual([0, 1]);
  });

  it("moves off a page an answer has just hidden", () => {
    const moves: number[] = [];
    renderVisibility({
      formData: { gate: "no" },
      currentPageIndex: 1,
      setCurrentPageIndex: (index) => moves.push(index),
    });

    expect(moves).toEqual([0]);
  });

  it("stays on a page that looks hidden while its visibility inputs load", () => {
    const moves: number[] = [];
    const { result } = renderVisibility({
      formData: { gate: "no" },
      currentPageIndex: 1,
      setCurrentPageIndex: (index) => moves.push(index),
      visibilityInputsLoading: true,
    });

    expect(moves).toEqual([]);
    expect(result.current.visibilitySettled).toBe(false);
  });

  it("recomputes a variable combining another form's answers with a local one as the local answer changes", () => {
    const schema: FormSchema = {
      ...schemaWith([
        { id: "bonus", type: "input", kind: "number", label: "bonus" },
      ]),
      variables: [
        {
          name: "total",
          inputs: {
            input1: { kind: "sourceField", fieldId: "score", sourceFormId: 7 },
            input2: { kind: "field", fieldId: "bonus" },
          },
          formula:
            "input1.reduce((sum, n) => sum + (n ?? 0), 0) + (input2 ?? 0)",
        },
      ],
    };
    const scoreFields = new Map([["score", { kind: "number" as const }]]);
    const sources = new Map<number, VariableSourceHistory>([
      [
        7,
        {
          fields: scoreFields,
          responses: [
            { id: 1, answers: { score: 2 }, fields: scoreFields },
            { id: 2, answers: {}, fields: scoreFields },
            { id: 3, answers: { score: 3 }, fields: scoreFields },
          ],
        },
      ],
    ]);
    const { result, rerender } = renderHook(
      (formData: Record<string, FormValue>) =>
        useFormVisibility({
          schema,
          formData,
          readOnly: false,
          currentPageIndex: 0,
          setCurrentPageIndex: () => {},
          setFormData: () => {},
          effectiveDeviceType: "desktop",
          visibilityValidatorResults: {},
          fieldLookup: lookupFor(schema),
          previousAnswerData: undefined,
          sourceHistories: { status: SourceHistoriesStatus.Ready, sources },
          variableAggregates: NO_AGGREGATES_READY,
          randomizationKey: "form:1:user:1",
          userHasCity: false,
          firstContractSignedAt: null,
          completedActionCount: 0,
          visibilityInputs: SETTLED_INPUTS,
        }),
      { initialProps: { bonus: "1" } },
    );

    expect(result.current.variableValues.get("total")).toBe("6");
    rerender({ bonus: "10" });
    expect(result.current.variableValues.get("total")).toBe("15");
  });

  const pickReadingNote: AnyField = {
    id: "pick",
    type: "input",
    kind: "select",
    label: "pick",
    options: [],
    optionsFormula: {
      inputs: { input1: { kind: "field", fieldId: "note" } },
      formula: "[{ label: input1 ?? 'none', value: 'v' }]",
    },
  };
  const pickFromNote: FormSchema = schemaWith([
    textField("note"),
    pickReadingNote,
  ]);

  const dropsSelection = (
    args: Omit<Parameters<typeof renderVisibility>[0], "formData">,
  ) => {
    let dropped = false;
    renderVisibility({
      ...args,
      formData: { note: "hi", pick: "gone" },
      setFormData: () => {
        dropped = true;
      },
    });
    return dropped;
  };

  it("drops no selection until the visibility inputs load", () => {
    expect(
      dropsSelection({ schema: pickFromNote, visibilityInputsLoading: true }),
    ).toBe(false);
    expect(dropsSelection({ schema: pickFromNote })).toBe(true);
  });

  it("drops from formData a selection the formula doesn't offer", () => {
    const formData = { note: "hi", pick: "gone" };
    const updates: Record<string, FormValue>[] = [];
    renderVisibility({
      schema: pickFromNote,
      formData,
      setFormData: (update) => updates.push(update(formData)),
    });

    expect(updates).toEqual([{ note: "hi" }]);
  });

  it.each<[string, SourceHistories, boolean]>([
    ["loading", { status: SourceHistoriesStatus.Loading }, false],
    [
      "failed",
      { status: SourceHistoriesStatus.Failed, retry: () => {} },
      false,
    ],
    [
      "missing a deleted form",
      {
        status: SourceHistoriesStatus.SourceDeleted,
        sources: new Map(),
        deletedFormIds: new Set([7]),
      },
      false,
    ],
  ])(
    "drops selections against %s histories: %p",
    (_, sourceHistories, drops) => {
      expect(dropsSelection({ schema: pickFromNote, sourceHistories })).toBe(
        drops,
      );
    },
  );

  it("drops no selection until every validator verdict lands", () => {
    const gated = schemaWith([
      {
        ...textField("note"),
        visibleIfFormula: {
          conditions: { c1: { kind: "validator", validatorId: 42 } },
          formula: "c1",
        },
      },
      pickReadingNote,
    ]);
    expect(dropsSelection({ schema: gated })).toBe(false);
    expect(
      dropsSelection({
        schema: gated,
        visibilityValidatorResults: { 42: false },
      }),
    ).toBe(true);
  });

  it("blocks the form while another form's answers are missing", () => {
    const { result } = renderVisibility({
      schema: {
        ...schemaWith([textField("bonus")]),
        variables: [
          {
            name: "count",
            inputs: {
              input1: {
                kind: "sourceField",
                fieldId: "score",
                sourceFormId: 7,
              },
            },
            formula: "input1.length",
          },
        ],
      },
      formData: {},
    });

    expect(result.current.variablesError).toBe(
      "#{count}: Answers from form 7 are not loaded",
    );
  });

  it("seeds a random input with the member's randomization key", () => {
    const pick = (randomizationKey: string) =>
      renderVisibility({
        schema: {
          ...schemaWith([textField("bonus")]),
          variables: [
            {
              name: "pick",
              inputs: { input1: { kind: "random" } },
              formula: "input1",
            },
          ],
        },
        formData: {},
        randomizationKey,
      }).result.current.variableValues.get("pick");

    expect(pick("form:1:user:1")).toBe(
      String(uniformHash("form:1:user:1:pick:input1")),
    );
    expect(pick("form:1:user:2")).not.toBe(pick("form:1:user:1"));
  });

  it("leaves a variable reading a deleted form unresolved, and resolves the rest", () => {
    const { result } = renderVisibility({
      schema: {
        ...schemaWith([textField("bonus")]),
        variables: [
          {
            name: "count",
            inputs: {
              input1: {
                kind: "sourceField",
                fieldId: "score",
                sourceFormId: 7,
              },
            },
            formula: "input1.length",
          },
          {
            name: "bonus",
            inputs: { input1: { kind: "field", fieldId: "bonus" } },
            formula: "input1",
          },
        ],
      },
      formData: { bonus: "4" },
      sourceHistories: {
        status: SourceHistoriesStatus.SourceDeleted,
        sources: NO_SOURCE_HISTORIES,
        deletedFormIds: new Set([7]),
      },
    });

    expect(result.current.variablesError).toBeNull();
    expect([...result.current.variableValues]).toEqual([["bonus", "4"]]);
  });

  const companyCount = (): FormSchema => ({
    ...schemaWith([
      {
        id: "company",
        type: "input",
        kind: "select",
        label: "Company",
        options: [
          { label: "A", value: "a" },
          { label: "B", value: "b" },
        ],
      },
    ]),
    variables: [
      {
        name: "count",
        inputs: {
          counts: { kind: "aggregate", sourceFormId: 7, fieldId: "employers" },
          company: { kind: "field", fieldId: "company" },
        },
        formula: "company ? (counts[company.value] ?? 0) : 0",
      },
    ],
  });

  it("looks up a loaded count by the member's live answer", () => {
    const schema = companyCount();
    const variableAggregates: VariableAggregates = {
      status: VariableAggregatesStatus.Ready,
      aggregates: new Map([["7:employers", { a: 12, b: 0 }]]),
    };
    const { result, rerender } = renderHook(
      (formData: Record<string, FormValue>) =>
        useFormVisibility({
          schema,
          formData,
          readOnly: false,
          currentPageIndex: 0,
          setCurrentPageIndex: () => {},
          setFormData: () => {},
          effectiveDeviceType: "desktop",
          visibilityValidatorResults: {},
          fieldLookup: lookupFor(schema),
          previousAnswerData: undefined,
          sourceHistories: NO_SOURCES_READY,
          variableAggregates,
          randomizationKey: "form:1:user:1",
          userHasCity: false,
          firstContractSignedAt: null,
          completedActionCount: 0,
          visibilityInputs: SETTLED_INPUTS,
        }),
      { initialProps: { company: "a" } },
    );

    expect(result.current.variableValues.get("count")).toBe("12");
    rerender({ company: "b" });
    expect(result.current.variableValues.get("count")).toBe("0");
  });

  it("leaves a variable whose counts are unavailable unresolved", () => {
    const { result } = renderVisibility({
      schema: companyCount(),
      formData: { company: "a" },
      variableAggregates: {
        status: VariableAggregatesStatus.SourceUnavailable,
        aggregates: new Map(),
      },
    });

    expect(result.current.variablesError).toBeNull();
    expect(result.current.variableValues.has("count")).toBe(false);
  });

  const noteField: TextField = {
    ...textField("note"),
    visibleIfFormula: {
      conditions: {
        c1: { kind: "equals", when: "name", equals: "Ada" },
      },
      formula: "c1",
    },
  };

  const notesSchema: FormSchema = {
    pages: [
      {
        id: "p1",
        fields: [listField("people", [textField("name"), noteField])],
      },
    ],
    outputViews: [],
    variables: [
      {
        name: "notes",
        inputs: {
          input1: {
            kind: "list",
            fieldId: "people",
            properties: { name: "name", note: "note" },
          },
        },
        formula: "input1.map(p => p.name + ':' + (p.note ?? '-')).join()",
      },
    ],
  };

  const renderNotes = (params: {
    readOnly: boolean;
    formData: Record<string, FormValue>;
  }) =>
    renderHook(
      (formData: Record<string, FormValue>) =>
        useFormVisibility({
          schema: notesSchema,
          formData,
          readOnly: params.readOnly,
          currentPageIndex: 0,
          setCurrentPageIndex: () => {},
          setFormData: () => {},
          effectiveDeviceType: "desktop",
          visibilityValidatorResults: {},
          fieldLookup: lookupFor(notesSchema),
          previousAnswerData: undefined,
          sourceHistories: NO_SOURCES_READY,
          variableAggregates: NO_AGGREGATES_READY,
          randomizationKey: "form:1:user:1",
          userHasCity: false,
          firstContractSignedAt: null,
          completedActionCount: 0,
          visibilityInputs: SETTLED_INPUTS,
        }),
      { initialProps: params.formData },
    );

  it("recomputes a list variable as rows change, leaving out a sub-field hidden for its row", () => {
    const { result, rerender } = renderNotes({
      readOnly: false,
      formData: { people: [{ name: "Ada", note: "hi" }] },
    });
    expect(result.current.variableValues.get("notes")).toBe("Ada:hi");

    rerender({
      people: [
        { name: "Ada", note: "hi" },
        { name: "Lin", note: "kept from before" },
      ],
    });
    expect(result.current.variableValues.get("notes")).toBe("Ada:hi,Lin:-");
  });

  it("reads a stored cell a read-only review shows, even with its condition false", () => {
    const row = { name: "Lin", note: "answered" };
    const { result } = renderNotes({
      readOnly: true,
      formData: { people: [row] },
    });
    expect(
      result.current.fieldContext.forRow(row).visibleSubFields([noteField]),
    ).toEqual([noteField]);
    expect(result.current.variableValues.get("notes")).toBe("Lin:answered");
  });

  it("stays put while the current page is visible", () => {
    const moves: number[] = [];
    renderVisibility({
      formData: { gate: "yes" },
      currentPageIndex: 1,
      setCurrentPageIndex: (index) => moves.push(index),
    });

    expect(moves).toEqual([]);
  });

  const noteSub: TextField = {
    ...textField("note"),
    requiredIfFormula: gatedOnYes,
  };
  const extraSub: TextField = {
    ...textField("extra"),
    visibleIfFormula: gatedOnYes,
  };
  const joinedOnYes = {
    conditions: {
      c1: { kind: "equals" as const, when: "joined", equals: "yes" },
    },
    formula: "c1",
  };
  const joinedSub: TextField = {
    ...textField("since"),
    visibleIfFormula: joinedOnYes,
    requiredIfFormula: joinedOnYes,
  };

  it("reads a list row's conditions off that row's cells over the form's answers", () => {
    const { result } = renderVisibility({
      schema: schemaWith([
        textField("joined"),
        listField("people", [textField("gate"), noteSub, extraSub, joinedSub]),
      ]),
      formData: { joined: "yes" },
    });
    const answered = result.current.fieldContext.forRow({ gate: "yes" });
    const blank = result.current.fieldContext.forRow({ gate: "no" });

    expect(answered.isFieldRequired(noteSub)).toBe(true);
    expect(blank.isFieldRequired(noteSub)).toBe(false);
    expect(blank.isFieldRequired(joinedSub)).toBe(true);
    expect(answered.visibleSubFields([noteSub, extraSub, joinedSub])).toEqual([
      noteSub,
      extraSub,
      joinedSub,
    ]);
    expect(blank.visibleSubFields([noteSub, extraSub, joinedSub])).toEqual([
      noteSub,
      joinedSub,
    ]);
  });

  it("reports a variable reading a field kind this build doesn't know", () => {
    const { result } = renderVisibility({
      schema: {
        ...schemaWith([
          JSON.parse(
            '{ "id": "future", "type": "input", "kind": "future", "label": "Future" }',
          ),
        ]),
        variables: [
          {
            name: "total",
            inputs: { input1: { kind: "field", fieldId: "future" } },
            formula: "input1 ?? 'n/a'",
          },
        ],
      },
      formData: { future: "answered" },
    });

    expect(result.current.variablesError).toBe(
      "#{total}: Unknown field kind: future",
    );
    expect(result.current.variableValues.size).toBe(0);
  });
});
