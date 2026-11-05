import type { DisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
  PartialType,
  PickType,
} from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  Allow,
  Equals,
  IsInt,
  IsObject,
  IsOptional,
  ValidateBy,
  ValidateIf,
} from "class-validator";
import { displayOnlySchemaOf } from "src/tasks/display-only-snapshot";
import { ActionUpdate } from "../entities/action-update.entity";

export class ActionUpdateDto extends PickType(ActionUpdate, [
  "id",
  "title",
  "date",
  "actionId",
  "visibleAt",
  "notifyType",
  "notifiedAt",
  "shortNotifString",
  "associatedEvent",
  "associatedEventId",
  "schemaSnapshotId",
  "tag",
]) {
  @ApiProperty()
  @Type(() => Object)
  @Allow()
  schema: DisplayOnlySchema;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  actionName?: string;

  constructor(actionUpdate: ActionUpdate) {
    super();
    this.id = actionUpdate.id;
    this.title = actionUpdate.title;
    this.date = actionUpdate.date;
    this.actionId = actionUpdate.actionId;
    this.visibleAt = actionUpdate.visibleAt;
    this.notifyType = actionUpdate.notifyType;
    this.notifiedAt = actionUpdate.notifiedAt;
    this.shortNotifString = actionUpdate.shortNotifString;
    this.associatedEvent = actionUpdate.associatedEvent;
    this.associatedEventId = actionUpdate.associatedEventId;
    this.tag = actionUpdate.tag;
    this.schema = displayOnlySchemaOf({
      owner: "ActionUpdate",
      ownerId: actionUpdate.id,
      snapshot: actionUpdate.schemaSnapshot,
    });
    this.schemaSnapshotId = actionUpdate.schemaSnapshotId;
    this.actionName = actionUpdate.action?.name;
  }
}

const RELOAD_ADMIN = "Reload the admin to save this update.";

// BACKCOMPAT(split-collective-result): refuses an admin bundle from before
// the result always split, which would save non-completers as skipped or
// drop a separate uninvolved text. Drop once no such bundle can still be open.
class SplitCollectiveResultInput {
  @ApiPropertyOptional({ type: Boolean })
  @ValidateIf(
    (o: SplitCollectiveResultInput) => o.splitCollectiveResult !== undefined,
  )
  @Equals(true, { message: RELOAD_ADMIN })
  splitCollectiveResult?: true;

  @ApiPropertyOptional({ type: String, nullable: true })
  @ValidateIf(
    (o: SplitCollectiveResultInput) =>
      o.uninvolvedResult !== undefined &&
      (o.splitCollectiveResult === undefined ||
        o.splitCollectiveResult === true),
  )
  @ValidateBy(
    {
      name: "matchesNonCompleterResult",
      validator: {
        validate: (value, args) =>
          args !== undefined &&
          "nonCompleterResult" in args.object &&
          value === args.object.nonCompleterResult,
      },
    },
    { message: RELOAD_ADMIN },
  )
  uninvolvedResult?: string | null;
}

export class CreateActionUpdateDto extends IntersectionType(
  PickType(ActionUpdate, ["title", "date", "notifyType", "shortNotifString"]),
  PartialType(PickType(ActionUpdate, ["nonCompleterResult"])),
  SplitCollectiveResultInput,
) {
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  associatedEventId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  tagId?: string;
}

export class UpdateActionUpdateDto extends IntersectionType(
  PartialType(
    PickType(ActionUpdate, [
      "title",
      "date",
      "notifyType",
      "shortNotifString",
      "nonCompleterResult",
    ]),
  ),
  SplitCollectiveResultInput,
) {
  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  associatedEventId?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  tagId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  schema?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Number })
  @ValidateIf((dto: UpdateActionUpdateDto) => dto.schema !== undefined)
  @IsInt()
  expectedSchemaSnapshotId?: number;
}
