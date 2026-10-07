import type { DisplayKind } from "@alliance/common/forms/display-blocks";
import { cn } from "@alliance/shared/styles/util";
import type { FormEvent, MouseEvent, ReactNode } from "react";

/**
 * Blocks whose controls stay usable on the canvas, to inspect layout: an
 * accordion's sections, a video's player, an image's lightbox. Everything
 * else renders inert, so a click anywhere on it only selects it.
 */
export const INTERACTIVE_ON_CANVAS: Record<DisplayKind, boolean> = {
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
  accordion: true,
};

/** Links inside an interactive block lead respondents away; authoring stays. */
const blockLinks = (event: MouseEvent) => {
  if (event.target instanceof Element && event.target.closest("a[href]")) {
    event.preventDefault();
  }
};

const blockSubmit = (event: FormEvent) => event.preventDefault();

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
