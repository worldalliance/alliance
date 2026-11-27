import { type ReactNode, useEffect, useRef } from "react";
import Button, { ButtonVariant } from "./ui/Button";

/** A whole-window failure with a reload, for when no shell could render. */
export function FullScreenError({
  title,
  children,
  detail,
}: {
  title: string;
  children?: ReactNode;
  detail?: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Replaces what was on screen, so focus moves here rather than staying on body.
  useEffect(() => heading.current?.focus(), []);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas p-6 text-center text-body text-fg">
      <h1
        ref={heading}
        tabIndex={-1}
        className="text-title font-semibold focus:outline-none"
      >
        {title}
      </h1>
      {children}
      <Button
        variant={ButtonVariant.Primary}
        onClick={() => window.location.reload()}
      >
        Reload
      </Button>
      {detail && (
        <details className="max-w-xl text-caption text-fg-muted">
          <summary className="cursor-pointer">Details</summary>
          <pre className="mt-2 text-left whitespace-pre-wrap">{detail}</pre>
        </details>
      )}
    </main>
  );
}

export function ConfigErrorScreen({ detail }: { detail: string }) {
  return (
    <FullScreenError
      title="The admin panel couldn't load its settings"
      detail={detail}
    >
      <p className="text-fg-muted">
        Reload the page. If this keeps happening, tell an engineer.
      </p>
    </FullScreenError>
  );
}
