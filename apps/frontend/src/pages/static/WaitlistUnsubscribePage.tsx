import { WAITLIST_UNSUBSCRIBE_PARAM } from "@alliance/common/waitlist";
import { waitlistUnsubscribe } from "@alliance/shared/client";
import {
  thrownRefusalMessage,
  thrownStatus,
} from "@alliance/shared/lib/hey-api";
import { cn } from "@alliance/shared/styles/util";
import { useMutation } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { z } from "zod";
import { PageShell } from "../../site/PageShell";
import { SITE_COL, SiteButton } from "../../site/ui";

const UNSUBSCRIBE_FALLBACK = "We couldn’t unsubscribe you. Please try again.";
const INVALID_LINK = "This unsubscribe link is not valid.";

// Unsubscribing waits for a click, so a mail scanner that opens the link
// unsubscribes no one.
export default function WaitlistUnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = z
    .uuid()
    .safeParse(searchParams.get(WAITLIST_UNSUBSCRIBE_PARAM)).data;
  const unsubscribe = useMutation({
    mutationFn: (unsubscribeToken: string) =>
      waitlistUnsubscribe({
        body: { token: unsubscribeToken },
        throwOnError: true,
      }),
  });

  let body: React.ReactNode;
  if (!token || thrownStatus(unsubscribe.error) === 404) {
    body = <p>{INVALID_LINK}</p>;
  } else if (unsubscribe.isSuccess) {
    body = (
      <p>
        You’re unsubscribed. We won’t send you any more waitlist emails,
        including an invitation to join when your turn comes.
      </p>
    );
  } else {
    body = (
      <>
        <p>
          Stop receiving emails about the Alliance waitlist? That includes your
          invitation to join when your turn comes.
        </p>
        <SiteButton
          tone="primary"
          onClick={() => {
            if (!unsubscribe.isPending) unsubscribe.mutate(token);
          }}
        >
          {unsubscribe.isPending ? "Unsubscribing…" : "Unsubscribe"}
        </SiteButton>
        {unsubscribe.isError && (
          <p className="text-red-600" role="alert">
            {thrownRefusalMessage({
              error: unsubscribe.error,
              fallback: UNSUBSCRIBE_FALLBACK,
              sessionExpired: UNSUBSCRIBE_FALLBACK,
            })}
          </p>
        )}
      </>
    );
  }

  return (
    <PageShell title="Waitlist emails" showJoinCta={false}>
      <div
        className={cn(
          SITE_COL,
          "flex flex-col items-start gap-6 pb-20 text-lg text-[var(--site-ink)]/80",
        )}
      >
        {body}
      </div>
    </PageShell>
  );
}
