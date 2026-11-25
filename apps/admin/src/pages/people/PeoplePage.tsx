import type { ReactNode } from "react";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import { PlaceId, placeById } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { ViewSwitch } from "../../ui/templates/List";
import { Page } from "../../ui/templates/Page";
import { usePlaceTabs, usePlaceViews } from "../../ui/templates/usePlaceTabs";
import { AllTab } from "./AllTab";
import { AwayTab } from "./AwayTab";
import { MapView } from "./MapView";
import { StaffTab } from "./StaffTab";

const TABS = ["all", "staff", "away"] as const;
type Tab = (typeof TABS)[number];
const VIEWS = ["table", "map"] as const;
type View = (typeof VIEWS)[number];

export default function PeoplePage() {
  const tabs = usePlaceTabs(PlaceId.People, TABS);
  const views = usePlaceViews(PlaceId.People, VIEWS);
  // The map counts every member with an active contract, so it is a view of
  // All only; Staff and Away keep their own list whatever the view.
  const onAll = tabs.value === "all";
  const users = useUsersAdmin({ enabled: onAll && views.value === "table" });
  const allBody: Record<View, () => ReactNode> = {
    table: () => <AllTab users={users} />,
    map: () => <MapView />,
  };
  const body: Record<Tab, () => ReactNode> = {
    all: allBody[views.value],
    staff: () => <StaffTab />,
    away: () => <AwayTab />,
  };
  return (
    <Page
      fill
      place={PlaceId.People}
      actions={
        onAll && (
          <>
            <Button
              variant={ButtonVariant.Default}
              to={placeById(PlaceId.Tags).path}
            >
              Manage tags
            </Button>
            <ViewSwitch label="View" {...views} />
          </>
        )
      }
      tabs={tabs}
    >
      {body[tabs.value]()}
    </Page>
  );
}
