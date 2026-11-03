export type SlideAspectRatios = Record<number, number>;

// react-native-web re-runs its image load whenever the onLoad prop changes
// identity, so a render caused by onLoad loads the image again; keeping the
// same object for an unchanged ratio stops React re-rendering.
export function withSlideAspectRatio(
  current: SlideAspectRatios,
  measured: { slide: number; ratio: number },
): SlideAspectRatios {
  return current[measured.slide] === measured.ratio
    ? current
    : { ...current, [measured.slide]: measured.ratio };
}
