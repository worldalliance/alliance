import type { ProfileDto, UserAdminDetailDto } from "@alliance/shared/client/types.gen";
import { useUserFriendsQuery } from "@alliance/shared/lib/user";
import { loaderPrefetchStaleTime } from "@alliance/sharedweb/lib/queryClient";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { formatCount } from "../../lib/formatNumber";
import { memberHref } from "../../lib/hrefs";
import { PersonCell } from "../../ui/PersonCell";
import { linkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Fact } from "../../ui/templates/Record";
import { Panel } from "../../ui/templates/Overview";
import { ContentState, TableSkeleton } from "../../ui/templates/States";
import { inviteSource, reminderTime, sentenceCase } from "./memberRules";

const invitedBy = (user: UserAdminDetailDto): ReactNode => {
  const by = user.invitedBy;
  if (!by) return "No invite attribution";
  const source = inviteSource(by);
  switch (by.kind) {
    case "user":
      return by.userId ? (
        <span>
          <Link to={memberHref(by.userId)} className={linkClass}>
            {by.label}
          </Link>
          {source}
        </span>
      ) : (
        `${by.label}${source}`
      );
    case "campaign":
      return `${by.label}${source}`;
    case "unknown":
      return by.label;
    default:
      throw new Error(`unknown invited by kind: ${by.kind satisfies never}`);
  }
};

const shared = (value: boolean) => (value ? "Shared" : "Private");

function MemberAboutPanel({ user }: { user: UserAdminDetailDto }) {
  const bio = user.profileDescription?.trim();
  return (
    <Panel title="About">
      <div className="flex flex-col gap-4">
        <p className={bio ? "max-w-prose whitespace-pre-wrap break-words" : "text-fg-muted"}>
          {bio ? user.profileDescription : "No bio provided."}
        </p>
        <dl className="grid grid-cols-1 gap-x-8 @4xl:grid-cols-2">
          <Fact label="Invited by">{invitedBy(user)}</Fact>
          <Fact label="Public profile">
            {user.shareInfoPublicly ? "Shared publicly" : "Private"}
          </Fact>
          <Fact label="Anonymous">{user.anonymous ? "Yes" : "No"}</Fact>
          <Fact label="Email with leads">{shared(user.shareEmailWithCommunityLead)}</Fact>
          <Fact label="Phone with leads">{shared(user.sharePhoneNumberWithCommunityLead)}</Fact>
          <Fact label="Form responses">
            {user.formDataPreference ? sentenceCase(user.formDataPreference) : "—"}
          </Fact>
          <Fact label="Reminder time">{reminderTime(user) ?? "—"}</Fact>
          <Fact label="Cluster">
            {user.clusterId === null ? "—" : `#${user.clusterId}`}
          </Fact>
        </dl>
      </div>
    </Panel>
  );
}

const friendStanding = (friend: ProfileDto) =>
  [
    friend.hasActiveContract ? "Signed" : "Not signed",
    friend.ambassador && "Ambassador",
    friend.isCommunityLeader && "Leader",
  ]
    .filter(Boolean)
    .join(" · ");

function MemberFriendsPanel({ userId }: { userId: number }) {
  const query = useUserFriendsQuery(userId, { staleTime: loaderPrefetchStaleTime });
  const friends = query.data ?? [];
  return (
    <Panel
      title="Friends"
      description={query.data ? formatCount(friends.length) : undefined}
      flush
    >
      <ContentState
        things="friends"
        query={query}
        skeleton={<TableSkeleton columns={2} rows={3} />}
        empty={friends.length === 0}
        emptyTitle="No friends yet"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Friend</TableHead>
              <TableHead>Standing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {friends.map((friend) => (
              <TableRow key={friend.id}>
                <PersonCell
                  userId={friend.id}
                  name={friend.displayName}
                  profilePicture={friend.profilePicture}
                  firstColumn
                />
                <TableCell>{friendStanding(friend)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ContentState>
    </Panel>
  );
}

/** Who the member is, as they describe themselves, and who they know. */
export function MemberProfileTab({ user }: { user: UserAdminDetailDto }) {
  return (
    <>
      <MemberAboutPanel user={user} />
      <MemberFriendsPanel userId={user.id} />
    </>
  );
}
