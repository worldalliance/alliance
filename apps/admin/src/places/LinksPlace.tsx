import CustomLinksPage from "../pages/CustomLinksPage";
import ExternalShareTargetsPage from "../pages/ExternalShareTargetsPage";
import HostedDocsPage from "../pages/HostedDocsPage";
import ShareLinksPage from "../pages/ShareLinksPage";
import { PlaceId } from "../places";
import TabbedPlace from "../shell/TabbedPlace";

export default function LinksPlace() {
  return (
    <TabbedPlace
      place={PlaceId.Links}
      tabs={{
        "share-links": ShareLinksPage,
        "custom-links": CustomLinksPage,
        "share-targets": ExternalShareTargetsPage,
        "hosted-docs": HostedDocsPage,
      }}
    />
  );
}
