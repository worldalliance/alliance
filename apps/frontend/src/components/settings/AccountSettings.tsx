import { refusalMessage } from "@alliance/common/errorMessage";
import {
  OAUTH_PROVIDER_LABEL,
  OAuthError,
  OAuthIntent,
  OAuthProvider,
} from "@alliance/common/oauth";
import { R, type Result } from "@alliance/common/result";
import { authForgotPassword, authRefreshTokens } from "@alliance/shared/client";
import type { SettingsSaveStatus } from "@alliance/shared/lib/settings";
import {
  canDisconnect,
  passwordAction,
  useSignInMethods,
  type SignInMethods,
} from "@alliance/shared/lib/signInMethods";
import {
  oauthNoticeMessage,
  oauthStartUrl,
  useOAuthNotice,
  type OAuthNotice,
} from "@alliance/sharedweb/lib/oauth";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import OAuthProviderIcon from "@alliance/sharedweb/ui/icons/OAuthProviderIcon";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getApiUrl } from "../../lib/config";

export const ACCOUNT_SECTION_ID = "account";

enum FeedbackTone {
  Success = "success",
  Error = "error",
}

type Feedback = { tone: FeedbackTone; message: string };

const NOTICE_TONE: Record<OAuthNotice["kind"], FeedbackTone> = {
  outcome: FeedbackTone.Success,
  error: FeedbackTone.Error,
};

function noticeFeedback(notice: OAuthNotice | null): Feedback | null {
  if (
    !notice ||
    (notice.kind === "error" && notice.error === OAuthError.Cancelled)
  ) {
    return null;
  }
  const message = oauthNoticeMessage(notice);
  return message ? { tone: NOTICE_TONE[notice.kind], message } : null;
}

const FEEDBACK_STYLE: Record<
  FeedbackTone,
  { role: "alert" | "status"; className: string }
> = {
  [FeedbackTone.Success]: { role: "status", className: "text-green" },
  [FeedbackTone.Error]: { role: "alert", className: "text-red-700" },
};

const FeedbackLine = ({ feedback }: { feedback: Feedback | null }) =>
  feedback && (
    <p
      role={FEEDBACK_STYLE[feedback.tone].role}
      className={`text-sm mt-2 ${FEEDBACK_STYLE[feedback.tone].className}`}
    >
      {feedback.message}
    </p>
  );

enum LeaveSettings {
  Go = "go",
  Wait = "wait",
  Stop = "stop",
}

/**
 * Whether a navigation away from settings may go now, should wait for the
 * autosave, or would drop an edit that can't save.
 */
const LEAVE_SETTINGS: Record<SettingsSaveStatus, LeaveSettings> = {
  saved: LeaveSettings.Go,
  saving: LeaveSettings.Wait,
  unsaved: LeaveSettings.Wait,
  failed: LeaveSettings.Stop,
  blocked: LeaveSettings.Stop,
};

/**
 * The link start endpoint accepts only a live access cookie, and a navigation
 * skips the client's refresh on a 401.
 */
async function refreshSession(label: string): Promise<Result<void, string>> {
  const fallback = `Couldn't connect ${label}. Please try again.`;
  const refreshed = await R.fromPromise(authRefreshTokens());
  if (!refreshed.ok) {
    return R.failure(fallback);
  }
  const { error, response } = refreshed.value;
  return error
    ? R.failure(
        refusalMessage({
          status: response.status,
          error,
          fallback,
          sessionExpired: `Your session has expired. Sign in again to connect ${label}.`,
        }),
      )
    : R.success(undefined);
}

function PasswordAccess({
  email,
  methods,
  loadFailed,
}: {
  email: string;
  methods: SignInMethods | null;
  loadFailed: boolean;
}) {
  const { label, verb } = passwordAction(methods);
  const send = useMutation({
    mutationFn: async () => {
      const response = await authForgotPassword({ body: { email } });
      if (response.error) {
        throw response.error;
      }
    },
    onError: (error) => console.error(error),
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <Button
          color={ButtonColor.Black}
          className="sm:self-start"
          onClick={() => send.mutate()}
          disabled={(!methods && !loadFailed) || send.isPending}
        >
          {send.isPending ? "Sending link..." : label}
        </Button>
        {!send.isSuccess && (
          <p className="text-sm text-zinc-500">
            We&apos;ll send a link to {verb} your password to {email}.
          </p>
        )}
      </div>
      <FeedbackLine
        feedback={
          send.isSuccess
            ? {
                tone: FeedbackTone.Success,
                message: `A link to ${verb} your password has been sent to ${email}.`,
              }
            : send.isError
              ? {
                  tone: FeedbackTone.Error,
                  message: "Couldn't send the email. Please try again.",
                }
              : null
        }
      />
    </div>
  );
}

export default function AccountSettings({
  email,
  saveStatus,
  impersonating,
}: {
  email: string;
  /** Connecting leaves the page, so it waits for pending edits to save. */
  saveStatus: SettingsSaveStatus;
  /** The server refuses to link or unlink for an impersonated session. */
  impersonating: boolean;
}) {
  const signIn = useSignInMethods();
  const { confirm } = useToast();
  const notice = useOAuthNotice();
  const [feedback, setFeedback] = useState(() => noticeFeedback(notice));
  const [connecting, setConnecting] = useState<OAuthProvider | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!connecting) {
      return;
    }
    const label = OAUTH_PROVIDER_LABEL[connecting];
    const stop = (message: string) => {
      setConnecting(null);
      setFeedback({ tone: FeedbackTone.Error, message });
    };
    switch (LEAVE_SETTINGS[saveStatus]) {
      case LeaveSettings.Go: {
        let cancelled = false;
        void refreshSession(label).then((refreshed) => {
          if (cancelled) {
            return;
          }
          if (!refreshed.ok) {
            stop(refreshed.error);
            return;
          }
          window.location.assign(
            oauthStartUrl({
              apiUrl: getApiUrl(),
              provider: connecting,
              intent: OAuthIntent.Link,
              returnTo: `${window.location.origin}${window.location.pathname}#${ACCOUNT_SECTION_ID}`,
            }),
          );
        });
        return () => {
          cancelled = true;
        };
      }
      case LeaveSettings.Wait:
        return;
      case LeaveSettings.Stop:
        stop(
          `Your settings changes haven't saved. Fix or retry them before connecting ${label}.`,
        );
        return;
      default:
        throw new Error(
          `unknown leave gate: ${LEAVE_SETTINGS[saveStatus] satisfies never}`,
        );
    }
  }, [connecting, saveStatus]);

  // Back from the provider can restore this page from the bfcache mid-connect.
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setConnecting(null);
      }
    };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);

  const { methods } = signIn;
  const locked =
    impersonating || signIn.busy || connecting !== null || confirming;

  const disconnect = async (provider: OAuthProvider, anchorEl: HTMLElement) => {
    const label = OAUTH_PROVIDER_LABEL[provider];
    setConfirming(true);
    const ok = await confirm({
      title: `Disconnect ${label}?`,
      message: `You won't be able to log in with ${label} until you connect it again.`,
      confirmLabel: `Disconnect ${label}`,
      cancelLabel: "Cancel",
      anchorEl,
    });
    setConfirming(false);
    if (!ok) {
      return;
    }
    setFeedback(null);
    signIn.resetDisconnect();
    signIn.disconnect(provider, {
      onSuccess: () =>
        setFeedback({
          tone: FeedbackTone.Success,
          message: `${label} disconnected.`,
        }),
    });
  };

  return (
    <div className="flex flex-col gap-y-6">
      <PasswordAccess
        email={email}
        methods={methods}
        loadFailed={signIn.loadFailed}
      />

      <div>
        <h3 className="font-semibold! text-lg! mb-2">Connected accounts</h3>
        {impersonating && (
          <p className="text-sm text-zinc-500 mb-2">
            Connected accounts can&apos;t be changed while impersonating.
          </p>
        )}
        {!methods ? (
          signIn.loadFailed ? (
            <div className="flex items-center gap-3">
              <p role="alert" className="text-sm text-red-700">
                Couldn&apos;t load your connected accounts.
              </p>
              <Button
                onClick={() => void signIn.reload()}
                color={ButtonColor.RedOutline}
                size="small"
              >
                Try again
              </Button>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Loading...</p>
          )
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200 border-y border-zinc-200">
            {Object.values(OAuthProvider).map((provider) => {
              const label = OAUTH_PROVIDER_LABEL[provider];
              const account = methods.accounts[provider];
              const removable = canDisconnect(methods, provider);
              return (
                <li key={provider} className="py-3">
                  <div className="flex items-center gap-3">
                    <OAuthProviderIcon provider={provider} size={20} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium mb-0">{label}</p>
                      {account && (
                        <p className="text-sm text-zinc-500 mb-0 truncate">
                          {account.email}
                        </p>
                      )}
                    </div>
                    {account ? (
                      <Button
                        color={ButtonColor.White}
                        size="small"
                        disabled={locked || !removable}
                        onClick={(event) =>
                          void disconnect(provider, event.currentTarget)
                        }
                      >
                        Disconnect<span className="sr-only"> {label}</span>
                      </Button>
                    ) : (
                      <Button
                        color={ButtonColor.White}
                        size="small"
                        disabled={locked}
                        onClick={() => {
                          setFeedback(null);
                          signIn.resetDisconnect();
                          setConnecting(provider);
                        }}
                      >
                        {connecting === provider ? "Connecting..." : "Connect"}
                        <span className="sr-only"> {label}</span>
                      </Button>
                    )}
                  </div>
                  {account && !removable && (
                    <p className="text-sm text-zinc-500 mt-1 mb-0">
                      {label} is your only way to log in. Set a password or
                      connect another account before disconnecting it.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <FeedbackLine
          feedback={
            signIn.disconnectError
              ? { tone: FeedbackTone.Error, message: signIn.disconnectError }
              : feedback
          }
        />
      </div>
    </div>
  );
}
