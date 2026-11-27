import { formatPhoneNumberForDisplay } from "@alliance/common/phone";
import type { UserAdminDetailDto } from "@alliance/shared/client/types.gen";
import { thrownStatus } from "@alliance/shared/lib/hey-api";
import type { ReactNode } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { memberHref } from "../../lib/hrefs";
import { useUserAwayRangesAdmin } from "../../lib/useUserAwayRangesAdmin";
import { useUserDetailAdmin } from "../../lib/useUserDetailAdmin";
import { AvatarProfile } from "../../ui/Avatar";
import Button, { ButtonVariant } from "../../ui/Button";
import Sheet from "../../ui/Sheet";
import { Skeleton } from "../../ui/Skeleton";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { Fact, FactList, SidePanelSection } from "../../ui/templates/Record";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
} from "../../ui/templates/States";
import { MemberStandingFacts, MemberStatusBadges } from "./MemberFacts";

const skeleton = (
  <div className="flex flex-col gap-3">
    <Skeleton className="size-16 rounded-full" />
    {[0, 1, 2, 3, 4, 5].map((row) => (
      <Skeleton key={row} className="h-5 w-full" />
    ))}
  </div>
);

function MemberContactFacts({ user }: { user: UserAdminDetailDto }) {
  return (
    <SidePanelSection title="Contact">
      <FactList>
        <Fact label="Email">
          <span className="min-w-0 break-words">{user.email}</span>
        </Fact>
        <Fact label="Phone">
          {user.phoneNumber
            ? formatPhoneNumberForDisplay(user.phoneNumber)
            : "—"}
        </Fact>
      </FactList>
    </SidePanelSection>
  );
}

/**
 * A look at one member from a list: who they are, how to reach them and where
 * they stand, with "Open" to their full record. A list puts its up and down
 * controls in `headerActions`.
 */
export function MemberSheet({
  userId,
  onClose,
  headerActions,
}: {
  userId: number;
  onClose: () => void;
  headerActions?: ReactNode;
}) {
  const { query } = useUserDetailAdmin(userId);
  const away = useUserAwayRangesAdmin(userId);
  const missing = thrownStatus(query.error) === 404;
  const user = missing ? undefined : query.data;
  const currentAway = away.query.isSuccess
    ? (away.currentAwayRange ?? null)
    : undefined;

  return (
    <Sheet
      open
      modal={false}
      size="peek"
      onClose={onClose}
      title={user?.name ?? "Member"}
      headerActions={
        <>
          {headerActions}
          <Button
            size="small"
            variant={ButtonVariant.Default}
            to={memberHref(userId)}
          >
            Open
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 px-card py-card">
        <RefreshFailedBanner
          inline
          parts={[
            ...(missing ? [] : [{ things: "this member", query }]),
            { things: "their away periods", query: away.query },
          ]}
        />
        {user && away.query.isLoadingError && (
          <Banner tone={BannerTone.Danger} inline>
            Couldn't load {user.name}'s away periods, so whether they are away
            now isn't shown.{" "}
            {adminRefusalMessage(away.query.error, LOAD_FAILED_FALLBACK)}
          </Banner>
        )}
        <ContentState
          loading={query.isPending}
          skeleton={skeleton}
          error={
            query.isLoadingError && !missing
              ? adminRefusalMessage(query.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load this member"
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
          empty={!user}
          emptyTitle="Member not found"
          emptyDescription="Their account may have been deleted."
        >
          {user && (
            <>
              <div className="flex items-center gap-3">
                <AvatarProfile
                  pfp={user.profilePicture}
                  size="override"
                  alt=""
                  className="size-16"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <MemberStatusBadges user={user} away={currentAway} />
                </div>
              </div>
              <div>
                <MemberContactFacts user={user} />
                <MemberStandingFacts user={user} away={currentAway} />
              </div>
            </>
          )}
        </ContentState>
      </div>
    </Sheet>
  );
}
