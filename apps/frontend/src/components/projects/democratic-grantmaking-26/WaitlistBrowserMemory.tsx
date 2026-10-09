import {
  waitlistForgetBrowser,
  type WaitlistBrowserDto,
} from "@alliance/shared/client";
import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { useInviteSession } from "../../../site/invite/InviteSession";
import { SiteArrow } from "../../../site/ui";

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
export function ForgetBrowser({ onForgotten }: { onForgotten: () => void }) {
  const queryClient = useQueryClient();
  const invite = useInviteSession();
  const forget = useMutation({
    mutationFn: () => waitlistForgetBrowser({ throwOnError: true }),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.waitlistBrowser(), {
        entry: null,
      } satisfies WaitlistBrowserDto);
      invite.forget();
      onForgotten();
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={() => forget.mutate()}
        disabled={forget.isPending}
        className="self-start text-sm text-white/85 underline underline-offset-2"
      >
        {forget.isPending ? "Forgetting…" : "Forget this browser"}
      </button>
      {forget.isError && (
        <p className="text-sm text-red-200" role="alert">
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
