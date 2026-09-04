import { useEffect, useRef, useState } from "react";

const GSI_SRC = "https://accounts.google.com/gsi/client";

const CLIENT_ID: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/**
 * False until `VITE_GOOGLE_CLIENT_ID` is set. Setting it is not enough on its
 * own: the server has no Google strategy, so the credential goes nowhere.
 */
export const GOOGLE_SIGN_IN_AVAILABLE = Boolean(CLIENT_ID);

const LABEL = "Sign up with Google";

type CredentialResponse = { credential: string };

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: CredentialResponse) => void;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: { theme: string; size: string; text: string; width: number },
      ) => void;
      prompt: () => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

function loadGsi(): Promise<void> {
  if (window.google) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${GSI_SRC}"]`,
  );
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("gsi")), {
        once: true,
      });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gsi"));
    document.head.appendChild(script);
  });
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-[18px] shrink-0" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/** Falls back to a button drawn to Google's outline spec where GSI fails to load. */
export function GoogleSignIn() {
  const target = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;

    loadGsi()
      .then(() => {
        const parent = target.current;
        if (cancelled || !parent || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) =>
            console.log("Encoded JWT ID token: " + response.credential),
        });
        window.google.accounts.id.renderButton(parent, {
          theme: "outline",
          size: "large",
          text: "signup_with",
          width: parent.clientWidth,
        });
        window.google.accounts.id.prompt();
        setRendered(true);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  if (!GOOGLE_SIGN_IN_AVAILABLE) return null;

  return (
    <>
      <div ref={target} className="flex justify-center empty:hidden" />
      {!rendered && (
        <button
          type="button"
          onClick={() => window.google?.accounts.id.prompt()}
          className="flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-[#dadce0] bg-white text-sm font-medium text-[#3c4043] transition-colors hover:bg-zinc-50"
        >
          <GoogleMark />
          {LABEL}
        </button>
      )}
    </>
  );
}

export function EmailDivider() {
  const rule = "h-px flex-1 bg-zinc-200";
  return (
    <p className="flex items-center gap-3 text-xs text-zinc-500">
      <span className={rule} aria-hidden />
      Or continue with email
      <span className={rule} aria-hidden />
    </p>
  );
}
