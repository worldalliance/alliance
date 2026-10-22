import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useState } from "react";
import { ACCOUNT_BUTTON } from "../../../onboarding/chrome";
import { SIGNUP_INFO } from "./copy";

export function SignupInfo({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div
        role="status"
        className={cn(
          "rounded-lg bg-blue-50 px-6 py-5 text-base text-blue-950 sm:text-lg",
          className,
        )}
      >
        <ul className="list-disc space-y-2 pl-5">
          {SIGNUP_INFO.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <Button
      type="button"
      color={ButtonColor.Black}
      onClick={() => setOpen(true)}
      className={cn(ACCOUNT_BUTTON, "p-4 text-base sm:text-lg", className)}
    >
      Sign up to join
    </Button>
  );
}
