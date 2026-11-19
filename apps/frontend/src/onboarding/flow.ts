export enum OnboardingStep {
  Account = "account",
  Community = "community",
  Commitment = "commitment",
  Scale = "scale",
  Minutes = "minutes",
  Agreement = "agreement",
  Phone = "phone",
  MobileApp = "mobile-app",
}

export enum PanelTone {
  Navy = "navy",
  Green = "green",
}

export const STEP_ORDER: OnboardingStep[] = [
  OnboardingStep.Account,
  OnboardingStep.Community,
  OnboardingStep.Commitment,
  OnboardingStep.Scale,
  OnboardingStep.Minutes,
  OnboardingStep.Agreement,
  OnboardingStep.Phone,
  // App-download screen is out of the flow.
  // OnboardingStep.MobileApp,
];

export const PROGRESS_SEGMENTS = 6;

/** The phone and app screens tie: one step, two screens. */
export const FILLED_SEGMENTS: Record<OnboardingStep, number> = {
  [OnboardingStep.Account]: 0,
  [OnboardingStep.Community]: 1,
  [OnboardingStep.Commitment]: 2,
  [OnboardingStep.Scale]: 3,
  [OnboardingStep.Minutes]: 4,
  [OnboardingStep.Agreement]: 5,
  [OnboardingStep.Phone]: 6,
  [OnboardingStep.MobileApp]: 6,
};

export const STEP_TONE: Record<OnboardingStep, PanelTone> = {
  [OnboardingStep.Account]: PanelTone.Navy,
  [OnboardingStep.Community]: PanelTone.Navy,
  [OnboardingStep.Commitment]: PanelTone.Navy,
  [OnboardingStep.Scale]: PanelTone.Navy,
  [OnboardingStep.Minutes]: PanelTone.Navy,
  [OnboardingStep.Agreement]: PanelTone.Navy,
  [OnboardingStep.Phone]: PanelTone.Navy,
  [OnboardingStep.MobileApp]: PanelTone.Green,
};

export const STEP_EYEBROW: Record<OnboardingStep, string | null> = {
  [OnboardingStep.Account]: null,
  [OnboardingStep.Community]: "What is the Alliance?",
  [OnboardingStep.Commitment]: "What is the Alliance?",
  [OnboardingStep.Scale]: "What is the Alliance?",
  [OnboardingStep.Minutes]: "What is the Alliance?",
  [OnboardingStep.Agreement]: "Membership Agreement",
  [OnboardingStep.Phone]: "Notifications",
  [OnboardingStep.MobileApp]: "The Alliance",
};

export function isOnboardingStep(
  value: string | null,
): value is OnboardingStep {
  return STEP_ORDER.some((step) => step === value);
}

/**
 * The download prompt is the last screen, and only where an app store link is
 * any use. Everywhere else the flow ends at the phone step and hands straight
 * over to the walkthrough.
 */
export const MOBILE_WEB_QUERY = "(max-width: 767px)";

export function stepAfter(step: OnboardingStep): OnboardingStep | null {
  return STEP_ORDER[STEP_ORDER.indexOf(step) + 1] ?? null;
}

export function stepBefore(step: OnboardingStep): OnboardingStep | null {
  const index = STEP_ORDER.indexOf(step);
  return index > 0 ? STEP_ORDER[index - 1] : null;
}
