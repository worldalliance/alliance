import { joinRequestsCreate } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import { Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import { CONTACT_EMAIL } from "./content";
import { SITE_INPUT, SITE_INPUT_STYLE, SITE_SUBMIT, SiteField } from "./ui";

export const JOIN_NAME_LABEL = "Your name";
export const JOIN_EMAIL_LABEL = "Email";
export const JOIN_REASON_LABEL = "Why do you want to join the Alliance?";
const JOIN_REASON_PLACEHOLDER =
  "A sentence or two is plenty. What drew you here, and what would you want to work on?";
const JOIN_SUBMIT = "Request an invite";
const JOIN_SUBMITTED_TITLE = "Request received";
const JOIN_SUBMITTED_BODY =
  "Thanks. We read every request, and will send you an email.";

/**
 * Sends a join request to the office. Nothing about the sender is known, so
 * the three answers go straight to Slack rather than into a queue anyone has
 * to remember to check.
 */
export function JoinRequestForm({ className }: { className?: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setSubmitting(true);
    try {
      await joinRequestsCreate({
        body: {
          name: String(formData.get("joinName") ?? "").trim(),
          email: String(formData.get("joinEmail") ?? "").trim(),
          reason: String(formData.get("joinReason") ?? "").trim(),
        },
        throwOnError: true,
      });
      setSubmitted(true);
    } catch (caught) {
      console.error("Failed to submit join request", caught);
      setError(
        `Something went wrong sending this. Please try again, or email ${CONTACT_EMAIL}.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={cn("flex flex-col items-start gap-3 py-4", className)}>
        <span className="flex size-9 items-center justify-center rounded-full bg-[var(--site-primary)] text-white">
          <Check className="size-5" aria-hidden />
        </span>
        <p className="text-[1.35rem] leading-tight text-[var(--site-primary)]">
          {JOIN_SUBMITTED_TITLE}
        </p>
        <p className="text-[1.02rem] leading-snug text-[var(--site-ink)]/75">
          {JOIN_SUBMITTED_BODY}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className={cn("flex flex-col gap-4", className)}
    >
      <SiteField label={JOIN_NAME_LABEL} name="joinName" required>
        <input
          id="joinName"
          name="joinName"
          type="text"
          required
          maxLength={200}
          autoComplete="name"
          className={SITE_INPUT}
          style={SITE_INPUT_STYLE}
        />
      </SiteField>
      <SiteField label={JOIN_EMAIL_LABEL} name="joinEmail" required>
        <input
          id="joinEmail"
          name="joinEmail"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          className={SITE_INPUT}
          style={SITE_INPUT_STYLE}
        />
      </SiteField>
      <SiteField label={JOIN_REASON_LABEL} name="joinReason" required>
        <textarea
          id="joinReason"
          name="joinReason"
          required
          rows={4}
          maxLength={4000}
          placeholder={JOIN_REASON_PLACEHOLDER}
          className={cn(SITE_INPUT, "resize-y")}
          style={SITE_INPUT_STYLE}
        />
      </SiteField>
      <button
        type="submit"
        disabled={submitting}
        className={cn(
          SITE_SUBMIT,
          "mt-1 bg-[var(--site-primary)] text-white hover:bg-[var(--site-primary-hover)]",
        )}
        style={{ borderRadius: "var(--site-radius-button)" }}
      >
        {submitting ? "Sending…" : JOIN_SUBMIT}
      </button>
      {error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
