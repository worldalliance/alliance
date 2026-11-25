import NeedsReplyPage from "../pages/NeedsReplyPage";
import TextsPage from "../pages/TextsPage";
import { PlaceId } from "../places";
import TabbedPlace from "../shell/TabbedPlace";

export default function InboxPlace() {
  return (
    <TabbedPlace
      place={PlaceId.Inbox}
      tabs={{ "needs-reply": NeedsReplyPage, all: TextsPage }}
    />
  );
}
