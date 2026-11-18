import type {
  DisplayBlock,
  HeaderBlock,
} from "@alliance/common/forms/display-blocks";
import type {
  AnyField,
  FormSchema,
  FormValue,
} from "@alliance/common/forms/form-schema";
import { renderHook } from "@testing-library/react";
import {
  TaskFlowCompletionProvider,
  useHeldWhileTaskCompletes,
} from "../lib/TaskFlowCompletionContext";
import { type SubmitOutcome } from "./submitOutcome";
import { type FlowPosition } from "./useFlowPosition";
import {
  TaskFlowMode,
  useTaskFlow,
  type TaskFlowFormState,
} from "./useTaskFlow";
import { SourceHistoriesStatus } from "./useVariableSourceHistories";
import { type VariableInputsGate } from "./variableInputsGate";

export const input = (id: string): AnyField => ({
  id,
  type: "input",
  kind: "textarea",
  label: id,
  required: true,
});
export const header = (id: string): HeaderBlock => ({
  id,
  type: "display",
  kind: "header",
  text: id,
});
export const text = (id: string): DisplayBlock => ({
  id,
  type: "display",
  kind: "text",
  text: id,
});

// Screens: 0 "intro" text, 1 "h" with a and b, 2 "h2" with c.
export const schema: FormSchema = {
  pages: [
    { id: "p1", fields: [text("intro")] },
    { id: "p2", fields: [header("h"), input("a"), input("b")] },
    { id: "p3", fields: [header("h2"), input("c")] },
  ],
  outputViews: [],
};

type Overrides = {
  mode?: TaskFlowMode;
  schema?: FormSchema;
  answers?: Record<string, FormValue>;
  savedScreen?: number | null;
  screenValid?: boolean | Promise<boolean>;
  outcome?: SubmitOutcome;
  visiblePageIndices?: number[];
  currentPageIndex?: number;
  visibilitySettled?: boolean;
  visibilityFailed?: boolean;
  draftSettled?: boolean;
  draftFailed?: boolean;
  gate?: VariableInputsGate;
  variablesError?: string;
  positionLoaded?: boolean;
  submit?: () => Promise<SubmitOutcome>;
};

function flowParams(overrides: Overrides = {}) {
  const answers = overrides.answers ?? {};
  const saved: number[] = [];
  const cleared: true[] = [];
  const submits: true[] = [];
  const exits: true[] = [];
  const position: FlowPosition = {
    screenIndex: overrides.savedScreen ?? null,
    loaded: overrides.positionLoaded ?? true,
    save: (index) => saved.push(index),
    clear: () => cleared.push(true),
  };
  const form: TaskFlowFormState = {
    schema: overrides.schema ?? schema,
    visiblePageIndices: overrides.visiblePageIndices ?? [0, 1, 2],
    isElementCurrentlyVisible: () => true,
    visibilitySettled: overrides.visibilitySettled ?? true,
    visibilityFailed: overrides.visibilityFailed ?? false,
    draftSettled: overrides.draftSettled ?? true,
    draftFailed: overrides.draftFailed ?? false,
    validateFieldValue: (_field, value) => (value ? null : "Required"),
    effectiveFormData: answers,
    activeUserKey: undefined,
    variableValues: new Map(),
    variablesError: overrides.variablesError ?? null,
    gate: overrides.gate ?? { status: SourceHistoriesStatus.Ready },
    currentPageIndex: overrides.currentPageIndex ?? 0,
    setCurrentPageIndex: () => {},
    validateScreenFields: async () => overrides.screenValid ?? true,
    submit: async () => {
      submits.push(true);
      if (overrides.submit) return overrides.submit();
      return (
        overrides.outcome ?? { submitted: true, firstInvalidPageIndex: null }
      );
    },
  };
  const mode = overrides.mode ?? TaskFlowMode.Live;
  return {
    params: {
      actionId: 1,
      mode,
      form,
      position,
      onExit: () => exits.push(true),
    },
    saved,
    cleared,
    submits,
    exits,
  };
}

export function setup(overrides: Overrides = {}) {
  const { params, saved, cleared, submits, exits } = flowParams(overrides);
  const hook = renderHook(() => useTaskFlow(params), {
    wrapper: TaskFlowCompletionProvider,
  });
  return { hook, params, saved, cleared, submits, exits };
}

export function setupWithPage(overrides: Overrides) {
  const { params } = flowParams(overrides);
  return renderHook(
    ({ page }) => ({
      flow: useTaskFlow(params),
      page: useHeldWhileTaskCompletes(page, params.actionId),
    }),
    { wrapper: TaskFlowCompletionProvider, initialProps: { page: "before" } },
  );
}
