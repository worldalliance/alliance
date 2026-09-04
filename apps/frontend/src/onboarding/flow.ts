export enum OnboardingStep {
  Account = "account",
  Community = "community",
  Commitment = "commitment",
  Scale = "scale",
  Minutes = "minutes",
  Agreement = "agreement",
  Welcome = "welcome",
  MobileApp = "mobile-app",
}

export enum PanelTone {
  Navy = "navy",
  Photo = "photo",
  Green = "green",
}

export const STEP_ORDER: OnboardingStep[] = [
  OnboardingStep.Account,
  OnboardingStep.Community,
  OnboardingStep.Commitment,
  OnboardingStep.Scale,
  OnboardingStep.Minutes,
  OnboardingStep.Agreement,
  OnboardingStep.Welcome,
  OnboardingStep.MobileApp,
];

export const PROGRESS_SEGMENTS = 5;

/** The agreement, the welcome and the app screen tie: one step, three screens. */
export const FILLED_SEGMENTS: Record<OnboardingStep, number> = {
  [OnboardingStep.Account]: 0,
  [OnboardingStep.Community]: 1,
  [OnboardingStep.Commitment]: 2,
  [OnboardingStep.Scale]: 3,
  [OnboardingStep.Minutes]: 4,
  [OnboardingStep.Agreement]: 5,
  [OnboardingStep.Welcome]: 5,
  [OnboardingStep.MobileApp]: 5,
};

export const STEP_TONE: Record<OnboardingStep, PanelTone> = {
  [OnboardingStep.Account]: PanelTone.Navy,
  [OnboardingStep.Community]: PanelTone.Navy,
  [OnboardingStep.Commitment]: PanelTone.Navy,
  [OnboardingStep.Scale]: PanelTone.Navy,
  [OnboardingStep.Minutes]: PanelTone.Navy,
  [OnboardingStep.Agreement]: PanelTone.Navy,
  [OnboardingStep.Welcome]: PanelTone.Photo,
  [OnboardingStep.MobileApp]: PanelTone.Green,
};

export const STEP_EYEBROW: Record<OnboardingStep, string | null> = {
  [OnboardingStep.Account]: null,
  [OnboardingStep.Community]: "What is the Alliance?",
  [OnboardingStep.Commitment]: "What is the Alliance?",
  [OnboardingStep.Scale]: "What is the Alliance?",
  [OnboardingStep.Minutes]: "What is the Alliance?",
  [OnboardingStep.Agreement]: "Membership Agreement",
  [OnboardingStep.Welcome]: null,
  [OnboardingStep.MobileApp]: "The Alliance",
};

export function isOnboardingStep(
  value: string | null,
): value is OnboardingStep {
  return STEP_ORDER.some((step) => step === value);
}

export function stepAfter(step: OnboardingStep): OnboardingStep | null {
  return STEP_ORDER[STEP_ORDER.indexOf(step) + 1] ?? null;
}

export function stepBefore(step: OnboardingStep): OnboardingStep | null {
  const index = STEP_ORDER.indexOf(step);
  return index > 0 ? STEP_ORDER[index - 1] : null;
}
