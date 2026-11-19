import type { ReactNode } from "react";
import { NAV_HEIGHT } from "../../../site/Navbar";
import { SiteRoot } from "../../../site/PageShell";
import { KoraNavbar } from "./KoraNavbar";

export function KoraPageShell({
  children,
  busy = false,
}: {
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <SiteRoot className="flex flex-col bg-white">
      <KoraNavbar hideNavLinks />
      <main
        aria-busy={busy || undefined}
        className="flex flex-1 flex-col"
        style={{ paddingTop: NAV_HEIGHT }}
      >
        {children}
      </main>
    </SiteRoot>
  );
}
