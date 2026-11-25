import { useEffect, useRef } from "react";
import Button, { ButtonColor } from "./ui/Button";

export function ConfigErrorScreen({ detail }: { detail: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Replaces the loading screen, so focus moves here rather than staying on body.
  useEffect(() => heading.current?.focus(), []);
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-4 p-4 text-center">
      <h1
        ref={heading}
        tabIndex={-1}
        className="text-xl font-semibold focus:outline-none"
      >
        The admin panel couldn&apos;t load its settings
      </h1>
      <p>Reload the page. If this keeps happening, tell an engineer.</p>
      <Button
        color={ButtonColor.Black}
        onClick={() => window.location.reload()}
      >
        Reload
      </Button>
      <details className="max-w-xl text-sm text-gray-600">
        <summary className="cursor-pointer">Details</summary>
        <pre className="mt-2 text-left whitespace-pre-wrap">{detail}</pre>
      </details>
    </main>
  );
}
