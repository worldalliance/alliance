import { useEffect, useState } from "react";
import { z } from "zod";
import { OnboardingStep } from "./flow";

const KEY = "alliance:onboarding-draft";

/**
 * How long an abandoned draft is worth keeping. It holds a password in the
 * clear, so it expires on its own rather than sitting on disk until the member
 * happens to come back and finish.
 */
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const draftSchema = z.object({
  email: z.string(),
  password: z.string(),
  step: z.enum(OnboardingStep),
  /** Only restored onto the same invite, so a second link starts its own run. */
  referralCode: z.string().nullable(),
  savedAt: z.number(),
});

export type OnboardingDraft = z.infer<typeof draftSchema>;

/**
 * The account does not exist until Join, so a reload would otherwise drop the
 * credentials the later screens still need and send the member back to screen
 * one. Held in `localStorage` and deleted the moment the account is created.
 */
function readDraft(referralCode: string | null): OnboardingDraft | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  const parsed = z
    .string()
    .transform((value, ctx) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "not json" });
        return z.NEVER;
      }
    })
    .pipe(draftSchema)
    .safeParse(raw);

  if (!parsed.success) return null;
  if (Date.now() - parsed.data.savedAt > DRAFT_TTL_MS) {
    clearDraft();
    return null;
  }
  return parsed.data.referralCode === referralCode ? parsed.data : null;
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // A browser that refuses storage just loses the resume.
  }
}

/** Writes the draft whenever it changes, and stops once the account exists. */
export function useDraftWriter(
  draft: Omit<OnboardingDraft, "savedAt">,
  active: boolean,
) {
  const { email, password, step, referralCode } = draft;
  useEffect(() => {
    if (!active) return;
    if (!email && !password && step === OnboardingStep.Account) return;
    try {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({
          email,
          password,
          step,
          referralCode,
          savedAt: Date.now(),
        }),
      );
    } catch {
      // A browser that refuses storage just loses the resume.
    }
  }, [active, email, password, step, referralCode]);
}

/** Read once on mount, so the first render can seed state from the draft. */
export function useInitialDraft(referralCode: string | null) {
  const [draft] = useState(() => readDraft(referralCode));
  return draft;
}
