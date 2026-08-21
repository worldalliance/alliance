import {
  byLikeOrder,
  LIKE_FACEPILE_LIMIT,
  LIKE_ORDER_RANK_FN,
} from "@alliance/common/likeOrder";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import { EntityTarget, In, Repository } from "typeorm";

type Likeable = { id: number; likes?: User[] };

@Injectable()
export class FacepileService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Loads facepiles in the same capped order as the likers modal's first page.
   * Results are display-only and cannot answer membership questions.
   */
  async loadFacepiles<T extends Likeable>(
    target: EntityTarget<T>,
    ids: number[],
  ): Promise<(id: number) => User[]> {
    if (ids.length === 0) return () => [];

    const likerIdsByRow = await this.findFacepileLikerIds(target, ids);
    const users = await this.hydrateLikers([
      ...new Set([...likerIdsByRow.values()].flat()),
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));

    const facepiles = new Map<number, User[]>();
    for (const [id, likerIds] of likerIdsByRow) {
      facepiles.set(
        id,
        likerIds
          .map((likerId) => usersById.get(likerId))
          .filter((user): user is User => user !== undefined)
          .sort(byLikeOrder(id)),
      );
    }
    return (id) => facepiles.get(id) ?? [];
  }

  /** Hydrates ids with the relations `ProfileDto` needs, preserving order. */
  async hydrateLikers(orderedIds: number[]): Promise<User[]> {
    if (orderedIds.length === 0) return [];

    const users = await this.userRepository.find({
      where: { id: In(orderedIds) },
      relations: { cluster: true, contractEvents: true },
    });
    const byId = new Map(users.map((user) => [user.id, user]));
    return orderedIds
      .map((id) => byId.get(id))
      .filter((user): user is User => user !== undefined);
  }

  private async findFacepileLikerIds<T extends Likeable>(
    target: EntityTarget<T>,
    ids: number[],
  ): Promise<Map<number, number[]>> {
    // Quote derived-table columns; TypeORM leaves raw subquery aliases unquoted.
    const pairs = await this.userRepository.manager
      .createQueryBuilder()
      .select('"ranked"."targetId"', "targetId")
      .addSelect('"ranked"."likerId"', "likerId")
      .from(
        (qb) =>
          qb
            .select("target.id", "targetId")
            .addSelect("liker.id", "likerId")
            .addSelect(
              `ROW_NUMBER() OVER (PARTITION BY target.id ORDER BY ${LIKE_ORDER_RANK_FN}(target.id::text || ':' || liker.id::text), liker.id)`,
              "rn",
            )
            .from(target, "target")
            .innerJoin("target.likes", "liker")
            .where("target.id IN (:...ids)", { ids }),
        "ranked",
      )
      .where('"ranked"."rn" <= :limit', { limit: LIKE_FACEPILE_LIMIT })
      .getRawMany<{ targetId: number; likerId: number }>();

    const likerIdsByTarget = new Map<number, number[]>();
    for (const pair of pairs) {
      const targetId = Number(pair.targetId);
      const likerId = Number(pair.likerId);
      const existing = likerIdsByTarget.get(targetId);
      if (existing) existing.push(likerId);
      else likerIdsByTarget.set(targetId, [likerId]);
    }
    return likerIdsByTarget;
  }
}
