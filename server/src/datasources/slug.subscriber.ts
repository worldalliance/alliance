import { slugCandidates, slugFromName } from "src/utils/slug";
import {
  EventSubscriber,
  type EntityManager,
  type EntityMetadata,
  type EntitySubscriberInterface,
  type InsertEvent,
  type ObjectLiteral,
} from "typeorm";
import { SLUGGED_ENTITIES } from "./slug-column";

async function firstFreeSlug(params: {
  manager: EntityManager;
  metadata: EntityMetadata;
  base: string;
}): Promise<string> {
  for (const candidate of slugCandidates(params.base)) {
    const taken = await params.manager
      .createQueryBuilder(params.metadata.target, "t")
      .where("t.slug = :candidate", { candidate })
      .getExists();
    if (!taken) return candidate;
  }
  throw new Error("unreachable: slugCandidates is infinite");
}

function slugColumnOf(metadata: EntityMetadata) {
  if (!SLUGGED_ENTITIES.has(metadata.target)) return null;
  const column = metadata.findColumnWithPropertyName("slug");
  if (!column) throw new Error(`${metadata.name} has no slug column`);
  return column;
}

@EventSubscriber()
export class SlugSubscriber implements EntitySubscriberInterface {
  // A name that yields no slug falls back to `<table>-<id>`, which can only be
  // written once the insert has assigned the id.
  private readonly awaitingId = new WeakSet<ObjectLiteral>();

  async beforeInsert(event: InsertEvent<ObjectLiteral>): Promise<void> {
    const { metadata, manager, entity } = event;
    const slugColumn = slugColumnOf(metadata);
    if (!slugColumn || slugColumn.getEntityValue(entity) != null) return;

    // Held until the insert commits, so a concurrent insert of the same name
    // sees this row's slug as taken instead of picking it too.
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `slug:${metadata.tablePath}`,
    ]);
    const name: unknown = entity.name;
    const base = typeof name === "string" ? slugFromName(name) : null;
    if (base === null) {
      this.awaitingId.add(entity);
      slugColumn.setEntityValue(entity, `pending-${crypto.randomUUID()}`);
      return;
    }
    slugColumn.setEntityValue(
      entity,
      await firstFreeSlug({ manager, metadata, base }),
    );
  }

  async afterInsert(event: InsertEvent<ObjectLiteral>): Promise<void> {
    const { metadata, manager, entity } = event;
    if (!this.awaitingId.delete(entity)) return;
    const slugColumn = slugColumnOf(metadata);
    if (!slugColumn) return;

    const id: unknown = metadata.primaryColumns[0].getEntityValue(entity);
    const slug = await firstFreeSlug({
      manager,
      metadata,
      base: `${metadata.tableName}-${String(id)}`,
    });
    await manager
      .createQueryBuilder()
      .update(metadata.target)
      .set({ slug })
      .whereEntity(entity)
      .execute();
    slugColumn.setEntityValue(entity, slug);
  }
}
