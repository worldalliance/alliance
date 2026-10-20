import { inviteBuckets } from "@alliance/shared/lib/copy";
import {
  makeCommunity,
  makeCommunityInvite,
  makeOnetimeInvite,
  makeProfile,
} from "@alliance/shared/lib/testFixtures";
import { describe, expect, it } from "bun:test";
import { groupInvitesListItems } from "./groupInvitesListItems";

const leader = makeProfile(1);
const member = makeProfile(2);

describe("groupInvitesListItems", () => {
  it("lists a member's request to invite someone under needs approval", () => {
    const request = makeCommunityInvite({
      status: "request_pending",
      invitingUser: member,
    });
    expect(
      groupInvitesListItems({
        onetimeInvites: [],
        communityInvites: [request],
        communityId: 1,
        userId: leader.id,
      }),
    ).toEqual([
      {
        type: "section",
        id: "actionable",
        label: inviteBuckets.actionable.title,
      },
      { type: "communityInvite", invite: request },
    ]);
  });

  it("orders the buckets and leaves out settled invites", () => {
    const request = makeOnetimeInvite({
      id: 1,
      status: "request_pending",
      community: makeCommunity({ id: 1 }),
      invitingUser: member,
    });
    const myLink = makeOnetimeInvite({ id: 2, invitingUser: leader });
    const invited = makeCommunityInvite({ id: 3, status: "invitee_pending" });
    const accepted = makeCommunityInvite({ id: 4, status: "invitee_accepted" });
    const used = makeOnetimeInvite({ id: 5, status: "link_used" });
    expect(
      groupInvitesListItems({
        onetimeInvites: [request, myLink, used],
        communityInvites: [invited, accepted],
        communityId: 1,
        userId: leader.id,
      }).map((item) =>
        item.type === "section" ? item.id : `${item.type}-${item.invite.id}`,
      ),
    ).toEqual([
      "actionable",
      "onetimeInvite-1",
      "unverifiableActionable",
      "onetimeInvite-2",
      "waitingForResponse",
      "communityInvite-3",
    ]);
  });
});
