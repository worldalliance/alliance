import type { FormSchema } from "@alliance/common/forms/form-schema";
import {
  memberSchema,
  type SchemaMember,
} from "@alliance/common/forms/row-list";
import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash } from "crypto";
import jsonStableStringify from "json-stable-stringify";
import type { Repository } from "src/utils/Repository";
import { EntityManager, In, SelectQueryBuilder } from "typeorm";
import { type Form, loadedFormSnapshot } from "./entities/form.entity";
import {
  FORM_SNAPSHOT_HISTORY_TABLE,
  FormSnapshot,
  SNAPSHOT_HISTORY_OWNERS,
  SnapshotHistoryOwner,
} from "./entities/formsnapshot.entity";
import { formSchemaOf } from "./form-snapshot-schema";
import {
  servedSchema,
  withImageUrls,
  withServedVideoSources,
} from "./served-schema";

export function hashFormSchema(schema: Record<string, unknown>): string {
  return createHash("sha256")
    .update(jsonStableStringify(schema) ?? "")
    .digest("hex");
}

// SQL identifiers come from the exhaustive owner table, never caller input.
export async function recordHistoricalSnapshot(
  em: EntityManager,
  params: { owner: SnapshotHistoryOwner; ownerId: number; snapshotId: number },
): Promise<void> {
  const { table, ownerColumn, snapshotColumn } =
    SNAPSHOT_HISTORY_OWNERS[params.owner];
  await em.query(
    `INSERT INTO "${table}" ("${ownerColumn}", "${snapshotColumn}")
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [params.ownerId, params.snapshotId],
  );
}

const servedShapes = (served: FormSchema): FormSchema[] => [
  served,
  withImageUrls(served),
];

const servedShapeHashes = (served: FormSchema, member: SchemaMember) =>
  servedShapes(served).map((shape) =>
    hashFormSchema(memberSchema(shape, member)),
  );

@Injectable()
export class FormSnapshotService {
  constructor(
    @InjectRepository(FormSnapshot)
    private readonly snapshotRepository: Repository<FormSnapshot>,
  ) {}

  async findOrCreate(
    schema: Record<string, unknown>,
    em?: EntityManager,
  ): Promise<FormSnapshot> {
    const hash = hashFormSchema(schema);
    const runner = em ?? this.snapshotRepository.manager;
    const rows = await runner.query<{ id: number }[]>(
      `INSERT INTO form_snapshot ("schema", "hash") VALUES ($1::jsonb, $2)
       ON CONFLICT ("hash") DO UPDATE SET "deletedAt" = NULL
       RETURNING id`,
      [JSON.stringify(schema), hash],
    );
    if (rows.length === 0) {
      throw new Error("FormSnapshot.findOrCreate: upsert returned no rows");
    }
    return runner.findOneByOrFail(FormSnapshot, { id: rows[0].id });
  }

  async recordHistorical(params: {
    owner: SnapshotHistoryOwner;
    ownerId: number;
    snapshotId: number;
    em?: EntityManager;
  }): Promise<void> {
    await recordHistoricalSnapshot(
      params.em ?? this.snapshotRepository.manager,
      params,
    );
  }

  async findHistoricalOrThrow(
    formId: number,
    formSnapshotId: number,
  ): Promise<FormSnapshot> {
    const snapshot = await this.historyOf(formId)
      .andWhere("s.id = :formSnapshotId", { formSnapshotId })
      .getOne();
    if (!snapshot) {
      throw new BadRequestException(
        "Submitted form snapshot was never associated with this form",
      );
    }
    return snapshot;
  }

  // BACKCOMPAT(form-snapshot): pre-cutover mobile clients post
  // `schemaSnapshot` (the full schema) instead of `formSnapshotId`. Resolve
  // it to a historical snapshot for this form by hash — never accept the
  // bytes as authoritative, since the resolved schema feeds validation,
  // contract-signing extraction, and auto-extract. Once the minimum mobile
  // version is past the cutover, delete the schemaSnapshot branch.
  async resolveSubmissionSnapshot({
    form,
    dto,
    member,
  }: {
    /** As TasksService.getForm serves it: contracts filled in, which the history fallback does not rebuild. */
    form: Form;
    dto: { formSnapshotId?: number; schemaSnapshot?: Record<string, unknown> };
    /** Who was served the schema filled from their row and narrowed to their content. */
    member: SchemaMember;
  }) {
    if (dto.formSnapshotId !== undefined) {
      return dto.formSnapshotId === form.formSnapshotId
        ? loadedFormSnapshot(form)
        : this.findHistoricalOrThrow(form.id, dto.formSnapshotId);
    }
    if (!dto.schemaSnapshot) {
      throw new BadRequestException(
        "Form submission missing both formSnapshotId and schemaSnapshot",
      );
    }
    const echoed = withServedVideoSources(dto.schemaSnapshot);
    const served = loadedFormSnapshot(form);
    const schema = formSchemaOf(served);
    const echoedHash = hashFormSchema(echoed);
    if (
      servedShapes(schema).map(hashFormSchema).includes(echoedHash) ||
      servedShapeHashes(schema, member).includes(echoedHash)
    ) {
      return served;
    }
    return this.findHistoricalBySchemaOrThrow({
      formId: form.id,
      schema: echoed,
      member,
    });
  }

  // Snapshot rows never change, so a snapshot's served hashes are computed once.
  private readonly servedHashes = new Map<number, string[]>();
  // Snapshots whose served schema memberSchema changes, by row or per-member
  // content; a miss reloads only these to hash them as served to the member.
  private readonly memberDependent = new Set<number>();

  /** A legacy client echoes the schema getForm served, media rewrites
   * included, instead of the stored one. The rewrites are today's, plus page
   * images rendered as urls (`withImageUrls`), so a client that fetched a form
   * before another rewrite changed gets a 400.
   * BACKCOMPAT(form-snapshot): a miss hashes the form's uncached history
   * versions and reloads its member-dependent ones, a cost that goes with the
   * schemaSnapshot branch. */
  async findHistoricalBySchemaOrThrow(params: {
    formId: number;
    schema: Record<string, unknown>;
    member: SchemaMember;
  }): Promise<FormSnapshot> {
    const { formId, schema, member } = params;
    const hash = hashFormSchema(schema);
    const snapshot =
      (await this.historyOf(formId)
        .andWhere("s.hash = :hash", { hash })
        .getOne()) ??
      (await this.findByServedHash({
        candidates: this.historyOf(formId),
        hash,
        member,
      }));
    if (!snapshot) {
      throw new BadRequestException(
        "Submitted schema does not match any historical snapshot for this form",
      );
    }
    return snapshot;
  }

  private historyOf(formId: number): SelectQueryBuilder<FormSnapshot> {
    return this.snapshotRepository
      .createQueryBuilder("s")
      .innerJoin(
        FORM_SNAPSHOT_HISTORY_TABLE,
        "fhs",
        'fhs."formSnapshotId" = s.id',
      )
      .where('fhs."formId" = :formId', { formId });
  }

  private async findByServedHash(params: {
    candidates: SelectQueryBuilder<FormSnapshot>;
    hash: string;
    member: SchemaMember;
  }): Promise<FormSnapshot | null> {
    const { candidates, hash, member } = params;
    const ids = (
      await candidates.select("s.id", "id").getRawMany<{ id: number }>()
    ).map((row) => row.id);
    const uncached = ids.filter((id) => !this.servedHashes.has(id));
    const loaded = new Map<number, FormSnapshot>();
    if (uncached.length > 0) {
      for (const snapshot of await this.snapshotRepository.findBy({
        id: In(uncached),
      })) {
        loaded.set(snapshot.id, snapshot);
        const served = servedSchema(snapshot);
        const hashed = servedShapes(served).map(hashFormSchema);
        this.servedHashes.set(snapshot.id, hashed);
        const unassigned = servedShapeHashes(served, {
          assignedRow: null,
          userId: null,
        });
        if (
          unassigned.some((unassignedHash, i) => unassignedHash !== hashed[i])
        ) {
          this.memberDependent.add(snapshot.id);
        }
      }
    }
    const match = ids.find((id) => this.servedHashes.get(id)?.includes(hash));
    if (match !== undefined) {
      return this.snapshotRepository.findOneByOrFail({ id: match });
    }
    const dependent = ids.filter((id) => this.memberDependent.has(id));
    if (dependent.length === 0) {
      return null;
    }
    const unloaded = dependent.filter((id) => !loaded.has(id));
    const candidatesForMember = [
      ...dependent.flatMap((id) => loaded.get(id) ?? []),
      ...(unloaded.length > 0
        ? await this.snapshotRepository.findBy({ id: In(unloaded) })
        : []),
    ];
    return (
      candidatesForMember.find((snapshot) =>
        servedShapeHashes(servedSchema(snapshot), member).includes(hash),
      ) ?? null
    );
  }
}
