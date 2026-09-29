import { siteHref } from "@alliance/common/url";
import React, { createContext, useCallback, useContext } from "react";

const SiteAppContext = createContext<((url: string) => string) | undefined>(
  undefined,
);

/**
 * Marks the app served on worldalliance.org and thealliance.org, the only one
 * where an authored link to either domain can be reduced to a path.
 */
export function SiteAppProvider({ children }: React.PropsWithChildren) {
  return (
    <SiteAppContext.Provider value={siteHref}>
      {children}
    </SiteAppContext.Provider>
  );
}

/**
 * Marks an app served on some other host — the admin, on admin.<domain>, whose
 * router has no route for a path on the site. An authored link to either
 * domain is aimed at `origin` instead.
 */
export function SiteOriginLinkProvider({
  origin,
  children,
}: React.PropsWithChildren<{ origin: string }>) {
  const toOrigin = useCallback(
    (url: string): string => {
      const href = siteHref(url);
      return href === url ? url : `${origin}${href}`;
    },
    [origin],
  );
  return (
    <SiteAppContext.Provider value={toOrigin}>
      {children}
    </SiteAppContext.Provider>
  );
}

export const useSiteHref = (): ((url: string) => string) => {
  const href = useContext(SiteAppContext);
  if (href === undefined) {
    throw new Error(
      "no SiteAppProvider or SiteOriginLinkProvider is mounted: an app has to say whether it is served on the site's own hosts before it can render a link to them",
    );
  }
  return href;
};
