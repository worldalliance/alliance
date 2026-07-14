import React, { createContext, useContext } from "react";

const ViewerAuthenticationContext = createContext(false);

/**
 * Mirrors "is the current viewer logged in?" into sharedweb, which can't
 * reach the apps' own AuthContexts. Each app's `AuthProvider` renders this
 * with its `isAuthenticated` state; sharedweb components read it via
 * {@link useIsViewerAuthenticated} to hide affordances that need an
 * authenticated API call (e.g. link-preview hover cards).
 *
 * Defaults to `false` when no provider is mounted, so auth-gated features
 * stay hidden rather than half-working.
 */
export function ViewerAuthenticationProvider({
  isAuthenticated,
  children,
}: React.PropsWithChildren<{ isAuthenticated: boolean }>) {
  return (
    <ViewerAuthenticationContext.Provider value={isAuthenticated}>
      {children}
    </ViewerAuthenticationContext.Provider>
  );
}

export function useIsViewerAuthenticated(): boolean {
  return useContext(ViewerAuthenticationContext);
}
