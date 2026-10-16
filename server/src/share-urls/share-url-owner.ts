import type { FindOptionsWhere } from "typeorm";
import type { ShareUrl } from "./entities/share-url.entity";

export type ShareUrlOwner =
  | { type: "user"; userId: number }
  | { type: "campaign"; campaignId: number };

export function ownerWhere(owner: ShareUrlOwner): FindOptionsWhere<ShareUrl> {
  switch (owner.type) {
    case "user":
      return { user: { id: owner.userId } };
    case "campaign":
      return { campaign: { id: owner.campaignId } };
    default:
      throw new Error(`unknown share url owner: ${owner satisfies never}`);
  }
}

export function ownerColumns(owner: ShareUrlOwner): {
  userId: number | null;
  campaignId: number | null;
} {
  switch (owner.type) {
    case "user":
      return { userId: owner.userId, campaignId: null };
    case "campaign":
      return { userId: null, campaignId: owner.campaignId };
    default:
      throw new Error(`unknown share url owner: ${owner satisfies never}`);
  }
}
