import { OAUTH_PROVIDER_LABEL, OAuthProvider } from "@alliance/common/oauth";
import { cn } from "@alliance/shared/styles/util";
import OAuthProviderIcon from "./icons/OAuthProviderIcon";

export interface OAuthButtonsProps {
  hrefFor: (provider: OAuthProvider) => string;
  /** "Continue with" or "Sign up with"; the provider's name follows. */
  verb?: string;
  className?: string;
  disabled?: boolean;
}

/** Anchors, because each flow is a top-level navigation to the server. */
const OAuthButtons = ({
  hrefFor,
  verb = "Continue with",
  className,
  disabled = false,
}: OAuthButtonsProps) => (
  <div className={cn("flex flex-col gap-3", className)}>
    {Object.values(OAuthProvider).map((provider) => (
      <a
        key={provider}
        href={disabled ? undefined : hrefFor(provider)}
        aria-disabled={disabled || undefined}
        className={cn(
          "inline-flex w-full items-center justify-center gap-3 rounded border border-zinc-300 bg-white px-4 py-3 text-[15px] font-medium text-zinc-700 transition-colors hover:bg-zinc-50",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <OAuthProviderIcon provider={provider} />
        {verb} {OAUTH_PROVIDER_LABEL[provider]}
      </a>
    ))}
  </div>
);

export default OAuthButtons;
