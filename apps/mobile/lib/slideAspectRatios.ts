export type SlideAspectRatios = Record<number, number>;

// react-native-web under WebKit fires `onLoad` again whenever an image is
// restyled, so a fresh object for an unchanged ratio re-renders in a loop.
/** `current` itself when the slide already has this ratio, so React skips the update. */
export function withSlideAspectRatio(
  current: SlideAspectRatios,
  measured: { slide: number; ratio: number },
): SlideAspectRatios {
  return current[measured.slide] === measured.ratio
    ? current
    : { ...current, [measured.slide]: measured.ratio };
}
