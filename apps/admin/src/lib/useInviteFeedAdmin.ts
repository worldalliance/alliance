import {
  shareUrlsFindInviteFeedAdmin,
  userOnetimeInviteGetOnetimeInvitesAdmin,
} from "@alliance/shared/client";
import type {
  OnetimeInviteDto,
  ReusableInviteFeedItemDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { skipToken, useQuery } from "@tanstack/react-query";
import { milliseconds } from "date-fns";

const INVITES_PER_PAGE = 200;

export enum InviteFeedKind {
  Individual = "individual",
  Group = "group",
}

export type InviteFeedItem = {
  id: string;
  createdAt: string;
  invitingUserDisplayName: string;
  kind: InviteFeedKind;
};

function isCreatedInvite(invite: OnetimeInviteDto): boolean {
  return invite.status === "link_unused" || invite.status === "link_used";
}

async function getOnetimeInvitesSince(
  startAt: string,
): Promise<InviteFeedItem[]> {
  const startTime = new Date(startAt).getTime();
  const invites: OnetimeInviteDto[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await userOnetimeInviteGetOnetimeInvitesAdmin({
      query: { page, limit: INVITES_PER_PAGE },
      throwOnError: true,
    });
    const batch = response.data.items;
    totalPages = response.data.totalPages;
    invites.push(
      ...batch.filter(
        (invite) =>
          isCreatedInvite(invite) &&
          new Date(invite.createdAt).getTime() >= startTime,
      ),
    );

    const oldestInvite = batch.at(-1);
    if (
      !oldestInvite ||
      new Date(oldestInvite.createdAt).getTime() < startTime
    ) {
      break;
    }
    page += 1;
  } while (page <= totalPages);

  return invites.map((invite) => ({
    id: `onetime-${invite.id}`,
    createdAt: invite.createdAt,
    invitingUserDisplayName: invite.invitingUser?.displayName ?? "Someone",
    kind: InviteFeedKind.Individual,
  }));
}

function reusableInviteFeedItem(
  invite: ReusableInviteFeedItemDto,
): InviteFeedItem {
  return {
    id: `reusable-${invite.id}`,
    createdAt: invite.createdAt,
    invitingUserDisplayName: invite.invitingUserDisplayName,
    kind: InviteFeedKind.Group,
  };
}

async function getInvitesSince(startAt: string): Promise<InviteFeedItem[]> {
  const [onetimeInvites, reusableInvitesResponse] = await Promise.all([
    getOnetimeInvitesSince(startAt),
    shareUrlsFindInviteFeedAdmin({
      query: { startAt: new Date(startAt).toISOString() },
      throwOnError: true,
    }),
  ]);
  return [
    ...onetimeInvites,
    ...reusableInvitesResponse.data.items.map(reusableInviteFeedItem),
  ];
}

export function useInviteFeedAdmin(startAt: string | null) {
  return useQuery({
    queryKey: queryKeys.inviteFeedAdmin(startAt),
    queryFn: startAt === null ? skipToken : () => getInvitesSince(startAt),
    refetchInterval: milliseconds({ seconds: 10 }),
  });
}
