import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsNotEmpty, IsOptional } from "class-validator";
import { Notification } from "src/notifs/entities/notification.entity";
import {
  ACTION_UPDATE_SNAPSHOT_HISTORY_TABLE,
  FormSnapshot,
} from "src/tasks/entities/formsnapshot.entity";
import { Tag } from "src/user/entities/tag.entity";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
} from "typeorm";
import { ActionEvent } from "./action-event.entity";
import { Action } from "./action.entity";

export enum ActionUpdateNotifyType {
  None = "none",
  ActionCohort = "action_cohort",
  AllMembers = "all_members",
  Tag = "tag",
}

@Entity()
export class ActionUpdate {
  @PrimaryGeneratedColumn()
  @Allow()
  @ApiProperty()
  id: number;

  @ManyToOne(() => Action, (action) => action.updates, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "actionId" })
  @Type(() => Action)
  @Allow()
  @ApiProperty({ type: () => Action })
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  action: Relation<Action>;

  @RelationId((update: ActionUpdate) => update.action)
  @Type(() => Number)
  @ApiProperty()
  @IsNotEmpty()
  actionId: number;

  @Column({ type: "text" })
  @IsNotEmpty()
  @Allow()
  @ApiProperty()
  title: string;

  @Column()
  @ApiProperty()
  @Allow()
  schemaSnapshotId: number;

  @ManyToOne(() => FormSnapshot, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "schemaSnapshotId" })
  @Type(() => FormSnapshot)
  @IsOptional()
  schemaSnapshot?: Relation<FormSnapshot>;

  @ManyToMany(() => FormSnapshot)
  @JoinTable({
    name: ACTION_UPDATE_SNAPSHOT_HISTORY_TABLE,
    joinColumn: { name: "actionUpdateId", referencedColumnName: "id" },
    inverseJoinColumn: { name: "schemaSnapshotId", referencedColumnName: "id" },
  })
  @Type(() => FormSnapshot)
  @IsOptional()
  historicalSchemaSnapshots?: Relation<FormSnapshot>[];

  @Column({ type: "timestamptz" })
  @IsNotEmpty()
  @Type(() => Date)
  @ApiProperty({
    description: "What the update is displayed and sorted by.",
  })
  date: Date;

  // Null until an admin writes the body. Creating an update and authoring it
  // are separate steps, so this is what keeps a titled, body-less update off
  // the member-facing feeds while the editor is still open.
  @Column({ type: "timestamptz", nullable: true })
  @ApiProperty({
    type: Date,
    nullable: true,
    description:
      "When the update became visible to members; null while unpublished.",
  })
  @Type(() => Date)
  @IsOptional()
  visibleAt: Date | null;

  @Column({ type: "text" })
  @IsNotEmpty()
  @ApiProperty()
  shortNotifString: string;

  @ManyToOne(() => ActionEvent, (event) => event.updates, { nullable: true })
  @JoinColumn({ name: "associatedEventId" })
  @Type(() => ActionEvent)
  @ApiPropertyOptional({ type: () => ActionEvent, nullable: true })
  @IsOptional()
  associatedEvent?: Relation<ActionEvent> | null;

  @RelationId((update: ActionUpdate) => update.associatedEvent)
  @Type(() => Number)
  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  // eslint-disable-next-line local-rules/column-optionality -- legacy: pre-dates the rule, needs migrating
  associatedEventId?: number | null;

  @Column({
    type: "enum",
    enum: ActionUpdateNotifyType,
    default: ActionUpdateNotifyType.None,
  })
  @IsNotEmpty()
  @Allow()
  @ApiProperty({
    enum: ActionUpdateNotifyType,
    enumName: "ActionUpdateNotifyType",
  })
  notifyType: ActionUpdateNotifyType;

  // The notification transaction claims this timestamp before inserting the
  // audience rows, making delivery once-only across concurrent requests.
  @Column({ type: "timestamptz", nullable: true })
  @ApiProperty({ type: Date, nullable: true })
  @Type(() => Date)
  @IsOptional()
  notifiedAt: Date | null;

  @OneToMany(() => Notification, (notif) => notif.actionUpdate)
  @Type(() => Notification)
  @ApiProperty({ type: () => Notification, isArray: true })
  @Allow()
  // eslint-disable-next-line local-rules/relation-optionality -- legacy: pre-dates the rule, needs migrating
  notifs: Relation<Notification>[];

  @ManyToOne(() => Tag, { nullable: true })
  @JoinColumn({ name: "tagId" })
  @Type(() => Tag)
  @ApiPropertyOptional({ type: () => Tag, nullable: true })
  @IsOptional()
  tag?: Relation<Tag> | null;
}
