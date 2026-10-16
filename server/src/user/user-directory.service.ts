import { hasProfilePicture } from "@alliance/common/profilePicture";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { countBy } from "es-toolkit";
import { updateLive } from "src/datasources/soft-delete";
import { City } from "src/geo/city.entity";
import type { Repository as TypedRepository } from "src/utils/Repository";
import { DataSource, In, Not, type Repository } from "typeorm";
import { UserCityCount } from "./dto/user.dto";
import { Friend } from "./entities/friend.entity";
import { loadedUserCommunities, User } from "./entities/user.entity";
import { acceptedFriendshipsOf, friendOf } from "./friendship";
import { UserService } from "./user.service";

@Injectable()
export class UserDirectoryService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(City)
    private readonly cityRepository: TypedRepository<City>,
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    private readonly userService: UserService,
  ) {}

  async findAllMembersPublic(): Promise<User[]> {
    const users = await this.userRepository.find({
      where: { shareInfoPublicly: true, staff: false },
      relations: {
        contractEvents: true,
      },
    });
    return users.filter(
      (user) => user.hasActiveContract && hasProfilePicture(user),
    );
  }

  async findStaffDirectory(): Promise<User[]> {
    return this.userRepository.find({
      where: { staff: true },
      order: { staffDisplayOrder: "ASC", id: "ASC" },
    });
  }

  async updateStaffDirectory(
    items: {
      id: number;
      staffTitle?: string | null;
      staffLink?: string | null;
      staffDisplayOrder: number;
    }[],
  ): Promise<User[]> {
    await Promise.all(
      items.map((item) =>
        updateLive(this.dataSource.manager, {
          target: User,
          id: item.id,
          changes: {
            staffDisplayOrder: item.staffDisplayOrder,
            ...(item.staffTitle !== undefined
              ? { staffTitle: item.staffTitle }
              : {}),
            ...(item.staffLink !== undefined
              ? { staffLink: item.staffLink }
              : {}),
          },
        }),
      ),
    );
    return this.findStaffDirectory();
  }

  async findMessageableUsers(userId: number): Promise<User[]> {
    const user = await this.userService.findOneOrFail(userId, {
      communities: true,
    });

    if (user.staff) {
      return this.userRepository.find({
        where: { id: Not(userId) },
      });
    }

    const memberCommunityIds = loadedUserCommunities(user).map((c) => c.id);
    const leaderCommunityIds = user.leaderOfIds;

    const [rels, staff, communityUsers] = await Promise.all([
      this.friendRepository.find({
        where: acceptedFriendshipsOf(userId),
        relations: { requester: true, addressee: true },
      }),

      this.userRepository.find({ where: { staff: true } }),

      this.userRepository
        .createQueryBuilder("u")
        .distinct(true)
        .leftJoin("u.leaderOf", "leadCommunity")
        .leftJoin("u.communities", "memberCommunity")
        .where(
          `
            (
              leadCommunity.id IN (:...memberCommunityIds)
              OR memberCommunity.id IN (:...leaderCommunityIds)
            )
          `,
          {
            memberCommunityIds: memberCommunityIds.length
              ? memberCommunityIds
              : [-1],
            leaderCommunityIds: leaderCommunityIds.length
              ? leaderCommunityIds
              : [-1],
          },
        )
        .getMany(),
    ]);

    const friends = rels.map((r) => friendOf(r, userId));

    const byId = new Map<number, User>();
    for (const u of [...staff, ...communityUsers, ...friends]) {
      if (u?.id && u.id !== userId) byId.set(u.id, u);
    }

    return [...byId.values()];
  }

  async getUserCityCounts(): Promise<UserCityCount[]> {
    const allUsers = await this.userRepository.find({
      relations: { contractEvents: true, city: true },
    });
    const users = allUsers.filter((user) => user.hasActiveContract);

    const cityIds = users
      .map((user) => user.city?.id)
      .filter((id) => id != null);
    const nullCityCount = users.length - cityIds.length;
    const cityCounts = countBy(cityIds, (id) => id);

    const cities = await this.cityRepository.find({
      where: { id: In(Object.keys(cityCounts)) },
    });
    const cityById = new Map(cities.map((c) => [c.id, c]));

    const cityCountsArray = Object.entries(cityCounts).map(
      ([cityId, count]) => {
        const city = cityById.get(parseInt(cityId, 10));
        return {
          cityId: city?.id ?? null,
          cityName: city?.name ?? null,
          countryCode: city?.countryCode ?? null,
          count,
          latitude: city?.latitude ?? null,
          longitude: city?.longitude ?? null,
        } satisfies UserCityCount;
      },
    );

    return [
      ...cityCountsArray,
      {
        cityId: null,
        cityName: "Unknown",
        countryCode: null,
        count: nullCityCount,
        latitude: null,
        longitude: null,
      },
    ];
  }
}
