import { NotFoundException } from "@nestjs/common";
import { assertLive } from "src/datasources/soft-delete";
import { Tag } from "src/user/entities/tag.entity";
import type { EntityManager } from "typeorm";
import { ActionSuite } from "./entities/action-suite.entity";
import type { GeneralUpdate } from "./entities/general-update.entity";

export function lockLiveTagsAndSuites(
  em: EntityManager,
  generalUpdate: GeneralUpdate,
): Promise<void> {
  return assertLive(em, {
    rows: [
      ...(generalUpdate.tags ?? []).map(({ id }) => ({ target: Tag, id })),
      ...(generalUpdate.suites ?? []).map(({ id }) => ({
        target: ActionSuite,
        id,
      })),
    ],
    gone: () => new NotFoundException("That tag or suite is gone"),
  });
}
