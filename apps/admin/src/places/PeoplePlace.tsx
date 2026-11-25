import AwayMembersPage from "../pages/AwayMembersPage";
import MemberMapPage from "../pages/MemberMapPage";
import StaffDirectoryPage from "../pages/StaffDirectoryPage";
import UsersList from "../pages/UsersList";
import { PlaceId } from "../places";
import TabbedPlace from "../shell/TabbedPlace";

export default function PeoplePlace() {
  return (
    <TabbedPlace
      place={PlaceId.People}
      tabs={{
        all: UsersList,
        staff: StaffDirectoryPage,
        away: AwayMembersPage,
      }}
      views={{ map: MemberMapPage }}
    />
  );
}
