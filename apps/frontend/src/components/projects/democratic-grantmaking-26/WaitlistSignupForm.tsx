import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { ACCOUNT_BUTTON, ACCOUNT_FIELD } from "../../../onboarding/chrome";
import { SiteArrow } from "../../../site/ui";
import { PersonAvatar } from "./PersonRow";
import { INVITER } from "./placeholders";

// `!` because index.css gives every input an unlayered white background.
const FIELD = cn(
  ACCOUNT_FIELD,
  "lg:border-white/45 lg:bg-white/10! lg:text-white lg:placeholder:text-white/80 lg:focus:border-white",
);

/** A white card on narrow screens; from `lg` it sits straight on the primary band. */
export function WaitlistSignupForm({ className }: { className?: string }) {
  return (
    <form
      className={cn(
        "flex flex-col gap-3 bg-white p-5 text-[var(--site-ink)] sm:p-6 lg:bg-transparent lg:p-0 lg:text-white",
        className,
      )}
      style={{ borderRadius: "var(--site-radius-card)" }}
      onSubmit={(e) => {
        // TODO: submit to the waitlist once the waiting room backend exists.
        e.preventDefault();
      }}
    >
      <p className="mb-3 flex items-center justify-center gap-x-2 text-base text-zinc-500 lg:text-white/85">
        <PersonAvatar
          pictureKey={INVITER.pictureKey}
          className="size-6 rounded-[5px]"
        />
        <span>
          <span className="font-medium text-black lg:text-white">
            {INVITER.name}
          </span>{" "}
          invited you to the Alliance
        </span>
      </p>
      <input
        name="name"
        type="text"
        autoComplete="name"
        placeholder="Full Name"
        aria-label="Full Name"
        required
        className={FIELD}
      />
      <input
        name="email"
        type="email"
        autoComplete="email"
        placeholder="Email"
        aria-label="Email"
        required
        className={FIELD}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          name="commit"
          type="checkbox"
          required
          className="accent-green size-4 shrink-0"
        />
        I commit to join the Alliance.
      </label>
      <Button
        type="submit"
        color={ButtonColor.Green}
        className={ACCOUNT_BUTTON}
      >
        Join the Waitlist
        <SiteArrow className="size-2.5" />
      </Button>
      <p className="text-center text-sm text-zinc-600 lg:text-white/85">
        By signing up you agree to get updates.
      </p>
    </form>
  );
}
