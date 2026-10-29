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
import { taskFlowFallbackTitle } from "../lib/copy";
import { type FormVisibility } from "../useFormRenderer";

const MAX_INPUTS_PER_SCREEN = 2;

const isHeader = (element: PageItem) =>
  !isQuestionField(element) && element.kind === "header";

export type FlowScreen = {
  pageIndex: number;
  /** The header the screen opens with, or continues from when the input cap split it. */
  heading: HeaderBlock | null;
  elements: PageItem[];
};

/**
 * Splits each page into screens of the full-screen task flow: a new screen at
 * every page and every header block, and at most two inputs per screen.
 * Blocks after a screen's last allowed input move on with the next input,
 * since they introduce it. Headers stacked directly under a screen's opening
 * header stay on that screen, and headers that end a page join the page's
 * last screen, so no header is lost.
 */
export function buildFlowScreens(schema: FormSchema): FlowScreen[] {
  const screens: FlowScreen[] = [];

  schema.pages.forEach((page, pageIndex) => {
    let heading: HeaderBlock | null = null;
    let current: PageItem[] = [];
    let inputs = 0;
    let carried: PageItem[] = [];

    const flush = () => {
      if (current.length > 0) {
        screens.push({ pageIndex, heading, elements: current });
      }
      current = [];
      inputs = 0;
    };

    for (const element of page.fields) {
      if (isQuestionField(element)) {
        if (inputs === MAX_INPUTS_PER_SCREEN) {
          flush();
          current = carried;
          carried = [];
        }
        current.push(element);
        inputs += 1;
      } else if (element.kind === "header") {
        if (heading !== null && current.every(isHeader)) {
          current.push(element);
          continue;
        }
        current.push(...carried);
        carried = [];
        flush();
        heading = element;
      } else if (inputs === MAX_INPUTS_PER_SCREEN) {
        carried.push(element);
      } else {
        current.push(element);
      }
    }
    current.push(...carried);
    if (heading !== null && current.every(isHeader)) {
      const last = screens.at(-1);
      if (last?.pageIndex === pageIndex) {
        last.elements.push(heading, ...current);
        current = [];
      } else if (current.length === 0) {
        screens.push({ pageIndex, heading, elements: [] });
      }
    }
    flush();
  });

  return screens;
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
      : screen.elements.some(isElementVisible))
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

export function flowProgress(params: {
  visibleIndices: number[];
  screenIndex: number;
}): number {
  const { visibleIndices, screenIndex } = params;
  if (visibleIndices.length === 0) return 0;
  const reached = visibleIndices.filter((i) => i <= screenIndex).length;
  return (reached / visibleIndices.length) * 100;
}

/** The screen's opening header, or a generic title when it has none showing. */
export function flowScreenTitle(params: {
  screen: FlowScreen;
  activeUserKey: string | undefined;
  isElementCurrentlyVisible: FormVisibility["isElementCurrentlyVisible"];
  variableValues: FormVisibility["variableValues"];
}): string {
  const { screen, activeUserKey, isElementCurrentlyVisible, variableValues } =
    params;
  const heading =
    screen.heading && resolveDisplayBlockForUser(screen.heading, activeUserKey);
  if (heading && isElementCurrentlyVisible(heading)) {
    return interpolateDisplayBlock(heading, variableValues).text;
  }
  return screen.elements.some(
    (element) => isQuestionField(element) && isElementCurrentlyVisible(element),
  )
    ? taskFlowFallbackTitle.questions
    : taskFlowFallbackTitle.reading;
}

export const missingHeaderWarning = (screen: FlowScreen, title: string) =>
  `Task flow: a screen on page ${screen.pageIndex + 1} has no header (first element: ${screen.elements[0]?.id}), so it shows "${title}". Open it with a level-1 header in active voice.`;

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
