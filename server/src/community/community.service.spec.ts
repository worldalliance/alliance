import { ImagesService } from "src/images/images.service";
import { User } from "src/user/entities/user.entity";
import {
  buildCommunity,
  leader1,
  leader2,
  mockCommunityServices,
  type CommunityServiceMocks,
} from "./community-services.fixtures";
import { CommunityService } from "./community.service";
import { memberLeftCommunityNotif } from "./community.utils";

describe("CommunityService", () => {
  let fx: CommunityServiceMocks;
  let service: CommunityService;

  beforeEach(() => {
    fx = mockCommunityServices();
    service = new CommunityService(
      fx.communityRepository,
      fx.userRepository,
      fx.communityConversationService,
      {} as ImagesService,
      fx.notifsService,
      fx.membership,
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

      await service.leaveCommunity(community.id, user.id);

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

      await service.joinPublicCommunity(user.id, 1);

      expect(leave).toHaveBeenCalledWith(user);
    });
  });
});
