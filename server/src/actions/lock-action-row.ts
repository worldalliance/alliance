import { NotFoundException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { Action } from "./entities/action.entity";

// FOR NO KEY UPDATE, not FOR UPDATE: callers often already hold the row's key
// share lock (writeUnderLive, foreign keys), and upgrading that to FOR UPDATE
// deadlocks two concurrent callers. This mode serializes callers just the same.
export async function lockActionRow(
  em: EntityManager,
  actionId: number,
): Promise<void> {
  const action = await em
    .getRepository(Action)
    .createQueryBuilder("a")
    .setLock("for_no_key_update")
    .where("a.id = :id", { id: actionId })
    .getOne();
  if (!action) {
    throw new NotFoundException("Action not found");
  }
}
