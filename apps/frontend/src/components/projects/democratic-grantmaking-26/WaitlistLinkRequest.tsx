import { waitlistRequestLink } from "@alliance/shared/client";
import { thrownRefusalMessage } from "@alliance/shared/lib/hey-api";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { ACCOUNT_BUTTON } from "../../../onboarding/chrome";

const REQUEST_FALLBACK = "We couldn’t send your link. Please try again.";

export function WaitlistLinkRequest({ email }: { email: string }) {
  const request = useMutation({
    mutationFn: () =>
      waitlistRequestLink({ body: { email }, throwOnError: true }),
  });

  if (request.isSuccess) {
    return (
      <p className="text-zinc-600 lg:text-white/85">
        Check {email} for your personal link. We send it at most once a day.
      </p>
    );
  }

  return (
    <>
      <Button
        type="button"
        color={ButtonColor.Green}
        disabled={request.isPending}
        onClick={() => request.mutate()}
        className={ACCOUNT_BUTTON}
      >
        <Mail className="size-4" aria-hidden />
        {request.isPending ? "Sending…" : "Email me my link"}
      </Button>
      {request.isError && (
        <p className="text-sm text-red-600 lg:text-red-200" role="alert">
          {thrownRefusalMessage({
            error: request.error,
            fallback: REQUEST_FALLBACK,
            sessionExpired: REQUEST_FALLBACK,
          })}
        </p>
      )}
    </>
  );
}
