import { EntityManager } from "typeorm";
import type { SetPriorityDto } from "./dto/action.dto";
import { Action } from "./entities/action.entity";
import { GeneralUpdate } from "./entities/general-update.entity";

export async function shiftPrioritiesAfterInsertion(
  em: EntityManager,
): Promise<void> {
  await em.transaction(async (manager) => {
    await manager
      .createQueryBuilder()
      .update(Action)
      .set({ priority: () => "priority + 1" })
      .where("priority >= :min", { min: 0 })
      .execute();
    await manager
      .createQueryBuilder()
      .update(GeneralUpdate)
      .set({ priority: () => "priority + 1" })
      .where("priority >= :min", { min: 0 })
      .execute();
  });
}

export async function setPriorities(
  em: EntityManager,
  dto: SetPriorityDto,
): Promise<void> {
  await Promise.all([
    ...dto.actionPriorities.map(({ id, priority }) =>
      em.update(Action, id, { priority }),
    ),
    ...dto.generalUpdatePriorities.map(({ id, priority }) =>
      em.update(GeneralUpdate, id, { priority }),
    ),
  ]);
}
