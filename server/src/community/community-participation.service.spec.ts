import { ImagesService } from "src/images/images.service";
import { User } from "src/user/entities/user.entity";
import { CommunityParticipationService } from "./community-participation.service";
import {
  buildCommunity,
  leader1,
  leader2,
  mockCommunityServices,
  type CommunityServiceMocks,
} from "./community-services.fixtures";
import { CommunityService } from "./community.service";
import { memberLeftCommunityNotif } from "./community.utils";

describe("CommunityParticipationService", () => {
  let fx: CommunityServiceMocks;
  let participation: CommunityParticipationService;

  beforeEach(() => {
    fx = mockCommunityServices();
    participation = new CommunityParticipationService(
      fx.communityRepository,
      fx.userRepository,
      new CommunityService(
        fx.communityRepository,
        fx.userRepository,
        fx.communityConversationService,
        {} as ImagesService,
      ),
      fx.membership,
      fx.notifsService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("leaveCommunity", () => {
    it("tells the group's leaders the member left", async () => {
      const user = { id: 99, name: "Departing Member" } as User;
      const community = buildCommunity({ users: [leader1, leader2, user] });
      fx.communityRepository.findOneOrFail.mockResolvedValue(community);

      await participation.leaveCommunity(community.id, user.id);

      expect(fx.notifsService.sendNotifs).toHaveBeenCalledWith(
        [leader1, leader2].map((leader) =>
          memberLeftCommunityNotif({ leader, leaver: user, community }),
        ),
      );
    });
  });

  describe("joinPublicCommunity", () => {
    it("leaves the joiner's other groups through leaveOtherCommunitiesOnJoin", async () => {
      const user = {
        id: 99,
        name: "Public Joiner",
        communities: [buildCommunity({ id: 3 })],
      } as User;
      fx.communityRepository.findOneOrFail.mockResolvedValue(
        buildCommunity({ public: true, maxCapacity: 10, users: [leader1] }),
      );
      fx.userRepository.findOneOrFail.mockResolvedValue(user);
      const leave = jest
        .spyOn(fx.membership, "leaveOtherCommunitiesOnJoin")
        .mockResolvedValue();

      await participation.joinPublicCommunity(user.id, 1);

      expect(leave).toHaveBeenCalledWith(user);
    });
  });
});
