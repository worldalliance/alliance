import WaitlistEmailsPage from "../pages/WaitlistEmailsPage";
import WaitlistPage from "../pages/WaitlistPage";
import { PlaceId } from "../places";
import TabbedPlace from "../shell/TabbedPlace";

export default function WaitlistPlace() {
  return (
    <TabbedPlace
      place={PlaceId.Waitlist}
      tabs={{ entries: WaitlistPage, emails: WaitlistEmailsPage }}
    />
  );
}
