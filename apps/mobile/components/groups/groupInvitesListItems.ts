import type {
  CommunityInviteDto,
  OnetimeInviteDto,
} from "@alliance/shared/client/types.gen";
import { inviteBuckets } from "@alliance/shared/lib/copy";
import {
  bucketCommunityInvitesByActionability,
  bucketOnetimeInvitesByActionability,
} from "@alliance/shared/lib/inviteUtils";

export type OnetimeInviteBucket = Exclude<
  keyof ReturnType<typeof bucketOnetimeInvitesByActionability>,
  "settled"
>;

export type GroupInvitesListItem =
  | { type: "section"; id: string; label: string }
  | { type: "communityInvite"; invite: CommunityInviteDto }
  | {
      type: "onetimeInvite";
      invite: OnetimeInviteDto;
      bucket: OnetimeInviteBucket;
    };

/** The group's outstanding invites, under a header per bucket that has any. */
export function groupInvitesListItems(params: {
  onetimeInvites: OnetimeInviteDto[];
  communityInvites: CommunityInviteDto[];
  communityId: number;
  userId: number | undefined;
}): GroupInvitesListItem[] {
  const onetime = bucketOnetimeInvitesByActionability({
    invites: params.onetimeInvites,
    leaderCommunityIds: new Set([params.communityId]),
    userId: params.userId,
  });
  const community = bucketCommunityInvitesByActionability({
    invites: params.communityInvites,
    userId: params.userId,
  });
  const sections = [
    {
      bucket: "actionable",
      onetime: onetime.actionable,
      community: community.actionable,
    },
    {
      bucket: "unverifiableActionable",
      onetime: onetime.unverifiableActionable,
      community: [],
    },
    {
      bucket: "waitingForResponse",
      onetime: onetime.waitingForResponse,
      community: community.waitingForResponse,
    },
  ] as const;
  return sections.flatMap(
    ({ bucket, onetime, community }): GroupInvitesListItem[] =>
      onetime.length + community.length === 0
        ? []
        : [
            { type: "section", id: bucket, label: inviteBuckets[bucket].title },
            ...onetime.map(
              (invite): GroupInvitesListItem => ({
                type: "onetimeInvite",
                invite,
                bucket,
              }),
            ),
            ...community.map(
              (invite): GroupInvitesListItem => ({
                type: "communityInvite",
                invite,
              }),
            ),
          ],
  );
}
