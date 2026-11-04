import { cn } from "@alliance/shared/styles/util";
import { socialPreviewMeta } from "../../../lib/socialPreviewMeta";
import { SiteFooter } from "../../../site/Footer";
import { NAV_HEIGHT, Navbar } from "../../../site/Navbar";
import { SiteRoot } from "../../../site/PageShell";
import { SITE_COL } from "../../../site/ui";
import { KoraSignedIn } from "./KoraSignIn";
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
  const kora = useKoraParticipant();
  const { query } = kora;
  if (query.isPending) {
    return (
      <SiteRoot className="bg-white">
        <Navbar />
        <main aria-busy className="min-h-svh" />
      </SiteRoot>
    );
  }
  const participant = query.data?.participant;
  if (!participant) {
    return <KoraSignUpPage />;
  }
  return (
    <SiteRoot className="flex flex-col bg-white">
      <Navbar hideNavLinks />
      <main
        className={cn(SITE_COL, "flex-1 pb-16")}
        style={{ paddingTop: `calc(${NAV_HEIGHT}px + 2.5rem)` }}
      >
        <KoraWelcome
          account={<KoraSignedIn kora={kora} participant={participant} />}
        />
      </main>
      <SiteFooter collapsible />
    </SiteRoot>
  );
}
