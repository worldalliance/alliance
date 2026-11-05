import { NotFoundException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { Action } from "./entities/action.entity";

export async function lockActionRow(
  em: EntityManager,
  actionId: number,
): Promise<void> {
  const action = await em
    .getRepository(Action)
    .createQueryBuilder("a")
    .setLock("pessimistic_write")
    .where("a.id = :id", { id: actionId })
    .getOne();
  if (!action) {
    throw new NotFoundException("Action not found");
  }
}
