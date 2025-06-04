import { lazy, Suspense } from "react";
import type { HighResGlobeProps } from "./HighResGlobe.client";

// Lazy-load only in the browser
const GlobeClient = lazy(() => import("./HighResGlobe.client"));

export default function HighResGlobe(props: HighResGlobeProps) {
  // When running in Node (SSR) just render a placeholder
  if (import.meta.env.SSR) {
    return <div style={{ width: props.width, height: props.height }} />;
  }

  return (
    <Suspense
      fallback={<div style={{ width: props.width, height: props.height }} />}
    >
      <GlobeClient {...props} />
    </Suspense>
  );
}
