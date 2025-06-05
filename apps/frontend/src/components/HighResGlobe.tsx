// HighResGlobe.tsx
import { lazy, Suspense, useEffect, useState } from "react";
import type { HighResGlobeProps } from "./HighResGlobe.client";

const GlobeClient = lazy(() => import("./HighResGlobe.client"));

export default function HighResGlobe(props: HighResGlobeProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => setIsClient(true), []); // flips to true right after hydrate

  const placeholder = (
    <div
      suppressHydrationWarning // tells React “the markup may change later”
      style={{ width: props.width, height: props.height }}
    />
  );

  if (!isClient) return placeholder;

  // ③ After hydrate + effect: mount the real globe
  return (
    <Suspense fallback={placeholder}>
      <GlobeClient {...props} />
    </Suspense>
  );
}
