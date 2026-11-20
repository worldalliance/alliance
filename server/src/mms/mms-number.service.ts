import type { EntityManager } from "typeorm";
import { MmsThread } from "./mms-thread.entity";

export async function setNumberOptedOut(
  manager: EntityManager,
  params: { phoneNumber: string; optedOut: boolean },
): Promise<void> {
  await manager
    .createQueryBuilder()
    .insert()
    .into(MmsThread)
    .values(params)
    .orUpdate(["optedOut"], ["phoneNumber"])
    .execute();
}
