import InviteFeedPage from "../pages/InviteFeedPage";
import InviteGraphPage from "../pages/InviteGraphPage";
import InviteLinksPage from "../pages/InviteLinksPage";
import InviteMessageTemplatePage from "../pages/InviteMessageTemplatePage";
import InvitesPage from "../pages/InvitesPage";
import { PlaceId } from "../places";
import TabbedPlace from "../shell/TabbedPlace";
import Button, { ButtonVariant } from "../ui/Button";

function LiveFeed() {
  return (
    <>
      <div className="flex justify-end px-page py-bar">
        <Button
          to="/growth/invites/feed"
          variant={ButtonVariant.Default}
          size="small"
        >
          Full screen
        </Button>
      </div>
      <InviteFeedPage embedded />
    </>
  );
}

export default function InvitesPlace() {
  return (
    <TabbedPlace
      place={PlaceId.Invites}
      tabs={{
        invites: InvitesPage,
        links: InviteLinksPage,
        graph: InviteGraphPage,
        feed: LiveFeed,
        template: InviteMessageTemplatePage,
      }}
    />
  );
}
