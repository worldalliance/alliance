import { createContext, useContext, type ReactNode } from "react";

const PerViewerOptionsContext = createContext(true);

export function PerViewerOptions({
  allowed,
  children,
}: {
  allowed: boolean;
  children: ReactNode;
}) {
  return (
    <PerViewerOptionsContext.Provider value={allowed}>
      {children}
    </PerViewerOptionsContext.Provider>
  );
}

export const usePerViewerOptionsAllowed = () =>
  useContext(PerViewerOptionsContext);
