import {
  displayOnlySchema,
  displayOnlySchemaError,
  displayOnlyToFormSchema,
  type DisplayOnlySchema,
} from "@alliance/common/forms/display-only-schema";
import { validateFormSchema } from "@alliance/common/forms/form-schema-validate";
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { SnapshotHistoryOwner } from "src/tasks/entities/formsnapshot.entity";
import { FormSnapshotService } from "src/tasks/formsnapshot.service";
import { EntityManager } from "typeorm";
import { SCHEMA_WRITE_TARGETS } from "./schema-write-target";

@Injectable()
export class SchemaWriteService {
  constructor(private readonly formSnapshotService: FormSnapshotService) {}

  private parseDisplayOnlySchemaOrThrow(schema: unknown): DisplayOnlySchema {
    const parsed = displayOnlySchema.safeParse(schema);
    if (!parsed.success) {
      throw new BadRequestException(displayOnlySchemaError(parsed.error));
    }
    // displayOnlySchema accepts empty images blocks; semantic validation rejects
    // them before updates are saved.
    const errors = validateFormSchema(displayOnlyToFormSchema(parsed.data));
    if (errors.length > 0) {
      throw new BadRequestException({
        message: "Invalid form schema",
        errors,
      });
    }
    return parsed.data;
  }

  // The expected snapshot id is required, not optional: an unguarded schema
  // write is exactly the silent overwrite this path exists to reject.
  async writeSchemaOrThrow(params: {
    owner: SnapshotHistoryOwner;
    id: number;
    schema: unknown;
    expectedSchemaSnapshotId: number;
    em: EntityManager;
  }): Promise<{ snapshotId: number; schema: DisplayOnlySchema }> {
    const { owner, id, expectedSchemaSnapshotId, em } = params;
    const target = SCHEMA_WRITE_TARGETS[owner];
    if (!target) {
      throw new Error(`${owner} has no editable display-only schema`);
    }
    const schema = this.parseDisplayOnlySchemaOrThrow(params.schema);
    const snapshot = await this.formSnapshotService.findOrCreate(schema, em);

    const result = await em
      .createQueryBuilder()
      .update(target.entity)
      .set({ schemaSnapshotId: snapshot.id })
      .where("id = :id", { id })
      .andWhere('"schemaSnapshotId" = :expectedSchemaSnapshotId', {
        expectedSchemaSnapshotId,
      })
      .execute();

    if (result.affected === 0) {
      throw new ConflictException(target.conflictMessage);
    }

    await this.formSnapshotService.recordHistorical({
      owner,
      ownerId: id,
      snapshotId: snapshot.id,
      em,
    });

    return { snapshotId: snapshot.id, schema };
  }
}
