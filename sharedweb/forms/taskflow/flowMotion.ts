import { flowMotion, type Motion } from "@alliance/shared/forms/flowStyle";
import { prefersReducedMotion } from "@alliance/sharedweb/lib/reducedMotion";

export { flowMotion };

export const SUCCESS_HOLD_MS = 2000;

/** The completion screen's green comes in over `success` and leaves over `recolor`; pass whether the element is green now. */
export const greenMotion = (green: boolean): Motion =>
  green ? flowMotion.success : flowMotion.recolor;

export const transition = (
  motion: Motion,
  property: string,
  ...rest: string[]
): string =>
  [property, ...rest]
    .map(
      (property) =>
        `${property} ${motion.durationMs}ms cubic-bezier(${motion.easing.join(", ")})`,
    )
    .join(", ");

/** Add beside any inline `transition()` style; it's `!important` to outrank the inline style. */
export const REDUCED_MOTION = "motion-reduce:transition-none!";

const nextFrame = () =>
  new Promise((resolve) => window.requestAnimationFrame(resolve));

/**
 * Resolves once every motion has played, counted from the frame after the
 * change that starts them commits; at once under reduced motion.
 */
export const afterMotion = async (
  motion: Motion,
  ...rest: Motion[]
): Promise<void> => {
  if (prefersReducedMotion()) return;
  await nextFrame();
  await nextFrame();
  await new Promise((resolve) =>
    window.setTimeout(
      resolve,
      Math.max(motion.durationMs, ...rest.map((other) => other.durationMs)),
    ),
  );
};
