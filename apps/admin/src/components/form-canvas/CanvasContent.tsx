import type { DisplayKind } from "@alliance/common/forms/display-blocks";
import { cn } from "@alliance/shared/styles/util";
import { staticFieldContext } from "@alliance/shared/useFormRenderer";
import RenderField from "@alliance/sharedweb/forms/RenderField";
import type { ComponentProps, FormEvent, MouseEvent, ReactNode } from "react";
import { FORM_BUILDER_PREVIEW_USER } from "../../lib/testData";

/**
 * Blocks whose controls stay usable on the canvas, to inspect layout: a
 * video's player, an image's lightbox. Everything else renders inert, so a
 * click anywhere on it only selects it. An accordion lays out its own
 * sections on the canvas.
 */
export const INTERACTIVE_ON_CANVAS: Record<
  Exclude<DisplayKind, "accordion">,
  boolean
> = {
  header: false,
  text: false,
  quote: false,
  label: false,
  divider: false,
  spacer: false,
  html: false,
  images: true,
  video: true,
  biglink: false,
  copytext: false,
  previousAnswer: false,
  userLocation: false,
  chatTranscript: false,
};

export const selectionRing = (selected: boolean) =>
  selected ? "ring-2 ring-blue-500" : "hover:ring-1 hover:ring-blue-200";

/** A button covering an item, so a click anywhere on it selects it. */
export const SELECT_OVERLAY =
  "absolute inset-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

/** Links inside an interactive block lead respondents away; authoring stays. */
const blockLinks = (event: MouseEvent) => {
  if (event.target instanceof Element && event.target.closest("a[href]")) {
    event.preventDefault();
  }
};

const blockSubmit = (event: FormEvent) => event.preventDefault();

export const ignoreAnswer = () => {};

/** A question as the canvas previews it, answering nothing. */
export function CanvasQuestion({
  field,
}: {
  field: ComponentProps<typeof RenderField>["field"];
}) {
  return (
    <RenderField
      field={field}
      onChange={ignoreAnswer}
      disableOptionRandomization
      user={FORM_BUILDER_PREVIEW_USER}
      fieldContext={staticFieldContext}
    />
  );
}

export function CanvasContent({
  interactive,
  children,
}: {
  interactive: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("relative", !interactive && "pointer-events-none")}
      inert={!interactive}
      onClickCapture={blockLinks}
      onSubmitCapture={blockSubmit}
    >
      {children}
    </div>
  );
}
