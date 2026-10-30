import {
  isQuestionField,
  type AnyField,
  type FormSchema,
  type FormValue,
  type PageItem,
} from "@alliance/common/forms/form-schema";
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
  backgroundScreenIndex,
  buildFlowScreens,
  flowProgress,
  flowResumeIndex,
  visibleFlowScreenIndices,
  withoutEmptySections,
} from "./flowScreens";
import { type SubmitOutcome } from "./submitOutcome";
import { type FlowPosition } from "./useFlowPosition";

export enum FlowStage {
  Closed = "closed",
  Background = "background",
  Screens = "screens",
  Complete = "complete",
}

const IS_OPEN: Record<FlowStage, boolean> = {
  [FlowStage.Closed]: false,
  [FlowStage.Background]: true,
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
    beginLabel: taskFlow.begin,
    resumeLabel: taskFlow.continue,
    lastLabel: taskFlow.submit,
  },
  [TaskFlowMode.Preview]: {
    records: false,
    readOnly: false,
    withdraws: false,
    beginLabel: taskFlow.begin,
    resumeLabel: taskFlow.continue,
    lastLabel: taskFlow.submit,
  },
  [TaskFlowMode.ReadOnly]: {
    records: false,
    readOnly: true,
    withdraws: false,
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
  | "validateFieldValue"
  | "effectiveFormData"
> & {
  schema: FormSchema;
  activeUserKey: string | undefined;
  currentPageIndex: number;
  setCurrentPageIndex: (pageIndex: number) => void;
  /** Validates the fields of one flow screen, showing their errors. */
  validateScreenFields: (fields: AnyField[]) => Promise<boolean>;
  submit: () => Promise<SubmitOutcome>;
};

/**
 * The full-screen task flow's stage and screen, over the form's own answer
 * state. Screens come from `buildFlowScreens`; the first one becomes the
 * background page when it asks for nothing.
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

  const backgroundIndex = backgroundScreenIndex({
    screens,
    visibleIndices,
    isElementVisible,
  });
  const flowIndices = visibleIndices.filter((i) => i !== backgroundIndex);
  const backgroundScreen =
    backgroundIndex === null ? null : screens[backgroundIndex];
  const background = useMemo(
    () =>
      backgroundScreen
        ? withoutEmptySections(
            form.schema.pages[backgroundScreen.pageIndex].fields,
            isElementVisible,
          )
        : [],
    [backgroundScreen, form.schema, isElementVisible],
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
  const nextIndex = getNextVisiblePageIndex(flowIndices, screenIndex);
  const previousIndex = getPreviousVisiblePageIndex(flowIndices, screenIndex);
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
    setProgress(
      flowProgress({
        visibleIndices,
        screenIndex:
          stage === FlowStage.Background
            ? (backgroundIndex ?? screenIndex)
            : screenIndex,
      }),
    );
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
    setPastFirstStep(
      backgroundIndex !== null || flowIndices.indexOf(index) > 0,
    );
    form.setCurrentPageIndex(screens[index].pageIndex);
    position.save(index);
    showProgressAt(index, { forward });
    setStage(FlowStage.Screens);
  };

  const showBackground = () => {
    if (backgroundIndex === null) return;
    setPastFirstStep(false);
    position.save(backgroundIndex);
    showProgressAt(backgroundIndex, { forward: false });
    setStage(FlowStage.Background);
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
      const invalidScreen = flowIndices.find(
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

  /** Leaves the background page for the screen the draft reached. */
  const start = () =>
    advance(async () => {
      const resumeAt = flowResumeIndex({
        screens,
        visibleIndices: flowIndices,
        pageIndex: form.currentPageIndex,
      });
      if (resumeAt === null) await submit();
      else goTo(resumeAt, { forward: true });
    });

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
      if (saved === backgroundIndex) showBackground();
      else goTo(saved, { forward: false });
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
      visibleIndices: flowIndices,
      pageIndex: form.currentPageIndex,
    });
    if (
      backgroundScreen &&
      (resumeAt === null || form.currentPageIndex <= backgroundScreen.pageIndex)
    ) {
      showBackground();
      return;
    }
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
    else if (backgroundScreen) showBackground();
    else onExit();
  };

  // `begin` can open the flow before visibility settles; settling, or a later
  // answer, may hide the open screen or change which screen is the background.
  const stranded =
    form.visibilitySettled &&
    ((stage === FlowStage.Screens && !flowIndices.includes(screenIndex)) ||
      (stage === FlowStage.Background && backgroundIndex === null));
  useEffect(() => {
    if (!stranded) return;
    if (stage === FlowStage.Screens && screenIndex === backgroundIndex) {
      showBackground();
      return;
    }
    const fallback =
      stage === FlowStage.Background
        ? flowResumeIndex({
            screens,
            visibleIndices: flowIndices,
            pageIndex: form.currentPageIndex,
          })
        : getFallbackVisiblePageIndex(flowIndices, screenIndex);
    if (fallback !== null) goTo(fallback, { forward: true });
    else if (backgroundScreen) showBackground();
    else onExit();
  }, [stranded]);

  const nextIsLast = nextIndex === null;
  const startIsLast = flowIndices.length === 0;

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
    progressSaved:
      rules.records && stage === FlowStage.Screens && pastFirstStep,
    background,
    nextLabel: nextIsLast ? rules.lastLabel : taskFlow.next,
    nextIsLast,
    startLabel: startIsLast ? rules.lastLabel : taskFlow.next,
    startIsLast,
    beginLabel:
      position.screenIndex !== null ||
      form.currentPageIndex > (form.visiblePageIndices[0] ?? 0)
        ? rules.resumeLabel
        : rules.beginLabel,
    nextReady,
    progress,
    submittedAnswers,
    begin,
    start,
    back,
    next,
    close,
  };
}
