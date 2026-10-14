import { Campaign } from "src/campaign/entities/campaign.entity";
import { lockLive } from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import type { EntityManager } from "typeorm";
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
