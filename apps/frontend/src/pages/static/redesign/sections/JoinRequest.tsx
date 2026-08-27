import { cn } from "@alliance/shared/styles/util";
import { Check, X } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { rdHref, RedesignPage, type LinkTarget } from "../links";
import {
  JOIN_EMAIL_LABEL,
  JOIN_LEDE,
  JOIN_MODAL_LABEL,
  JOIN_NAME_LABEL,
  JOIN_REASON_LABEL,
  JOIN_REASON_PLACEHOLDER,
  JOIN_SUBMIT,
  JOIN_SUBMITTED_BODY,
  JOIN_SUBMITTED_TITLE,
  JOIN_TITLE,
} from "../pageContent";
import {
  JoinFlow,
  joinFlow,
  themeVars,
  type RedesignTheme,
  type RedesignVersion,
} from "../theme";
import { RD_INPUT, RdField } from "../ui";

/** Set only where the version puts the form in a modal, so version 4 alone. */
const OpenJoinModalContext = createContext<(() => void) | null>(null);

const flowUsesModal: Record<JoinFlow, boolean> = {
  [JoinFlow.Modal]: true,
  [JoinFlow.Page]: false,
};

/**
 * Wraps every page of a mockup, so a join button anywhere on the site can open
 * the form. Versions that give the form its own page install no opener, and
 * their buttons fall back to linking at it.
 */
export function JoinRequestProvider({
  theme,
  children,
}: {
  theme: RedesignTheme;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const usesModal = flowUsesModal[joinFlow[theme.version]];

  return (
    <OpenJoinModalContext.Provider
      value={usesModal ? () => setOpen(true) : null}
    >
      {children}
      {open && (
        <JoinRequestModal theme={theme} onClose={() => setOpen(false)} />
      )}
    </OpenJoinModalContext.Provider>
  );
}

/** What a "Join us" or "Request an invite" control should do on this version. */
export function useJoinTarget(version: RedesignVersion): LinkTarget {
  const openModal = useContext(OpenJoinModalContext);
  return openModal
    ? { onClick: openModal }
    : { href: rdHref(version, RedesignPage.Join) };
}

export function RequestToJoinForm({ className }: { className?: string }) {
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className={cn("flex flex-col items-start gap-3 py-4", className)}>
        <span
          className="flex size-9 items-center justify-center bg-[var(--rd-primary)] text-white"
          style={{ borderRadius: "9999px" }}
        >
          <Check className="size-5" aria-hidden />
        </span>
        <p className="text-[1.35rem] leading-tight text-[var(--rd-primary)]">
          {JOIN_SUBMITTED_TITLE}
        </p>
        <p className="text-[1.02rem] leading-snug text-[var(--rd-ink)]/75">
          {JOIN_SUBMITTED_BODY}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={cn("flex flex-col gap-4", className)}>
      <RdField label={JOIN_NAME_LABEL} name="joinName" required>
        <input
          id="joinName"
          name="joinName"
          type="text"
          required
          autoComplete="name"
          className={RD_INPUT}
          style={{ borderRadius: "var(--rd-radius-input)" }}
        />
      </RdField>
      <RdField label={JOIN_EMAIL_LABEL} name="joinEmail" required>
        <input
          id="joinEmail"
          name="joinEmail"
          type="email"
          required
          autoComplete="email"
          className={RD_INPUT}
          style={{ borderRadius: "var(--rd-radius-input)" }}
        />
      </RdField>
      <RdField label={JOIN_REASON_LABEL} name="joinReason" required>
        <textarea
          id="joinReason"
          name="joinReason"
          required
          rows={4}
          placeholder={JOIN_REASON_PLACEHOLDER}
          className={cn(RD_INPUT, "resize-y")}
          style={{ borderRadius: "var(--rd-radius-input)" }}
        />
      </RdField>
      <button
        type="submit"
        className="mt-1 inline-flex min-h-12 w-fit items-center gap-2 bg-[var(--rd-primary)] px-5 text-base font-medium text-white transition-colors hover:bg-[var(--rd-primary-hover)]"
        style={{ borderRadius: "var(--rd-radius-button)" }}
      >
        {JOIN_SUBMIT}
      </button>
    </form>
  );
}

function JoinRequestModal({
  theme,
  onClose,
}: {
  theme: RedesignTheme;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    // The provider sits outside the page's `rd-root`, so the vars come along.
    <div
      className="rd-root fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6"
      style={themeVars(theme)}
    >
      <button
        type="button"
        className="fixed inset-0 cursor-default bg-black/55 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-label={JOIN_MODAL_LABEL}
        className="relative my-auto w-full max-w-[34rem] bg-[var(--rd-surface)] p-7 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] sm:p-9"
        style={{ borderRadius: "var(--rd-radius-card)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 inline-flex size-10 items-center justify-center text-[var(--rd-ink)]/50 transition-colors hover:text-[var(--rd-ink)]"
        >
          <X className="size-5" aria-hidden />
        </button>
        <h2 className="rd-headline pr-10 text-[2rem] leading-tight text-[var(--rd-primary)]">
          {JOIN_TITLE}
        </h2>
        <p className="mt-3 text-[1.02rem] leading-snug text-[var(--rd-ink)]/75">
          {JOIN_LEDE}
        </p>
        <RequestToJoinForm className="mt-6" />
      </div>
    </div>
  );
}
