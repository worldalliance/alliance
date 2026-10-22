import { useEffect, useState } from "react";

/**
 * The origin the member is on, once mounted. SSR has no location, so until
 * then the caller's canonical origin stands in: a click before hydration acts
 * on that domain rather than on a dead link.
 */
export function useAppOrigin(canonical: string): string {
  const [origin, setOrigin] = useState(canonical);
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}
