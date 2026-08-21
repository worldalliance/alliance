import { Injectable, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { DetectableEntity } from "./entities/ai-detection-result.entity";

@Injectable()
export class EntityResolverService {
  constructor(private readonly dataSource: DataSource) {}

  private asBoolean(value: unknown): boolean {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      return value === "t" || value === "true" || value === "1";
    }
    if (typeof value === "number") {
      return value === 1;
    }
    return false;
  }

  async resolve(
    entityType: DetectableEntity,
    entityId: number,
  ): Promise<
    | { id: number; editableContent: { body: string | null } }
    | {
        id: number;
        answers: Record<string, unknown>;
        skipAiDetection: boolean;
      }
  > {
    switch (entityType) {
      case DetectableEntity.Comment: {
        const commentRows = await this.dataSource.query(
          `
          SELECT c."id", ec."body"
          FROM "comment" c
          LEFT JOIN "editable_content" ec ON ec."id" = c."editableContentId"
          WHERE c."id" = $1
          LIMIT 1
          `,
          [entityId],
        );
        const comment = commentRows[0] as
          | { id: number; body: string | null }
          | undefined;
        if (!comment) {
          throw new NotFoundException(`Comment ${entityId} was not found`);
        }
        return {
          id: comment.id,
          editableContent: { body: comment.body },
        };
      }
      case DetectableEntity.FormResponse: {
        console.log("Resolving form response", entityId);
        const responseRows = await this.dataSource.query(
          `
          SELECT
            fr."id",
            fr."answers",
            CASE
              WHEN u."id" IS NULL THEN false
              ELSE EXISTS (
                SELECT 1
                FROM "tag_users_user" tu
                INNER JOIN "tag" t ON t."id" = tu."tagId"
                WHERE tu."userId" = u."id"
                  AND LOWER(t."name") = 'staff'
              )
            END AS "hasStaffTag"
          FROM "form_response" fr
          LEFT JOIN "user" u ON u."id" = fr."userId"
          WHERE fr."id" = $1
          LIMIT 1
          `,
          [entityId],
        );
        const response = responseRows[0] as
          | {
              id: number;
              answers: Record<string, unknown>;
              hasStaffTag?: unknown;
            }
          | undefined;
        if (!response) {
          throw new NotFoundException(`FormResponse ${entityId} was not found`);
        }
        console.log("Resolved form response", response);
        return {
          id: response.id,
          answers: response.answers,
          skipAiDetection: false,
        };
      }
      default: {
        throw new NotFoundException(
          `Unsupported detectable entity type: ${entityType}`,
        );
      }
    }
  }
}
