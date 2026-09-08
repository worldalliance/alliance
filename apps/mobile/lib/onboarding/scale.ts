import { useWindowDimensions } from "react-native";

const REM = 16;

function clamp(min: number, preferred: number, max: number) {
  return Math.min(Math.max(preferred, min), max);
}

/**
 * The web flow's type scale, which is six sizes and nothing outside them, each
 * traced from the 1728x1117 Figma frame. There the sizes come from `clamp()`
 * over `vh` and `vw`; here the same arithmetic runs against the window, so a
 * short phone and a tall one agree with the browser at the same size.
 */
export function useOnboardingScale() {
  const { width, height } = useWindowDimensions();
  const vh = height / 100;
  const vw = width / 100;

  return {
    eyebrow: clamp(0.8 * REM, Math.min(1.8 * vh, 3.6 * vw), 1.4 * REM),
    h1: clamp(1.15 * REM, Math.min(3.55 * vh, 5.6 * vw), 2.75 * REM),
    h2: clamp(0.95 * REM, Math.min(2.5 * vh, 4.4 * vw), 2 * REM),
    body: clamp(0.8 * REM, Math.min(2.2 * vh, 3.9 * vw), 1.75 * REM),
    ui: clamp(0.78 * REM, Math.min(1.62 * vh, 3.2 * vw), 1.25 * REM),
    caption: clamp(0.68 * REM, Math.min(1.36 * vh, 2.7 * vw), 1.05 * REM),

    gap: clamp(1 * REM, 6.4 * vh, 5 * REM),
    bandGap: clamp(1.5 * REM, 3.4 * vh, 3 * REM),
    padTop: clamp(0.85 * REM, 3 * vh, 2.6 * REM),
    padBottom: clamp(2.5 * REM, 6.7 * vh, 5.5 * REM),
    progressBottom: clamp(1 * REM, 3.1 * vh, 2.6 * REM),

    /** The gate's title is the flow's one hero line, above the shared scale. */
    gateTitle: clamp(1.75 * REM, Math.min(4.6 * vh, 8.2 * vw), 3.25 * REM),
    gateTop: clamp(1.5 * REM, 6.5 * vh, 4.5 * REM),
    /** Fixed rather than viewport-derived: both were picked at this size. */
    gateSubline: 18,
    button: 16,

    /** Between a screen's graphic and the note under it. */
    bodyGap: clamp(0.5 * REM, 3 * vh, 2.4 * REM),
    deckGap: clamp(0.5 * REM, 2.4 * vh, 1.6 * REM),
    /** A caption that belongs to the thing right above it. */
    noteGap: clamp(0.25 * REM, 0.7 * vh, 0.6 * REM),
    trackGap: clamp(0.6 * REM, 2.6 * vh, 2 * REM),
    cardGap: clamp(0.55 * REM, 1.7 * vh, 1.15 * REM),
    cardPad: clamp(0.75 * REM, 1.9 * vh, 1.35 * REM),
    cardRowGap: clamp(0.4 * REM, 1.15 * vh, 0.85 * REM),
    signField: clamp(2.1 * REM, 4.4 * vh, 2.75 * REM),
    face: clamp(1.75 * REM, 3.6 * vh, 2.5 * REM),
    bar: clamp(0.85 * REM, 2.7 * vh, 2.1 * REM),
  };
}

export type OnboardingScale = ReturnType<typeof useOnboardingScale>;

/**
 * A touch screen answers a tap immediately, so the web's half-second stagger
 * reads as lag here. Same order, roughly half the clock.
 */
export const motion = {
  riseMs: 320,
  riseDelayMs: 40,
  riseStepMs: 45,
  stepFadeMs: 200,
  spotlightMs: 260,

  /**
   * The opening screen introduces the flow rather than continuing it, so its
   * three bands arrive in turn at a pace you can read, not together.
   */
  narrativeStepMs: 520,
} as const;

export const onboardingColors = {
  navy: "#081e40",
  /** The panel green, darker than the accent so white type holds on it. */
  panelGreen: "#24491d",
  photoWash: "#2d5a22",
  accentGreen: "#62a124",
} as const;
