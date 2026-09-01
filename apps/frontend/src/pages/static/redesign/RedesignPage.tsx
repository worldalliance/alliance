import type { ReactNode } from "react";
import { useParams, useSearchParams } from "react-router";
import { parsePage, RedesignPage } from "./links";
import { RedesignFaqPage } from "./pages/FaqPage";
import { RedesignFoundationPage } from "./pages/FoundationPage";
import { RedesignGovernancePage } from "./pages/GovernancePage";
import { RedesignGuidePage } from "./pages/GuidePage";
import { RedesignJoinPage } from "./pages/JoinPage";
import { RedesignPrivacyPage, RedesignTermsPage } from "./pages/LegalPages";
import { RedesignPartnerPage } from "./pages/PartnerPage";
import { RedesignPeoplePage } from "./pages/PeoplePage";
import { RedesignProgressPage } from "./pages/ProgressPage";
import { RedesignSystemPage } from "./pages/SystemPage";
import "./redesign.css";
import { RedesignHome } from "./RedesignHome";
import { JoinRequestProvider } from "./sections/JoinRequest";
import {
  parseVersion,
  redesignThemes,
  type RedesignTheme,
  type RedesignVersion,
} from "./theme";
import { VersionConsole } from "./VersionConsole";

export function meta() {
  return [
    { title: "The Alliance — homepage mockups" },
    { name: "robots", content: "noindex" },
  ];
}

const pageByKind: Record<
  RedesignPage,
  (props: { theme: RedesignTheme }) => ReactNode
> = {
  [RedesignPage.Home]: RedesignHome,
  [RedesignPage.People]: RedesignPeoplePage,
  [RedesignPage.Guide]: RedesignGuidePage,
  [RedesignPage.Progress]: RedesignProgressPage,
  [RedesignPage.Partner]: RedesignPartnerPage,
  [RedesignPage.Join]: RedesignJoinPage,
  [RedesignPage.Faq]: RedesignFaqPage,
  [RedesignPage.Governance]: RedesignGovernancePage,
  [RedesignPage.Foundation]: RedesignFoundationPage,
  [RedesignPage.Privacy]: RedesignPrivacyPage,
  [RedesignPage.Terms]: RedesignTermsPage,
  [RedesignPage.System]: RedesignSystemPage,
};

/**
 * Serves every page of every mockup. `?v=` picks the version, the `:page`
 * segment picks the page, and both routes land here.
 */
export default function RedesignRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams();
  const version = parseVersion(searchParams.get("v"));
  const page = parsePage(params.page);
  const theme = redesignThemes[version];
  const Component = pageByKind[page];

  const select = (next: RedesignVersion) => {
    setSearchParams({ v: next }, { preventScrollReset: true });
  };

  return (
    <JoinRequestProvider theme={theme}>
      {/* Remounting restarts the animations when either axis changes. */}
      <Component key={`${version}-${page}`} theme={theme} />
      <VersionConsole active={version} activePage={page} onSelect={select} />
    </JoinRequestProvider>
  );
}
