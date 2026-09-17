import {
  flattenPageItems,
  isQuestionField,
  type AnyField,
  type FormSchema,
  type FormValue,
  type ListField,
  type TextField,
} from "@alliance/common/forms/form-schema";
import { act, cleanup, renderHook } from "@testing-library/react";
import { routes, serveApi } from "./lib/testing/serveApi";
import {
  useFieldErrors,
  useFormDraftSync,
  useFormSchemaMaps,
  useFormValidation,
  useFormVisibility,
  useRandomizationKey,
  useVisibilityValidatorResults,
  type FormVisibility,
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
      useFormSchemaMaps({ schema, userDefaultPublic: false }),
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
      useFormSchemaMaps({ schema, userDefaultPublic: true }),
    );

    expect(result.current.outputFieldDefaultPublic.get("shared")).toBe(true);
    expect(result.current.outputFieldDefaultPublic.get("secret")).toBe(false);
    expect(result.current.outputFieldIds.has("notOutput")).toBe(false);
  });

  it("reports the page bounds", () => {
    const { result } = renderHook(() =>
      useFormSchemaMaps({
        schema: { pages: [{ id: "a", fields: [] }], outputViews: [] },
        userDefaultPublic: false,
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
        savedResults: { 42: false },
      }),
    );
    expect(result.current[42]).toBe(false);
  });

  // A response saved before the validator existed has no verdict for it, and a
  // missing verdict evaluates as hidden, which would blank out a page the
  // submitter actually filled in.
  it("treats a validator the saved response never recorded as passing", () => {
    const { result } = renderHook(() =>
      useVisibilityValidatorResults({
        schema: gatedSchema,
        readOnly: true,
        savedResults: {},
      }),
    );
    expect(result.current[42]).toBe(true);
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
          savedResults: { 42: "not a boolean" },
        }),
      );
      expect(result.current[42]).toBe(true);
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
      .flatMap((page) => flattenPageItems(page.fields))
      .filter(isQuestionField)
      .map((field) => [field.id, field]),
  );
}

function renderVisibility(args: {
  schema?: FormSchema;
  formData: Record<string, FormValue>;
  currentPageIndex?: number;
  setCurrentPageIndex?: (index: number) => void;
}) {
  const schema = args.schema ?? twoPageSchema;
  return renderHook(() =>
    useFormVisibility({
      schema,
      formData: args.formData,
      readOnly: false,
      currentPageIndex: args.currentPageIndex ?? 0,
      setCurrentPageIndex: args.setCurrentPageIndex ?? (() => {}),
      effectiveDeviceType: "desktop",
      visibilityValidatorResults: {},
      fieldLookup: lookupFor(schema),
      previousAnswerData: undefined,
      userHasCity: false,
      firstContractSignedAt: null,
      completedActionCount: 0,
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
        effectiveDeviceType: "desktop",
        visibilityValidatorResults: {},
        fieldLookup: lookupFor(args.schema),
        previousAnswerData: undefined,
        userHasCity: false,
        firstContractSignedAt: null,
        completedActionCount: 0,
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

serveApi(
  routes({
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
