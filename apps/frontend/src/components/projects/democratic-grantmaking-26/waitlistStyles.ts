import { cn } from "@alliance/shared/styles/util";
import { ACCOUNT_FIELD } from "../../../onboarding/chrome";

// `!` because index.css gives every input an unlayered white background.
export const WAITLIST_FIELD = cn(
  ACCOUNT_FIELD,
  "border-white/45 bg-white/10! text-white placeholder:text-white/80 focus:border-white",
);
