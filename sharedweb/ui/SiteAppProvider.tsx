import { siteHref } from "@alliance/common/url";
import React, { createContext, useContext } from "react";

const SiteAppContext = createContext<boolean | undefined>(undefined);

const asAuthored = (url: string): string => url;

/**
 * Marks the app served on worldalliance.org and thealliance.org, the only one
 * where an authored link to either domain can be reduced to a path.
 */
export function SiteAppProvider({ children }: React.PropsWithChildren) {
  return (
    <SiteAppContext.Provider value={true}>{children}</SiteAppContext.Provider>
  );
}

/**
 * Marks an app served on some other host — the admin, on admin.<domain>, whose
 * router has no route for a path on the site. Links stay as authored.
 */
export function AuthoredLinkProvider({ children }: React.PropsWithChildren) {
  return (
    <SiteAppContext.Provider value={false}>{children}</SiteAppContext.Provider>
  );
}

export const useSiteHref = (): ((url: string) => string) => {
  const servesTheSite = useContext(SiteAppContext);
  if (servesTheSite === undefined) {
    throw new Error(
      "no SiteAppProvider or AuthoredLinkProvider is mounted: an app has to say whether it is served on the site's own hosts before it can render a link to them",
    );
  }
  return servesTheSite ? siteHref : asAuthored;
};
