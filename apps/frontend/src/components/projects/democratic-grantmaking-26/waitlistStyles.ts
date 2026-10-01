import { cn } from "@alliance/shared/styles/util";
import { ACCOUNT_FIELD } from "../../../onboarding/chrome";

// `!` because index.css gives every input an unlayered white background.
export const WAITLIST_FIELD = cn(
  ACCOUNT_FIELD,
  "lg:border-white/45 lg:bg-white/10! lg:text-white lg:placeholder:text-white/80 lg:focus:border-white",
);
