import { cn } from "@alliance/shared/styles/util";
import { socialPreviewMeta } from "../../../lib/socialPreviewMeta";
import { SiteFooter } from "../../../site/Footer";
import { NAV_HEIGHT, Navbar } from "../../../site/Navbar";
import { SiteRoot } from "../../../site/PageShell";
import { SITE_COL } from "../../../site/ui";
import { KoraSignUpPage } from "./KoraSignUpPage";
import { KoraWelcome } from "./KoraWelcome";
import { useKoraParticipant } from "./useKoraParticipant";

export function meta() {
  return socialPreviewMeta({
    title: "Safer Chatbots for Children — The Alliance",
    description:
      "Join the Alliance's project with KORA to improve the safety of chatbots for children worldwide.",
    url: "/projects/safer-chatbots-for-children",
  });
}

export default function SaferChatbotsForChildren26() {
  const { query } = useKoraParticipant();
  return query.data?.participant ? <KoraWelcomePage /> : <KoraSignUpPage />;
}

function KoraWelcomePage() {
  return (
    <SiteRoot className="flex flex-col bg-white">
      <Navbar hideNavLinks />
      <main
        className={cn(SITE_COL, "flex-1 pb-16")}
        style={{ paddingTop: `calc(${NAV_HEIGHT}px + 2.5rem)` }}
      >
        <KoraWelcome />
      </main>
      <SiteFooter collapsible />
    </SiteRoot>
  );
}
