import {
  isQuestionField,
  type AnyField,
  type FormSchema,
  type FormValue,
  type ListField,
  type TextField,
} from "@alliance/common/forms/form-schema";
import type { VariableSourceHistory } from "@alliance/common/forms/variable-evaluation";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  VariableAggregatesStatus,
  type VariableAggregates,
} from "./forms/useVariableAggregates";
import {
  NO_SOURCE_HISTORIES,
  SourceHistoriesStatus,
  type SourceHistories,
} from "./forms/useVariableSourceHistories";
import { routes, serveApi } from "./lib/testing/serveApi";
import {
  useFieldErrors,
  useFormDraftSync,
  useFormSchemaMaps,
  useFormValidation,
  useFormVisibility,
  usePreviousAnswerSources,
  useRandomizationKey,
  useVisibilityValidatorResults,
  type FormVisibility,
  type VisibilityInputsPending,
} from "./useFormRenderer";

afterEach(cleanup);

const textField = (id: string): TextField => ({
  id,
  type: "input",
  kind: "text",
  label: id,
});

const listField = (id: string, fields: ListField["fields"]): ListField => ({
  id,
  type: "input",
  kind: "list",
  label: id,
  fields,
});

const schemaWith = (fields: AnyField[]): FormSchema => ({
  pages: [{ id: "p1", fields }],
  outputViews: [],
});

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

describe("useVisibilityValidatorResults", () => {
  const gatedSchema: FormSchema = {
    pages: [
      {
        id: "p1",
        fields: [],
        visibleIfFormula: {
          conditions: { c1: { kind: "validator", validatorId: 42 } },
          formula: "c1",
        },
      },
    ],
    outputViews: [],
  };

  it("replays a completed response's saved verdicts", () => {
    const { result } = renderHook(() =>
      useVisibilityValidatorResults({
        schema: gatedSchema,
        readOnly: true,
        signedIn: true,
        savedResults: { 42: false },
      }),
    );
    expect(result.current.results[42]).toBe(false);
  });

  // A response saved before the validator existed has no verdict for it, and a
  // missing verdict evaluates as hidden, which would blank out a page the
  // submitter actually filled in.
  it("treats a validator the saved response never recorded as passing", () => {
    const { result } = renderHook(() =>
      useVisibilityValidatorResults({
        schema: gatedSchema,
        readOnly: true,
        signedIn: true,
        savedResults: {},
      }),
    );
    expect(result.current.results[42]).toBe(true);
  });

  it("says a run failed rather than leave its hidden verdict unexplained", async () => {
    const original = console.error;
    console.error = () => {};
    try {
      api.alsoServing({
        "POST /tasks/runValidator/:id": () => json({ message: "down" }, 500),
      });
      const { result } = renderHook(() =>
        useVisibilityValidatorResults({
          schema: gatedSchema,
          readOnly: false,
          signedIn: true,
        }),
      );

      expect(result.current.failed).toBe(false);
      await waitFor(() => expect(result.current.failed).toBe(true));
      expect(result.current.results[42]).toBe(false);
    } finally {
      console.error = original;
    }
  });

  it("forgets a failed run once the validator, removed and added back, passes", async () => {
    const original = console.error;
    console.error = () => {};
    try {
      let runs = 0;
      api.alsoServing({
        "POST /tasks/runValidator/:id": () => {
          runs += 1;
          return runs === 1
            ? json({ message: "down" }, 500)
            : json({ isValid: true });
        },
      });
      const { result, rerender } = renderHook(
        ({ schema }) =>
          useVisibilityValidatorResults({
            schema,
            readOnly: false,
            signedIn: true,
          }),
        { initialProps: { schema: gatedSchema } },
      );
      await waitFor(() => expect(result.current.failed).toBe(true));

      rerender({ schema: { pages: [], outputViews: [] } });
      rerender({ schema: gatedSchema });

      await waitFor(() => expect(result.current.results[42]).toBe(true));
      expect(result.current.failed).toBe(false);
    } finally {
      console.error = original;
    }
  });

  it("fails a guest's validators without running them", () => {
    let ran = false;
    api.alsoServing({
      "POST /tasks/runValidator/:id": () => {
        ran = true;
        return json({ isValid: true });
      },
    });
    const { result } = renderHook(() =>
      useVisibilityValidatorResults({
        schema: gatedSchema,
        readOnly: false,
        signedIn: false,
      }),
    );

    expect(result.current).toEqual({ results: { 42: false }, failed: false });
    expect(ran).toBe(false);
  });

  it("falls back to passing when the saved verdict is unreadable", () => {
    const logged: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => logged.push(args);
    try {
      const { result } = renderHook(() =>
        useVisibilityValidatorResults({
          schema: gatedSchema,
          readOnly: true,
          signedIn: true,
          savedResults: { 42: "not a boolean" },
        }),
      );
      expect(result.current.results[42]).toBe(true);
      expect(logged).toHaveLength(1);
    } finally {
      console.error = original;
    }
  });
});

describe("useFieldErrors", () => {
  it("sets and clears messages, treating blank as cleared", () => {
    const { result } = renderHook(() => useFieldErrors());

    act(() => result.current.applyFieldErrorUpdates({ a: "required" }));
    expect(result.current.fieldErrors).toEqual({ a: "required" });

    act(() => result.current.applyFieldErrorUpdates({ a: "   " }));
    expect(result.current.fieldErrors).toEqual({});
  });

  it("clears list sub-field errors by their parent prefix", () => {
    const { result } = renderHook(() => useFieldErrors());

    act(() =>
      result.current.applyFieldErrorUpdates({
        "list:0:street": "required",
        other: "required",
      }),
    );
    expect(Object.keys(result.current.fieldErrors).sort()).toEqual([
      "list:0:street",
      "other",
    ]);

    act(() => result.current.applyFieldErrorUpdates({}, ["list"]));
    expect(result.current.fieldErrors).toEqual({ other: "required" });
  });

  it("drops every message at once", () => {
    const { result } = renderHook(() => useFieldErrors());

    act(() => result.current.applyFieldErrorUpdates({ a: "x", b: "y" }));
    act(() => result.current.clearFieldErrors());
    expect(result.current.fieldErrors).toEqual({});
  });
});

/**
 * A two-page schema whose second page, and the field on it, appear only once
 * `gate` answers "yes".
 */
const gatedOnYes = {
  conditions: { c1: { kind: "equals" as const, when: "gate", equals: "yes" } },
  formula: "c1",
};

const twoPageSchema: FormSchema = {
  pages: [
    { id: "p1", fields: [textField("gate")] },
    {
      id: "p2",
      fields: [{ ...textField("detail"), required: true }],
      visibleIfFormula: gatedOnYes,
    },
  ],
  outputViews: [],
};

function lookupFor(schema: FormSchema): Map<string, AnyField> {
  return new Map(
    schema.pages
      .flatMap((page) => page.fields)
      .filter(isQuestionField)
      .map((field) => [field.id, field]),
  );
}

const SETTLED_INPUTS: VisibilityInputsPending = {
  visibilityContextLoading: false,
  visibilityContextFailed: false,
  visibilityValidatorsFailed: false,
  userLoading: false,
  previousAnswersPending: false,
};

const NO_SOURCES_READY: SourceHistories = {
  status: SourceHistoriesStatus.Ready,
  sources: NO_SOURCE_HISTORIES,
};

const NO_AGGREGATES_READY: VariableAggregates = {
  status: VariableAggregatesStatus.Ready,
  aggregates: new Map(),
};

function renderVisibility(args: {
  schema?: FormSchema;
  formData: Record<string, FormValue>;
  currentPageIndex?: number;
  setCurrentPageIndex?: (index: number) => void;
  setFormData?: Parameters<typeof useFormVisibility>[0]["setFormData"];
  sourceHistories?: SourceHistories;
  variableAggregates?: VariableAggregates;
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

function renderValidation(args: {
  schema: FormSchema;
  formData: Record<string, FormValue>;
}) {
  return renderHook(
    (formData: Record<string, FormValue>) => {
      const { applyFieldErrorUpdates, fieldErrors } = useFieldErrors();
      const visibility: FormVisibility = useFormVisibility({
        schema: args.schema,
        formData,
        readOnly: false,
        currentPageIndex: 0,
        setCurrentPageIndex: () => {},
        setFormData: () => {},
        effectiveDeviceType: "desktop",
        visibilityValidatorResults: {},
        fieldLookup: lookupFor(args.schema),
        previousAnswerData: undefined,
        sourceHistories: NO_SOURCES_READY,
        variableAggregates: NO_AGGREGATES_READY,
        userHasCity: false,
        firstContractSignedAt: null,
        completedActionCount: 0,
        visibilityInputs: SETTLED_INPUTS,
      });
      const validation = useFormValidation({
        schema: args.schema,
        readOnly: false,
        effectiveFormData: visibility.effectiveFormData,
        visibilityExtras: visibility.visibilityExtras,
        visiblePageIndices: visibility.visiblePageIndices,
        isElementCurrentlyVisible: visibility.isElementCurrentlyVisible,
        validateFieldValue: visibility.validateFieldValue,
        applyFieldErrorUpdates,
      });
      return { ...validation, fieldErrors, applyFieldErrorUpdates };
    },
    { initialProps: args.formData },
  );
}

/** `act` around a validation run, so the error state it sets is flushed. */
async function validate<T>(run: () => Promise<T>): Promise<T> {
  let pending!: Promise<T>;
  await act(async () => {
    pending = run();
    await pending;
  });
  return pending;
}

describe("useFormValidation", () => {
  it("passes a hidden page and clears the errors its fields left", async () => {
    const { result } = renderValidation({
      schema: twoPageSchema,
      formData: { gate: "no" },
    });

    act(() => result.current.applyFieldErrorUpdates({ detail: "stale" }));
    expect(result.current.fieldErrors.detail).toBe("stale");

    const page = await validate(() => result.current.validatePage(1, false));
    expect(page.isValid).toBe(true);
    expect(result.current.fieldErrors.detail).toBeUndefined();
  });

  it("blocks the page on a required field the user can see", async () => {
    const { result } = renderValidation({
      schema: twoPageSchema,
      formData: { gate: "yes" },
    });

    const page = await validate(() => result.current.validatePage(1, false));
    expect(page.isValid).toBe(false);
    expect(page.firstInvalidFieldId).toBe("detail");
  });

  // The error key is `parentId:cardIndex:subId`, which is no field's id, so the
  // caller is pointed at the list that owns the card instead.
  it("blocks the page on an invalid list sub-field", async () => {
    const schema = schemaWith([
      listField("addresses", [{ ...textField("street"), required: true }]),
    ]);
    const { result } = renderValidation({
      schema,
      formData: { addresses: [{ street: "" }] },
    });

    const page = await validate(() => result.current.validatePage(0, false));
    expect(page.isValid).toBe(false);
    expect(page.firstInvalidFieldId).toBe("addresses");
    expect(result.current.fieldErrors["addresses:0:street"]).toBeTruthy();
  });

  it("clears a card's errors once the list itself is hidden", async () => {
    const schema: FormSchema = {
      pages: [
        {
          id: "p1",
          fields: [
            textField("gate"),
            {
              ...listField("addresses", [
                { ...textField("street"), required: true },
              ]),
              visibleIfFormula: gatedOnYes,
            },
          ],
        },
      ],
      outputViews: [],
    };
    const { result, rerender } = renderValidation({
      schema,
      formData: { gate: "yes", addresses: [{ street: "" }] },
    });

    await validate(() => result.current.validatePage(0, false));
    expect(result.current.fieldErrors["addresses:0:street"]).toBeTruthy();

    rerender({ gate: "no", addresses: [{ street: "" }] });
    const page = await validate(() => result.current.validatePage(0, false));

    expect(page.isValid).toBe(true);
    expect(result.current.fieldErrors).toEqual({});
  });

  it("reports the first invalid page across the whole form", async () => {
    const schema: FormSchema = {
      pages: [
        { id: "p1", fields: [textField("free")] },
        { id: "p2", fields: [{ ...textField("needed"), required: true }] },
      ],
      outputViews: [],
    };
    const { result } = renderValidation({ schema, formData: {} });

    const all = await validate(() => result.current.validateAllPages());
    expect(all.isValid).toBe(false);
    expect(all.firstInvalidPageIndex).toBe(1);
    expect(all.firstInvalidFieldId).toBe("needed");
  });
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const storedDraft = {
  formId: 3,
  actionId: 4,
  formSnapshotId: 5,
  answers: { q1: "typed on the laptop" },
  publicAnswers: {},
  currentPageIndex: 1,
  updatedAt: "2026-09-16T00:00:00.000Z",
};

let fetchDraft: (formId: string) => Promise<Response>;
let fetches: number;
let saves: { formId: string; answers: Record<string, unknown> }[];

const pickSchema: FormSchema = schemaWith([
  {
    id: "pick",
    type: "input",
    kind: "multiselect",
    label: "Pick",
    options: [],
    optionsFormula: { inputs: {}, formula: "[]" },
  },
]);
const savedPick = [{ label: "Saved A", value: "a" }];

const api = serveApi(
  routes({
    "GET /tasks/slug/:id": () =>
      json({ id: 9, title: "Source", formSnapshotId: 1, schema: pickSchema }),
    "GET /tasks/myResponse/:id": () =>
      json({
        id: 1,
        formId: 9,
        formSnapshotId: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        answers: { pick: ["a"] },
        publicAnswers: {},
        schemaSnapshot: {},
        visibilityValidatorResults: {},
        formulaChoices: { pick: savedPick },
      }),
    "GET /tasks/formDraft/:id": ({ params }) => {
      fetches += 1;
      return fetchDraft(params.id);
    },
    "PUT /tasks/formDraft/:id": async ({ request, params }) => {
      const body = await request.json();
      saves.push({ formId: params.id, answers: body.answers });
      return json(storedDraft);
    },
  }),
);

const realSetTimeout = globalThis.setTimeout;

describe("useFormDraftSync", () => {
  const draftArgs = (answers: Record<string, FormValue>, formId = 3) => ({
    enabled: true,
    formId,
    actionId: 4,
    formSnapshotId: 5,
    answers,
    publicAnswers: {},
    currentPageIndex: 0,
    edited: true,
    onSaved: () => {},
  });

  /** Runs whatever the debounce has queued, and the request behind it. One
   * `act` per tick, so an effect armed by the last tick gets to run. */
  const settle = async () => {
    for (let tick = 0; tick < 5; tick += 1) {
      await act(async () => {
        await new Promise((resolve) => realSetTimeout(resolve, 0));
      });
    }
  };

  beforeEach(() => {
    // Collapses the save debounce to nothing. Not `jest.useFakeTimers`, which
    // in bun leaves `waitFor` broken for every later test file in the process.
    globalThis.setTimeout = ((handler: TimerHandler) =>
      realSetTimeout(handler, 0)) as typeof setTimeout;
    fetchDraft = async () => json({});
    fetches = 0;
    saves = [];
  });

  afterEach(() => {
    globalThis.setTimeout = realSetTimeout;
  });

  it("holds the first save until the stored draft has been fetched", async () => {
    let landFetch: (response: Response) => void = () => {};
    fetchDraft = () =>
      new Promise<Response>((resolve) => {
        landFetch = resolve;
      });

    const { result } = renderHook(() =>
      useFormDraftSync(draftArgs({ q1: "typed on the phone" })),
    );

    await settle();
    expect(saves).toHaveLength(0);

    landFetch(json({ draft: storedDraft }));
    await settle();

    expect(result.current.serverDraft?.answers).toEqual(storedDraft.answers);
    expect(saves[0]?.answers).toEqual({ q1: "typed on the phone" });
  });

  it("never saves when the fetch failed, so a stored draft survives", async () => {
    fetchDraft = async () => json({ message: "nope" }, 500);

    renderHook(() => useFormDraftSync(draftArgs({ q1: "typed on the phone" })));
    await settle();

    expect(fetches).toBe(1);
    expect(saves).toHaveLength(0);
  });

  it("drops a save queued while paused, and re-arms it on resume", async () => {
    const { result, rerender } = renderHook(
      (answers: Record<string, FormValue>) =>
        useFormDraftSync(draftArgs(answers)),
      { initialProps: { q1: "first" } },
    );

    await settle();
    expect(saves).toHaveLength(1);

    act(() => result.current.pauseSyncing());
    rerender({ q1: "second" });
    await settle();
    expect(saves).toHaveLength(1);

    act(() => result.current.resumeSyncing());
    await settle();

    expect(saves).toHaveLength(2);
    expect(saves[1].answers).toEqual({ q1: "second" });
  });

  it("gates again on the new form when the form changes under it", async () => {
    let landSecond: (response: Response) => void = () => {};
    fetchDraft = (formId) =>
      formId === "3"
        ? Promise.resolve(json({}))
        : new Promise<Response>((resolve) => {
            landSecond = resolve;
          });

    const { rerender } = renderHook(
      (formId: number) => useFormDraftSync(draftArgs({ q1: "first" }, formId)),
      { initialProps: 3 },
    );

    await settle();
    expect(saves).toHaveLength(1);

    rerender(7);
    await settle();
    expect(saves).toHaveLength(1);

    landSecond(json({}));
    await settle();

    expect(saves[1]?.formId).toBe("7");
  });
});

describe("usePreviousAnswerSources", () => {
  const previewResponse = {
    id: 1,
    formId: 9,
    formSnapshotId: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    answers: { pick: ["a"] },
    publicAnswers: {},
    schemaSnapshot: {},
    visibilityValidatorResults: {},
    formulaChoices: {},
  };

  const readsForm9: FormSchema = {
    pages: [
      {
        id: "p1",
        fields: [
          {
            id: "previous",
            type: "display",
            kind: "previousAnswer",
            sourceFormId: 9,
            sourceFieldId: "pick",
            showLabel: true,
          },
        ],
      },
    ],
    outputViews: [],
  };

  const renderSources = (signedIn = true, previewUserId?: number) =>
    renderHook(() =>
      usePreviousAnswerSources({ signedIn, previewUserId, schema: readsForm9 }),
    );

  it("reads a source response's formula answers with the choices it saved", async () => {
    const { result } = renderSources();

    expect(result.current.previousAnswersPending).toBe(true);
    await waitFor(() =>
      expect(result.current.previousAnswerData[9]).toEqual({ pick: ["a"] }),
    );
    expect(result.current.previousAnswersPending).toBe(false);
    const [pick] = result.current.previousAnswerSchemas[9].pages[0].fields;
    expect(pick).toMatchObject({
      options: savedPick,
      optionsFormula: undefined,
    });
  });

  it("is pending again while a source form read before reloads", async () => {
    const { result, rerender } = renderHook(
      ({ schema }) => usePreviousAnswerSources({ signedIn: true, schema }),
      { initialProps: { schema: readsForm9 } },
    );
    await waitFor(() =>
      expect(result.current.previousAnswersPending).toBe(false),
    );

    rerender({ schema: { pages: [], outputViews: [] } });
    rerender({ schema: readsForm9 });

    expect(result.current.previousAnswersPending).toBe(true);
  });

  const notSubmitted = {
    "GET /tasks/slug/:id": () =>
      json({ id: 9, title: "Source", formSnapshotId: 1, schema: {} }),
    "GET /tasks/myResponse/:id": () =>
      json({ message: "Form response not found" }, 404),
  };

  it.each([
    ["web", () => api.alsoServing(notSubmitted)],
    ["mobile", () => api.throwingOnRefusal(notSubmitted)],
  ])(
    "has loaded a source form the member never submitted, on %s",
    async (_, serve) => {
      serve();
      const { result } = renderSources();

      await waitFor(() =>
        expect(result.current.previousAnswersPending).toBe(false),
      );
      expect(result.current.previousAnswerData).toEqual({});
    },
  );

  it("has loaded a guest's source forms without asking for their responses", async () => {
    let asked = false;
    api.alsoServing({
      "GET /tasks/myResponse/:id": () => {
        asked = true;
        return json({ message: "Unauthorized" }, 401);
      },
    });
    const { result } = renderSources(false);

    await waitFor(() =>
      expect(result.current.previousAnswersPending).toBe(false),
    );
    expect(asked).toBe(false);
  });

  it("has loaded, for an admin preview, a member who never submitted the source form", async () => {
    api.alsoServing({
      "GET /tasks/responses/:id": () =>
        json([{ ...previewResponse, user: { id: 99 } }]),
    });
    const { result } = renderSources(true, 3);

    await waitFor(() =>
      expect(result.current.previousAnswersPending).toBe(false),
    );
    expect(result.current.previousAnswerData).toEqual({});
  });

  it("reads, for an admin preview, the member's formula answers with the choices they saved", async () => {
    api.alsoServing({
      "GET /tasks/responses/:id": () =>
        json([
          {
            ...previewResponse,
            user: { id: 3 },
            formulaChoices: { pick: savedPick },
          },
        ]),
    });
    const { result } = renderSources(true, 3);

    await waitFor(() =>
      expect(result.current.previousAnswerData[9]).toEqual({ pick: ["a"] }),
    );
    const [pick] = result.current.previousAnswerSchemas[9].pages[0].fields;
    expect(pick).toMatchObject({
      options: savedPick,
      optionsFormula: undefined,
    });
  });

  it("stays loading, for an admin preview, after the source responses fail to load", async () => {
    let failed = false;
    api.alsoServing({
      "GET /tasks/responses/:id": () => {
        failed = true;
        return json({ message: "down" }, 500);
      },
    });
    const { result } = renderSources(true, 3);

    await waitFor(() => expect(failed).toBe(true));
    await new Promise((resolve) => realSetTimeout(resolve, 0));
    expect(result.current.previousAnswersPending).toBe(true);
  });

  it("stays loading after a source response fails to load", async () => {
    let failed = false;
    api.alsoServing({
      "GET /tasks/myResponse/:id": () => {
        failed = true;
        return json({ message: "down" }, 500);
      },
    });
    const { result } = renderSources();

    await waitFor(() => expect(failed).toBe(true));
    await new Promise((resolve) => realSetTimeout(resolve, 0));
    expect(result.current.previousAnswersPending).toBe(true);
  });
});
