import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { lockLiveIds } from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import { isUniqueViolation } from "src/utils/db-errors";
import { DataSource, In, type EntityManager } from "typeorm";
import type { MemberListDtoArgs } from "./dto/member-list.dto";
import { MemberListMember } from "./entities/member-list-member.entity";
import { MemberListVersion } from "./entities/member-list-version.entity";
import { LIST_NAME_INDEX, MemberList } from "./entities/member-list.entity";
import { LIST_CHANGED, currentLists } from "./member-list-store";

export type MemberListSave = { name: string; userIds: number[] };

/**
 * Deleting a list goes through the formula save, which refuses it while a
 * formula reads the list.
 */
@Injectable()
export class MemberListsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(id?: string): Promise<MemberListDtoArgs[]> {
    const manager = this.dataSource.manager;
    const lists = await currentLists(manager, id);
    const members = await manager.find(MemberListMember, {
      where: { versionId: In(lists.map((list) => list.versionId)) },
      order: { userId: "ASC" },
    });
    return lists.map((list) => ({
      ...list,
      userIds: members
        .filter((member) => member.versionId === list.versionId)
        .map((member) => member.userId),
    }));
  }

  async get(id: string): Promise<MemberListDtoArgs> {
    const [list] = await this.list(id);
    if (list === undefined) throw new NotFoundException();
    return list;
  }

  async create(
    params: MemberListSave & { savedById: number },
  ): Promise<MemberListDtoArgs> {
    const id = await this.write(async (manager) => {
      const { id } = await manager.save(MemberList, { name: params.name });
      await addVersion({ manager, listId: id, ...params });
      return id;
    });
    return this.get(id);
  }

  /**
   * Renames the list and, when its members changed, adds a version. Throws
   * `ConflictException` when its members changed since `baseVersionId` or
   * its name since `baseName`.
   */
  async update(
    params: MemberListSave & {
      id: string;
      baseVersionId: number;
      baseName: string;
      savedById: number;
    },
  ): Promise<MemberListDtoArgs> {
    await this.write(async (manager) => {
      // Saves of one list, and its deletion, take turns.
      const list = await manager.findOne(MemberList, {
        where: { id: params.id },
        lock: { mode: "pessimistic_write" },
      });
      if (list === null) throw new NotFoundException();
      const latest = await manager.findOneOrFail(MemberListVersion, {
        where: { listId: params.id },
        order: { id: "DESC" },
      });
      if (latest.id !== params.baseVersionId || list.name !== params.baseName) {
        throw new ConflictException(LIST_CHANGED);
      }
      await manager.update(
        MemberList,
        { id: params.id },
        { name: params.name },
      );
      const before = await manager.find(MemberListMember, {
        where: { versionId: latest.id },
      });
      const wanted = new Set(params.userIds);
      const same =
        before.length === wanted.size &&
        before.every((member) => wanted.has(member.userId));
      if (!same) await addVersion({ manager, listId: params.id, ...params });
    });
    return this.get(params.id);
  }

  private async write<T>(
    run: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(run).catch((error: unknown) => {
      if (isUniqueViolation(error, LIST_NAME_INDEX)) {
        throw new BadRequestException(
          "Another list has this name. Pick another name.",
        );
      }
      throw error;
    });
  }
}

async function addVersion({
  manager,
  listId,
  userIds,
  savedById,
}: {
  manager: EntityManager;
  listId: string;
  userIds: number[];
  savedById: number;
}): Promise<void> {
  const found = await lockLiveIds(manager, { target: User, ids: userIds });
  const missing = userIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new BadRequestException(
      `No member has ${missing.length === 1 ? "this id" : "these ids"}: ${missing.join(", ")}.`,
    );
  }
  const { id: versionId } = await manager.save(MemberListVersion, {
    listId,
    savedById,
  });
  if (userIds.length > 0) {
    await manager.insert(
      MemberListMember,
      userIds.map((userId) => ({ versionId, userId })),
    );
  }
}
