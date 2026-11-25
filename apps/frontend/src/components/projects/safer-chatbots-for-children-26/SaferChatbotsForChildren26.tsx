import { KORA_REVIEW_PATH, KoraProjectStatus } from "@alliance/common/kora";
import { cn } from "@alliance/shared/styles/util";
import { Navigate, useSearchParams } from "react-router";
import { useAuth } from "../../../lib/AuthContext";
import { socialPreviewMeta } from "../../../lib/socialPreviewMeta";
import { SiteFooter } from "../../../site/Footer";
import { NAV_HEIGHT } from "../../../site/Navbar";
import { SiteRoot } from "../../../site/PageShell";
import { SITE_COL } from "../../../site/ui";
import { KoraHomeBase } from "./KoraHomeBase";
import { KoraNavbar } from "./KoraNavbar";
import { KoraSignUpPage } from "./KoraSignUpPage";
import { KoraViewer, KoraWelcome } from "./KoraWelcome";
import { useKoraParticipant, useKoraProject } from "./useKoraParticipant";

export function meta() {
  return socialPreviewMeta({
    title: "Safer Chatbots for Children — The Alliance",
    description:
      "Join the Alliance's project with KORA to improve the safety of chatbots for children worldwide.",
    url: "/projects/safer-chatbots-for-children",
  });
}

export default function SaferChatbotsForChildren26() {
  const member = useAuth();
  const { query } = useKoraParticipant();
  const project = useKoraProject();
  const [searchParams] = useSearchParams();
  const returningToReview = searchParams.get("next") === "review";
  if (member.loading || query.isPending || project.isPending) {
    return (
      <SiteRoot className="bg-white">
        <KoraNavbar />
        <main aria-busy className="min-h-svh" />
      </SiteRoot>
    );
  }
  if (project.isError) {
    return (
      <SiteRoot className="bg-white">
        <KoraNavbar />
        <main
          className={SITE_COL}
          style={{ paddingTop: `calc(${NAV_HEIGHT}px + 2.5rem)` }}
        >
          <p role="alert" className="text-red-600">
            Couldn&apos;t load the project. Reload to try again.
          </p>
        </main>
      </SiteRoot>
    );
  }
  const status = project.data.status;
  const closed = status === KoraProjectStatus.Closed;
  const participant = query.data?.participant;
  if ((participant || member.isAuthenticated) && returningToReview) {
    return <Navigate to={KORA_REVIEW_PATH} replace />;
  }
  if (!participant && !member.isAuthenticated) {
    return <KoraSignUpPage closed={closed} />;
  }
  return (
    <SiteRoot className="flex flex-col bg-white">
      <KoraNavbar hideNavLinks />
      <main
        className={cn(SITE_COL, "flex-1 pb-16")}
        style={{ paddingTop: `calc(${NAV_HEIGHT}px + 2.5rem)` }}
      >
        {status === KoraProjectStatus.Active ? (
          <KoraHomeBase />
        ) : (
          <KoraWelcome
            viewer={
              member.isAuthenticated
                ? KoraViewer.Member
                : KoraViewer.Participant
            }
            status={status}
          />
        )}
      </main>
      <SiteFooter collapsible />
    </SiteRoot>
  );
}
