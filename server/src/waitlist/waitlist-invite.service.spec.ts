import { WaitlistInvitePlacement } from "./dto/waitlist-entry-admin.dto";
import { invitePlacement } from "./waitlist-invite.service";

describe("invitePlacement", () => {
  it.each([
    [null, null, WaitlistInvitePlacement.NoOrganization],
    [5, null, WaitlistInvitePlacement.NoGroup],
    [5, 1, WaitlistInvitePlacement.FullGroup],
    [5, 2, WaitlistInvitePlacement.Group],
  ])(
    "places organization %p in community %p as %p",
    (organizationId, communityId, placement) => {
      expect(
        invitePlacement({ organizationId, communityId }, new Set([1])),
      ).toBe(placement);
    },
  );
});
