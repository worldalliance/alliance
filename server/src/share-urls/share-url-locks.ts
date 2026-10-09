import { NotFoundException } from "@nestjs/common";
import { Campaign } from "src/campaign/entities/campaign.entity";
import { lockLive, updateLive } from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import {
  type EntityManager,
  type FindOptionsRelations,
  type QueryDeepPartialEntity,
} from "typeorm";
import { ShareUrl } from "./entities/share-url.entity";
import type { ShareUrlOwner } from "./share-urls.service";

/** Whether the owner is live; holds it so a deletion cannot land mid-insert. */
export function lockOwner(
  manager: EntityManager,
  owner: ShareUrlOwner,
): Promise<boolean> {
  switch (owner.type) {
    case "user":
      return lockLive(manager, [{ target: User, id: owner.userId }]);
    case "campaign":
      return lockLive(manager, [{ target: Campaign, id: owner.campaignId }]);
    default:
      throw new Error(`unknown share url owner: ${owner satisfies never}`);
  }
}

export async function updateLiveShareUrl(
  manager: EntityManager,
  params: {
    id: string;
    changes: QueryDeepPartialEntity<ShareUrl>;
    relations?: FindOptionsRelations<ShareUrl>;
  },
): Promise<ShareUrl> {
  const { id, changes, relations } = params;
  const updated =
    Object.keys(changes).length === 0 ||
    (await updateLive(manager, { target: ShareUrl, id, changes }));
  const row = updated
    ? await manager.findOne(ShareUrl, { where: { id }, relations })
    : null;
  if (!row) throw new NotFoundException("share url not found");
  return row;
}
