import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { isUniqueViolation } from "src/utils/db-errors";
import type { Repository } from "src/utils/Repository";
import { In } from "typeorm";
import type { WaitlistEntryFilterDto } from "./dto/waitlist-entry-admin.dto";
import type { AdminWaitlistTag } from "./dto/waitlist-tag.dto";
import { WaitlistCohort } from "./entities/waitlist-cohort.entity";
import { WaitlistEntryTag } from "./entities/waitlist-entry-tag.entity";
import { WaitlistTag } from "./entities/waitlist-tag.entity";

const TAG_NOT_FOUND = "Waitlist tag not found";

@Injectable()
export class WaitlistTagService {
  constructor(
    @InjectRepository(WaitlistTag)
    private readonly tagRepository: Repository<WaitlistTag>,
    @InjectRepository(WaitlistEntryTag)
    private readonly entryTagRepository: Repository<WaitlistEntryTag>,
  ) {}

  async findAll(): Promise<AdminWaitlistTag[]> {
    const tags = await this.tagRepository.find({ order: { name: "ASC" } });
    const counts = await this.entryTagRepository
      .createQueryBuilder("entryTag")
      .select("entryTag.tagId", "tagId")
      .addSelect("COUNT(*)", "count")
      .groupBy("entryTag.tagId")
      .getRawMany<{ tagId: number; count: string }>();

    const countByTag = new Map(
      counts.map((row) => [row.tagId, Number(row.count)]),
    );
    return tags.map((tag) => ({
      tag,
      entryCount: countByTag.get(tag.id) ?? 0,
    }));
  }

  async findForEntries(
    entryIds: number[],
  ): Promise<Map<number, WaitlistTag[]>> {
    const rows = entryIds.length
      ? await this.entryTagRepository.find({
          where: { entryId: In(entryIds) },
          relations: { tag: true },
          order: { tag: { name: "ASC" } },
        })
      : [];

    const tagsByEntry = new Map<number, WaitlistTag[]>();
    for (const row of rows) {
      if (!row.tag) throw new Error(`waitlist tag ${row.tagId} not loaded`);
      const tags = tagsByEntry.get(row.entryId) ?? [];
      tags.push(row.tag);
      tagsByEntry.set(row.entryId, tags);
    }
    return tagsByEntry;
  }

  private async findOne(id: number): Promise<WaitlistTag> {
    const tag = await this.tagRepository.findOneBy({ id });
    if (!tag) {
      throw new NotFoundException(TAG_NOT_FOUND);
    }
    return tag;
  }

  private async saveNamed(tag: WaitlistTag): Promise<WaitlistTag> {
    try {
      return await this.tagRepository.save(tag);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException("A tag with that name already exists");
      }
      throw err;
    }
  }

  create(name: string): Promise<WaitlistTag> {
    return this.saveNamed(this.tagRepository.create({ name }));
  }

  async rename(id: number, name: string): Promise<WaitlistTag> {
    const tag = await this.findOne(id);
    tag.name = name;
    return this.saveNamed(tag);
  }

  /**
   * Refuses while a cohort filters by the tag, which would silently change what
   * it matches. Locking the tag keeps a cohort from saving with it meanwhile.
   */
  async delete(id: number): Promise<void> {
    await this.tagRepository.manager.transaction(async (manager) => {
      const tag = await manager.findOne(WaitlistTag, {
        where: { id },
        lock: { mode: "pessimistic_write" },
      });
      if (!tag) throw new NotFoundException(TAG_NOT_FOUND);
      const cohorts = await manager
        .createQueryBuilder(WaitlistCohort, "cohort")
        .where("cohort.filter -> :key @> to_jsonb(:id::int)", {
          key: "tagIds" satisfies keyof WaitlistEntryFilterDto,
          id,
        })
        .orderBy("cohort.name")
        .getMany();
      if (cohorts.length) {
        throw new ConflictException(
          `Cohorts filter by this tag: ${cohorts.map((c) => c.name).join(", ")}`,
        );
      }
      await manager.remove(tag);
    });
  }

  /** Resolves to how many of the entries were newly tagged. */
  async add(id: number, entryIds: number[]): Promise<number> {
    await this.findOne(id);
    if (!entryIds.length) return 0;
    const result = await this.entryTagRepository.query(
      `INSERT INTO waitlist_entry_tag ("entryId", "tagId")
       SELECT id, $1 FROM waitlist_entry WHERE id = ANY($2)
       ON CONFLICT DO NOTHING
       RETURNING "entryId"`,
      [id, entryIds],
    );
    return result.length;
  }

  async remove(id: number, entryIds: number[]): Promise<number> {
    await this.findOne(id);
    if (!entryIds.length) return 0;
    const result = await this.entryTagRepository
      .createQueryBuilder()
      .delete()
      .where('"tagId" = :id AND "entryId" = ANY(:entryIds)', { id, entryIds })
      .execute();
    return result.affected ?? 0;
  }
}
