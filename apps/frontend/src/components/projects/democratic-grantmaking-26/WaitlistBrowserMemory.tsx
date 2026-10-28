import { noop } from "@alliance/shared/lib/constants";
import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { SiteArrow } from "@alliance/sharedweb/ui/SiteArrow";
import { Link } from "react-router";
import { useInviteSession } from "../../../site/invite/InviteSession";
import type { useWaitlistBrowser } from "./useWaitlist";

const FORGET_FALLBACK = "We couldn’t forget this browser. Please try again.";

export function RememberedInvite({ signupHref }: { signupHref: string }) {
  return (
    <Link
      to={signupHref}
      className="flex items-center gap-2 font-medium underline underline-offset-2"
    >
      You have an invitation. Continue signing up
      <SiteArrow className="size-2.5" />
    </Link>
  );
}

/** Ends the session's waitlist confirmation and the tab's invitation. */
export function ForgetBrowser({
  forget,
  onForgotten,
}: {
  forget: ReturnType<typeof useWaitlistBrowser>["forget"];
  onForgotten: () => void;
}) {
  const invite = useInviteSession();

  return (
    <>
      <button
        type="button"
        onClick={() =>
          // mutate's own callbacks skip a caller that unmounted mid-request,
          // which would leave the tab's invitation behind. forget.error
          // renders a failure.
          void forget.mutateAsync().then(() => {
            invite.forget();
            onForgotten();
          }, noop)
        }
        disabled={forget.isPending}
        className="self-start text-sm text-[var(--site-ink)]/70 underline underline-offset-2"
      >
        {forget.isPending ? "Forgetting…" : "Forget this browser"}
      </button>
      {forget.isError && (
        <p className="text-sm text-red-700" role="alert">
          {thrownRefusalMessage({
            error: forget.error,
            fallback: FORGET_FALLBACK,
            sessionExpired: FORGET_FALLBACK,
          })}
        </p>
      )}
    </>
  );
}
