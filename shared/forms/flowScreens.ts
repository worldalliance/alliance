import {
  type DisplayKind,
  type HeaderBlock,
} from "@alliance/common/forms/display-blocks";
import {
  isQuestionField,
  type FormSchema,
  type PageItem,
} from "@alliance/common/forms/form-schema";
import { interpolateDisplayBlock } from "@alliance/common/forms/variable-interpolation";
import { resolveDisplayBlockForUser } from "../formrenderer";
import { taskFlow, taskFlowFallbackTitle } from "../lib/copy";
import { type FormVisibility } from "../useFormRenderer";

const isHeader = (element: PageItem): element is HeaderBlock =>
  !isQuestionField(element) && element.kind === "header";

export type FlowScreen = {
  pageIndex: number;
  /** The page's first header block, shown as the screen's title. */
  heading: HeaderBlock | null;
  elements: PageItem[];
};

/** One screen of the full-screen task flow per form page. */
export function buildFlowScreens(schema: FormSchema): FlowScreen[] {
  return schema.pages.map((page, pageIndex) => {
    const heading = page.fields.find(isHeader) ?? null;
    return {
      pageIndex,
      heading,
      elements: page.fields.filter((element) => element !== heading),
    };
  });
}

/** Drops each header block whose section, the blocks up to the next header, has blocks and shows none of them. */
export function withoutEmptySections(
  elements: PageItem[],
  isElementVisible: (element: PageItem) => boolean,
): PageItem[] {
  return elements.filter((element, index) => {
    if (!isHeader(element)) return true;
    const end = elements.findIndex((next, i) => i > index && isHeader(next));
    const section = elements.slice(index + 1, end === -1 ? undefined : end);
    return section.length === 0 || section.some(isElementVisible);
  });
}

export function visibleFlowScreenIndices(params: {
  screens: FlowScreen[];
  visiblePageIndices: number[];
  isElementVisible: (element: PageItem) => boolean;
}): number[] {
  const { screens, visiblePageIndices, isElementVisible } = params;
  return screens.flatMap((screen, index) =>
    visiblePageIndices.includes(screen.pageIndex) &&
    (screen.elements.length === 0
      ? screen.heading !== null && isElementVisible(screen.heading)
      : withoutEmptySections(screen.elements, isElementVisible).some(
          isElementVisible,
        ))
      ? [index]
      : [],
  );
}

/** The first visible screen when it asks for nothing, which the intro shows instead. */
export function backgroundScreenIndex(params: {
  screens: FlowScreen[];
  visibleIndices: number[];
  isElementVisible: (element: PageItem) => boolean;
}): number | null {
  const { screens, visibleIndices, isElementVisible } = params;
  const first = visibleIndices[0];
  if (first === undefined) return null;
  return screens[first].elements.some(
    (element) => isQuestionField(element) && isElementVisible(element),
  )
    ? null
    : first;
}

export function flowResumeIndex(params: {
  screens: FlowScreen[];
  visibleIndices: number[];
  pageIndex: number;
}): number | null {
  const { screens, visibleIndices, pageIndex } = params;
  return (
    visibleIndices.find((i) => screens[i].pageIndex >= pageIndex) ??
    visibleIndices[0] ??
    null
  );
}

/** The share of visible screens finished before `screenIndex`, so it fills only on completion. */
export function flowProgress(params: {
  visibleIndices: number[];
  screenIndex: number;
}): number {
  const { visibleIndices, screenIndex } = params;
  if (visibleIndices.length === 0) return 0;
  const finished = visibleIndices.filter((i) => i < screenIndex).length;
  return (finished / visibleIndices.length) * 100;
}

/** The screen's opening header, or `fallback` or a generic title when it has none showing. */
export function flowScreenTitle(params: {
  screen: FlowScreen;
  activeUserKey: string | undefined;
  isElementCurrentlyVisible: FormVisibility["isElementCurrentlyVisible"];
  variableValues: FormVisibility["variableValues"];
  fallback?: string;
}): string {
  const {
    screen,
    activeUserKey,
    isElementCurrentlyVisible,
    variableValues,
    fallback,
  } = params;
  const heading =
    screen.heading && resolveDisplayBlockForUser(screen.heading, activeUserKey);
  if (heading && isElementCurrentlyVisible(heading)) {
    return interpolateDisplayBlock(heading, variableValues).text;
  }
  if (fallback !== undefined) return fallback;
  return screen.elements.some(
    (element) => isQuestionField(element) && isElementCurrentlyVisible(element),
  )
    ? taskFlowFallbackTitle.questions
    : taskFlowFallbackTitle.reading;
}

const MAX_INPUTS_PER_STEP = 2;

/** How a form page shows in the task flow, assuming every page and element shows. */
export type FlowStepPreview = {
  label: string;
  warnings: string[];
};

/** Each page's step in the task flow, for authors; null for an empty page, which never shows. */
export function flowStepPreviews(
  schema: FormSchema,
): (FlowStepPreview | null)[] {
  let step = 0;
  return buildFlowScreens(schema).map((screen, index) => {
    if (screen.heading === null && screen.elements.length === 0) return null;
    const inputs = screen.elements.filter(isQuestionField).length;
    if (index === 0 && inputs === 0) {
      return {
        label: screen.heading
          ? `Background: ${screen.heading.text}`
          : taskFlow.background,
        warnings: [],
      };
    }
    step += 1;
    const fallback =
      inputs > 0
        ? taskFlowFallbackTitle.questions
        : taskFlowFallbackTitle.reading;
    const warnings = [
      ...(screen.heading === null
        ? [
            `No header block, so this step is titled "${fallback}". Open the page with a level-1 header in active voice.`,
          ]
        : []),
      ...(inputs > MAX_INPUTS_PER_STEP
        ? [
            `${inputs} inputs on one step. Keep each page to ${MAX_INPUTS_PER_STEP} or fewer.`,
          ]
        : []),
    ];
    return {
      label: `Step ${step}: ${screen.heading?.text ?? fallback}`,
      warnings,
    };
  });
}

export const missingHeaderWarning = (screen: FlowScreen, title: string) =>
  `Task flow: page ${screen.pageIndex + 1} has no header (first element: ${screen.elements[0]?.id}), so it shows "${title}". Open it with a level-1 header in active voice.`;

const IS_MEDIA: Record<DisplayKind, boolean> = {
  header: false,
  text: false,
  label: false,
  divider: false,
  spacer: false,
  html: false,
  images: true,
  video: true,
  quote: false,
  biglink: false,
  copytext: false,
  previousAnswer: false,
  userLocation: false,
  chatTranscript: false,
  accordion: false,
};

/** The background page shows the opening media above the opening text. */
export function splitBackground(background: PageItem[]): {
  media: PageItem[];
  reading: PageItem[];
} {
  const isMedia = (element: PageItem) =>
    !isQuestionField(element) && IS_MEDIA[element.kind];
  return {
    media: background.filter(isMedia),
    reading: background.filter((element) => !isMedia(element)),
  };
}
