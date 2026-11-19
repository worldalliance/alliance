import {
  isQuestionField,
  type AnyField,
  type FormSchema,
  type FormValue,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import { isEqual } from "es-toolkit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getFallbackVisiblePageIndex,
  getNextVisiblePageIndex,
  getPreviousVisiblePageIndex,
  resolveDisplayBlockForUser,
} from "../formrenderer";
import { taskFlow } from "../lib/copy";
import { useMarkTaskCompleting } from "../lib/TaskFlowCompletionContext";
import { type FormVisibility } from "../useFormRenderer";
import {
  buildFlowScreens,
  flowProgress,
  flowResumeIndex,
  flowScreenHeading,
  visibleFlowScreenIndices,
  withoutEmptySections,
} from "./flowScreens";
import { type SubmitOutcome } from "./submitOutcome";
import { type FlowPosition } from "./useFlowPosition";
import { SourceHistoriesStatus } from "./useVariableSourceHistories";
import { type VariableInputsGate } from "./variableInputsGate";

export enum FlowStage {
  Closed = "closed",
  Screens = "screens",
  Complete = "complete",
}

const IS_OPEN: Record<FlowStage, boolean> = {
  [FlowStage.Closed]: false,
  [FlowStage.Screens]: true,
  [FlowStage.Complete]: false,
};

export enum TaskFlowMode {
  Live = "live",
  /** A staff preview. */
  Preview = "preview",
  ReadOnly = "readOnly",
}

/** What a flow may do in each mode, for useTaskFlow and both platforms' form state. */
export const TASK_FLOW_MODE_RULES: Record<
  TaskFlowMode,
  {
    /** Answers save as a draft, the screen persists, and Submit records the completion. */
    records: boolean;
    /** Inputs show the answers but can't change them, so Next doesn't check them. */
    readOnly: boolean;
    /** The member can withdraw from the action. */
    withdraws: boolean;
    /** The card outlines the task's steps by their page headers. */
    outline: boolean;
    beginLabel: string;
    /** The begin label once the member has started. */
    resumeLabel: string;
    lastLabel: string;
  }
> = {
  [TaskFlowMode.Live]: {
    records: true,
    readOnly: false,
    withdraws: true,
    outline: true,
    beginLabel: taskFlow.begin,
    resumeLabel: taskFlow.continue,
    lastLabel: taskFlow.submit,
  },
  [TaskFlowMode.Preview]: {
    records: false,
    readOnly: false,
    withdraws: false,
    outline: true,
    beginLabel: taskFlow.begin,
    resumeLabel: taskFlow.continue,
    lastLabel: taskFlow.submit,
  },
  [TaskFlowMode.ReadOnly]: {
    records: false,
    readOnly: true,
    withdraws: false,
    outline: false,
    beginLabel: taskFlow.view,
    resumeLabel: taskFlow.view,
    lastLabel: taskFlow.done,
  },
};

export function taskFlowMode(params: {
  submitted: boolean;
  disabled: boolean;
  preview: boolean;
  completable: boolean;
}): TaskFlowMode {
  const { submitted, disabled, preview, completable } = params;
  if (submitted || disabled) return TaskFlowMode.ReadOnly;
  if (preview) return TaskFlowMode.Preview;
  return completable ? TaskFlowMode.Live : TaskFlowMode.ReadOnly;
}

const UNSAVED_POSITION: FlowPosition = {
  screenIndex: null,
  loaded: true,
  save: () => {},
  clear: () => {},
};

export type TaskFlowFormState = Pick<
  FormVisibility,
  | "visiblePageIndices"
  | "isElementCurrentlyVisible"
  | "visibilitySettled"
  | "visibilityFailed"
  | "validateFieldValue"
  | "effectiveFormData"
  | "variableValues"
  | "variablesError"
> & {
  schema: FormSchema;
  draftSettled: boolean;
  draftFailed: boolean;
  gate: VariableInputsGate;
  activeUserKey: string | undefined;
  currentPageIndex: number;
  setCurrentPageIndex: (pageIndex: number) => void;
  /** Validates the fields of one flow screen, showing their errors. */
  validateScreenFields: (fields: AnyField[]) => Promise<boolean>;
  submit: () => Promise<SubmitOutcome>;
};

function outlineInputFailed(form: TaskFlowFormState): boolean {
  if (form.draftFailed) return true;
  // Variables report an error while their inputs load, so the gate goes first.
  switch (form.gate.status) {
    case SourceHistoriesStatus.Loading:
      return false;
    case SourceHistoriesStatus.Failed:
    case SourceHistoriesStatus.SourceDeleted:
      return true;
    case SourceHistoriesStatus.Ready:
      return form.variablesError !== null || form.visibilityFailed;
    default:
      throw new Error(
        `unknown variable inputs status: ${form.gate satisfies never}`,
      );
  }
}

/**
 * The full-screen task flow's stage and screen, over the form's own answer
 * state. Screens come from `buildFlowScreens`, one per form page.
 */
export function useTaskFlow(params: {
  actionId: number;
  mode: TaskFlowMode;
  form: TaskFlowFormState;
  position: FlowPosition;
  /** Closes the flow with the platform's exit animation, on Back from the first screen and when a read-only flow's last screen is done. */
  onExit: () => void;
}) {
  const { actionId, mode, form, onExit } = params;
  const rules = TASK_FLOW_MODE_RULES[mode];
  const position = rules.records ? params.position : UNSAVED_POSITION;
  const [stage, setStage] = useState(FlowStage.Closed);
  const [screenIndex, setScreenIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<
    string,
    FormValue
  > | null>(null);
  useMarkTaskCompleting({
    actionId,
    completing: rules.records && (submitting || stage === FlowStage.Complete),
  });

  const screens = useMemo(() => buildFlowScreens(form.schema), [form.schema]);
  const { isElementCurrentlyVisible, activeUserKey } = form;
  const isElementVisible = useCallback(
    (element: PageItem) =>
      isElementCurrentlyVisible(
        isQuestionField(element)
          ? element
          : resolveDisplayBlockForUser(element, activeUserKey),
      ),
    [isElementCurrentlyVisible, activeUserKey],
  );
  const visibleIndices = useMemo(
    () =>
      visibleFlowScreenIndices({
        screens,
        visiblePageIndices: form.visiblePageIndices,
        isElementVisible,
      }),
    [screens, form.visiblePageIndices, isElementVisible],
  );

  const screen = screens[screenIndex];
  const visibleScreen = useMemo(
    () =>
      screen && {
        ...screen,
        elements: withoutEmptySections(screen.elements, isElementVisible),
      },
    [screen, isElementVisible],
  );
  const nextIndex = getNextVisiblePageIndex(visibleIndices, screenIndex);
  const previousIndex = getPreviousVisiblePageIndex(
    visibleIndices,
    screenIndex,
  );
  const screenFields = screen?.elements.filter(isQuestionField) ?? [];
  const nextReady =
    rules.readOnly ||
    (form.visibilitySettled &&
      screenFields.every(
        (field) =>
          !isElementCurrentlyVisible(field) ||
          form.validateFieldValue(field, form.effectiveFormData[field.id]) ===
            null,
      ));
  // Both set on each move rather than derived, so answering doesn't move the
  // bar or take the auto-save note away mid-step.
  const [pastFirstStep, setPastFirstStep] = useState(false);
  const [progress, setProgress] = useState(0);
  const showProgressAt = (index: number, { forward }: { forward: boolean }) => {
    // Before visibility settles the step list is still missing pages, and a
    // share written from it would stick; the effect below writes it instead.
    if (!form.visibilitySettled) return;
    const reached = flowProgress({ visibleIndices, screenIndex: index });
    setProgress((shown) => (forward ? Math.max(shown, reached) : reached));
  };

  useEffect(() => {
    if (!form.visibilitySettled || !IS_OPEN[stage]) return;
    setProgress(flowProgress({ visibleIndices, screenIndex }));
  }, [form.visibilitySettled]);

  // Back and close count as moves, so a step awaited before them doesn't
  // carry the member anywhere afterwards.
  const moves = useRef(0);
  const close = useCallback(() => {
    moves.current += 1;
    setStage(FlowStage.Closed);
  }, []);

  const goTo = (index: number, { forward }: { forward: boolean }) => {
    setScreenIndex(index);
    setPastFirstStep(visibleIndices.indexOf(index) > 0);
    form.setCurrentPageIndex(screens[index].pageIndex);
    position.save(index);
    showProgressAt(index, { forward });
    setStage(FlowStage.Screens);
  };

  const complete = () => {
    position.clear();
    setSubmittedAnswers(form.effectiveFormData);
    setStage(FlowStage.Complete);
  };

  const submit = async () => {
    switch (mode) {
      case TaskFlowMode.ReadOnly:
        onExit();
        return;
      case TaskFlowMode.Preview:
        complete();
        return;
      case TaskFlowMode.Live:
        break;
      default:
        throw new Error(`unknown task flow mode: ${mode satisfies never}`);
    }
    const since = moves.current;
    setSubmitting(true);
    try {
      const outcome = await form.submit();
      if (outcome.submitted) {
        complete();
        return;
      }
      if (moves.current !== since) return;
      const invalidScreen = visibleIndices.find(
        (i) => screens[i].pageIndex === outcome.firstInvalidPageIndex,
      );
      if (invalidScreen !== undefined) goTo(invalidScreen, { forward: true });
    } finally {
      setSubmitting(false);
    }
  };

  const advancing = useRef(false);
  const advance = async (step: () => Promise<void>) => {
    if (advancing.current || !form.visibilitySettled) return;
    advancing.current = true;
    try {
      await step();
    } finally {
      advancing.current = false;
    }
  };

  /** Opens the flow where the member left off; it never submits on its own. */
  const begin = () => {
    if (!position.loaded) {
      console.error("Task flow began before its saved screen loaded");
      return;
    }
    const saved = position.screenIndex;
    // Until visibility settles the saved screen may not show as visible yet,
    // and falling back would save over it.
    if (
      saved !== null &&
      screens[saved] !== undefined &&
      (visibleIndices.includes(saved) || !form.visibilitySettled)
    ) {
      goTo(saved, { forward: false });
      return;
    }
    // The draft's page may not show as visible yet either, and the fallback
    // would move the draft off it.
    if (!form.visibilitySettled) {
      setBeginOnSettle(true);
      return;
    }
    const resumeAt = flowResumeIndex({
      screens,
      visibleIndices,
      pageIndex: form.currentPageIndex,
    });
    if (resumeAt === null) {
      console.error("Task flow has no visible screen to open");
      return;
    }
    goTo(resumeAt, { forward: false });
  };

  const [beginOnSettle, setBeginOnSettle] = useState(false);
  useEffect(() => {
    if (!beginOnSettle || !form.visibilitySettled) return;
    setBeginOnSettle(false);
    begin();
  }, [beginOnSettle, form.visibilitySettled]);

  const back = () => {
    moves.current += 1;
    if (previousIndex !== null) goTo(previousIndex, { forward: false });
    else onExit();
  };

  // `begin` can open the flow before visibility settles; settling, or a later
  // answer, may hide the open screen.
  const stranded =
    form.visibilitySettled &&
    stage === FlowStage.Screens &&
    !visibleIndices.includes(screenIndex);
  useEffect(() => {
    if (!stranded) return;
    const fallback = getFallbackVisiblePageIndex(visibleIndices, screenIndex);
    if (fallback !== null) goTo(fallback, { forward: true });
    else onExit();
  }, [stranded]);

  const nextIsLast = nextIndex === null;
  // A failure before the outline lists shows the begin row without one. One
  // arriving after the input recovers would push begin down, so it stays empty
  // for this mount. Once listed, the outline keeps its last listing while an
  // input fails or reloads, since emptying it would move begin up.
  const inputFailed = outlineInputFailed(form);
  const [outlineFailed, setOutlineFailed] = useState(false);
  const [listedOutline, setListedOutline] = useState<string[] | null>(null);
  if (inputFailed && listedOutline === null && !outlineFailed) {
    setOutlineFailed(true);
  }
  const inputsReady =
    !inputFailed &&
    !outlineFailed &&
    form.gate.status === SourceHistoriesStatus.Ready &&
    form.visibilitySettled &&
    form.draftSettled;
  const liveOutline = inputsReady
    ? [
        ...new Set(
          visibleIndices.flatMap((index) => {
            const heading = flowScreenHeading({ screen: screens[index], form });
            const text = heading?.trim();
            return text ? [text] : [];
          }),
        ),
      ]
    : null;
  if (liveOutline && !isEqual(liveOutline, listedOutline)) {
    setListedOutline(liveOutline);
  }
  const outline = (): string[] | null => {
    // An outline that can't list anything is empty rather than pending, so the
    // begin row doesn't wait on it.
    if (!rules.outline || !screens.some((screen) => screen.heading)) return [];
    if (outlineFailed || (inputFailed && listedOutline === null)) return [];
    return liveOutline ?? listedOutline;
  };

  const next = () =>
    advance(async () => {
      const since = moves.current;
      if (!rules.readOnly && !(await form.validateScreenFields(screenFields))) {
        return;
      }
      if (moves.current !== since) return;
      if (nextIndex === null) await submit();
      else goTo(nextIndex, { forward: true });
    });

  return {
    stage,
    open: IS_OPEN[stage],
    screen: visibleScreen,
    screenIndex,
    /**
     * The distinct non-blank headers of the visible pages, null until
     * visibility, variables and the draft settle. Empty when the mode shows no
     * outline, no page has a header, or visibility, variables or a draft fetch
     * fail before it lists; once listed, it keeps its last listing while they
     * fail or reload.
     */
    outline: outline(),
    progressSaved:
      rules.records && stage === FlowStage.Screens && pastFirstStep,
    nextLabel: nextIsLast ? rules.lastLabel : taskFlow.next,
    nextIsLast,
    beginLabel:
      position.screenIndex !== null ||
      form.currentPageIndex > (form.visiblePageIndices[0] ?? 0)
        ? rules.resumeLabel
        : rules.beginLabel,
    nextReady,
    progress,
    submittedAnswers,
    begin,
    back,
    next,
    close,
  };
}
