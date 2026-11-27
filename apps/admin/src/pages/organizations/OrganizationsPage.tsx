import { useMemo, useState } from "react";
import { isOrganization } from "../../lib/isOrganization";
import { useCampaignsAdmin } from "../../lib/useCampaignsAdmin";
import { useCommunitiesAdmin } from "../../lib/useCommunitiesAdmin";
import { useWaitlistLinksAdmin } from "../../lib/useWaitlistLinksAdmin";
import { PlaceId } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import {
  FilterBar,
  ListContent,
  listCount,
  SearchField,
  useListSearch,
} from "../../ui/templates/List";
import { Page } from "../../ui/templates/Page";
import { ContentState, RefreshFailedBanner } from "../../ui/templates/States";
import { MakeOrganizationDialog } from "./MakeOrganizationDialog";
import { NewOrganizationDialog } from "./NewOrganizationDialog";
import { OrganizationCard } from "./OrganizationCard";
import { groupsTakenByOthers, matchesName } from "./organizationRules";

enum Dialog {
  New = "new",
  Make = "make",
}

function CardsSkeleton() {
  return (
    <div className="flex flex-col gap-section">
      {[0, 1].map((card) => (
        <div
          key={card}
          className="flex flex-col gap-4 rounded-card border border-line bg-surface p-card"
        >
          <Skeleton className="h-5 w-48" />
          <div className="flex gap-6">
            <Skeleton className="size-14" />
            <Skeleton className="h-control w-72" />
            <Skeleton className="h-control w-72" />
          </div>
          <Skeleton className="h-24 w-full" />
        </div>
      ))}
    </div>
  );
}

export default function OrganizationsPage() {
  const [q, setQ] = useListSearch();
  const campaigns = useCampaignsAdmin();
  const groups = useCommunitiesAdmin();
  const links = useWaitlistLinksAdmin();
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const organizations = useMemo(
    () => (campaigns.data ?? []).filter(isOrganization),
    [campaigns.data],
  );
  const ordinaryCampaigns = useMemo(
    () => (campaigns.data ?? []).filter((c) => !isOrganization(c)),
    [campaigns.data],
  );
  const rows = useMemo(
    () => organizations.filter((organization) => matchesName(organization, q)),
    [organizations, q],
  );

  const parts = [
    { things: "organizations", query: campaigns },
    { things: "groups", query: groups },
    { things: "waitlist links", query: links },
  ];

  return (
    <Page
      fill
      place={PlaceId.Organizations}
      description="Each organization can own one group and any number of waitlist links. Entries through a link, or through the personal link of someone who joined through one, are attributed to it."
      actions={
        <>
          {ordinaryCampaigns.length > 0 && (
            <Button
              variant={ButtonVariant.Default}
              onClick={() => setDialog(Dialog.Make)}
            >
              Make organization…
            </Button>
          )}
          <Button
            variant={ButtonVariant.Primary}
            onClick={() => setDialog(Dialog.New)}
          >
            New organization…
          </Button>
        </>
      }
      banner={<RefreshFailedBanner parts={parts} />}
    >
      <FilterBar
        count={listCount({
          shown: rows.length,
          total: campaigns.data ? organizations.length : undefined,
          noun: "organization",
        })}
      >
        <SearchField label="Filter organizations" value={q} onChange={setQ} />
      </FilterBar>
      <ListContent cards>
        <ContentState
          parts={parts}
          refreshBanner={false}
          skeleton={<CardsSkeleton />}
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No organizations yet"
        >
          <div className="flex flex-col gap-section">
            {rows.map((organization) => (
              <OrganizationCard
                key={organization.id}
                organization={organization}
                groups={groups.data ?? []}
                takenGroupIds={groupsTakenByOthers(
                  organizations,
                  organization.id,
                )}
                links={(links.data ?? []).filter(
                  (link) => link.organizationId === organization.id,
                )}
              />
            ))}
          </div>
        </ContentState>
      </ListContent>
      {dialog === Dialog.New && (
        <NewOrganizationDialog onClose={() => setDialog(null)} />
      )}
      {dialog === Dialog.Make && (
        <MakeOrganizationDialog
          campaigns={ordinaryCampaigns}
          onClose={() => setDialog(null)}
        />
      )}
    </Page>
  );
}
