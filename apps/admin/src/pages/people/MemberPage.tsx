import { formatPhoneNumberForDisplay } from "@alliance/common/phone";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import { userFriendsQuery } from "@alliance/shared/lib/user";
import { prefetchFromLoader } from "@alliance/sharedweb/lib/queryClient";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { useParams } from "react-router";
import type { Route } from "../../../.react-router/types/src/pages/people/+types/MemberPage";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { tagSummariesQuery } from "../../lib/useTagsAdmin";
import { userActionRelationsQuery } from "../../lib/useUserActionRelationsAdmin";
import { useUserAwayRangesAdmin } from "../../lib/useUserAwayRangesAdmin";
import {
  useUserDetailAdmin,
  userDetailQuery,
} from "../../lib/useUserDetailAdmin";
import {
  userFormResponsesQuery,
  userNotifsQuery,
} from "../../lib/useUserNotifsAndFormsAdmin";
import { PlaceId, RecordId, placeById } from "../../places";
import { AvatarProfile } from "../../ui/Avatar";
import Button, { ButtonVariant } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Page } from "../../ui/templates/Page";
import { RecordBody } from "../../ui/templates/Record";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { type UrlTabs, useRecordTabs } from "../../ui/templates/usePlaceTabs";
import { MemberStandingFacts, MemberStatusBadges } from "./MemberFacts";
import { MemberFormResponsesPanel } from "./MemberFormResponsesPanel";
import { MemberHeaderActions } from "./MemberHeaderActions";
import { MemberMembershipTab } from "./MemberMembershipTab";
import { MemberNotificationsTab } from "./MemberNotificationsTab";
import { MemberProfileTab } from "./MemberProfileTab";
import { MemberTasksTab } from "./MemberTasksTab";
import { MemberTextsTab } from "./MemberTextsTab";

const TABS = [
  "texts",
  "tasks",
  "membership",
  "notifications",
  "profile",
] as const;
type Tab = (typeof TABS)[number];

const SKELETON = (
  <RecordBody
    side={
      <div className="flex flex-col gap-3">
        <Skeleton className="size-16 rounded-full" />
        {[0, 1, 2, 3, 4].map((row) => (
          <Skeleton key={row} className="h-5 w-full" />
        ))}
      </div>
    }
  >
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex min-h-12 items-center border-b border-line px-card">
        <Skeleton className="h-4 w-40" />
      </div>
      <TableSkeleton columns={4} rows={6} />
    </div>
  </RecordBody>
);

const notFound = (
  <ContentState
    loading={false}
    skeleton={null}
    errorTitle="Couldn't load this member"
    empty
    emptyTitle="Member not found"
    emptyDescription="Their account may have been deleted."
    emptyAction={
      <Button
        variant={ButtonVariant.Default}
        to={placeById(PlaceId.People).path}
      >
        All people
      </Button>
    }
  >
    {null}
  </ContentState>
);

const memberId = (param: string | undefined) =>
  param !== undefined && /^\d+$/.test(param) ? Number(param) : null;

/** Loads over what is cached, so a member deleted since shows as not found. */
export function clientLoader({ params }: Route.LoaderArgs) {
  const id = memberId(params.userId);
  if (id === null) return null;
  prefetchFromLoader(userDetailQuery(id));
  prefetchFromLoader(userActionRelationsQuery(id));
  prefetchFromLoader(tagSummariesQuery());
  prefetchFromLoader(userFriendsQuery(id));
  prefetchFromLoader(userNotifsQuery(id));
  prefetchFromLoader(userFormResponsesQuery(id));
  return null;
}

/** `/members/:userId`: everything staff know and can do about one member. */
export default function MemberPage() {
  const { userId } = useParams();
  const tabs = useRecordTabs(RecordId.Member, TABS);
  const id = memberId(userId);
  if (id === null) {
    return (
      <Page record={RecordId.Member} description="" tabs={tabs}>
        {notFound}
      </Page>
    );
  }
  return <MemberRecord key={id} userId={id} tabs={tabs} />;
}

function MemberRecord({
  userId,
  tabs,
}: {
  userId: number;
  tabs: UrlTabs<Tab>;
}) {
  const detail = useUserDetailAdmin(userId);
  const away = useUserAwayRangesAdmin(userId);
  const { query } = detail;
  // A member deleted since they were cached refetches as a 404 over the copy.
  const missing = thrownStatus(query.error) === 404;
  const user = missing ? undefined : query.data;

  const [actionError, setActionError] = useState<string | null>(null);
  const reportError = useCallback(
    (message: string) => setActionError(message),
    [],
  );
  const clearError = useCallback(() => setActionError(null), []);
  const errors = { reportError, clearError };
  const currentAway = away.query.isSuccess
    ? (away.currentAwayRange ?? null)
    : undefined;

  const body: Record<Tab, (shown: NonNullable<typeof user>) => ReactNode> = {
    texts: (shown) => <MemberTextsTab member={shown} />,
    tasks: (shown) => (
      <>
        <MemberTasksTab member={shown} {...errors} />
        <MemberFormResponsesPanel userId={shown.id} />
      </>
    ),
    membership: (shown) => (
      <MemberMembershipTab
        user={shown}
        detail={detail}
        away={away}
        {...errors}
      />
    ),
    notifications: (shown) => <MemberNotificationsTab userId={shown.id} />,
    profile: (shown) => <MemberProfileTab user={shown} />,
  };

  return (
    <Page
      record={RecordId.Member}
      title={user?.name}
      avatar={
        <AvatarProfile
          pfp={user?.profilePicture ?? null}
          size="medium"
          alt=""
        />
      }
      badge={user && <MemberStatusBadges user={user} away={currentAway} />}
      description={
        user
          ? [
              user.email,
              user.phoneNumber && formatPhoneNumberForDisplay(user.phoneNumber),
            ]
              .filter(Boolean)
              .join(" · ")
          : ""
      }
      actions={
        user && <MemberHeaderActions user={user} detail={detail} {...errors} />
      }
      tabs={tabs}
      banner={
        <>
          {!missing && (
            <RefreshFailedBanner things="this member" query={query} />
          )}
          {user && away.query.isLoadingError && tabs.value !== "membership" && (
            <Banner tone={BannerTone.Danger}>
              Couldn't load {user.name}'s away periods, so whether they are away
              now isn't shown.{" "}
              {adminRefusalMessage(away.query.error, LOAD_FAILED_FALLBACK)}
            </Banner>
          )}
          {actionError && (
            <Banner
              tone={BannerTone.Danger}
              action={
                <Button
                  size="small"
                  variant={ButtonVariant.Ghost}
                  onClick={clearError}
                >
                  Dismiss
                </Button>
              }
            >
              {actionError}
            </Banner>
          )}
        </>
      }
    >
      {missing ? (
        notFound
      ) : (
        <ContentState
          things="this member"
          query={query}
          refreshBanner={false}
          skeleton={SKELETON}
        >
          {user && (
            <RecordBody
              side={<MemberStandingFacts user={user} away={currentAway} />}
            >
              {body[tabs.value](user)}
            </RecordBody>
          )}
        </ContentState>
      )}
    </Page>
  );
}
