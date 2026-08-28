import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Action } from "./action.entity";

export enum ActionReviewerIcon {
  LinkedIn = "linkedin",
}

export const REVIEWER_NAME_MAX_LENGTH = 200;
// Longer URLs exist in the wild, but browsers and CDNs commonly cap around
// here.
export const REVIEWER_URL_MAX_LENGTH = 2048;
export const ACTION_REVIEWERS_MAX = 50;

/**
 * A non-user credited with reviewing an action (name + optional link).
 *
 * Request-side rules live in `ActionReviewerDto`; nothing validates this class.
 */
@Entity()
export class ActionReviewer {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id: number;

  @Column()
  @Index()
  @ApiProperty()
  actionId: number;

  @ManyToOne(() => Action, (action) => action.reviewers, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "actionId" })
  @Type(() => Action)
  action?: Relation<Action>;

  @Column({ type: "text" })
  @ApiProperty({
    description: "Display name of the reviewer",
    maxLength: REVIEWER_NAME_MAX_LENGTH,
  })
  name: string;

  @Column({ type: "text", nullable: true })
  @ApiProperty({
    type: String,
    nullable: true,
    description: "Link to the reviewer's website, LinkedIn, etc.",
    maxLength: REVIEWER_URL_MAX_LENGTH,
  })
  url: string | null;

  @Column({ type: "enum", enum: ActionReviewerIcon, nullable: true })
  @ApiProperty({
    enum: ActionReviewerIcon,
    enumName: "ActionReviewerIcon",
    nullable: true,
    description: "Icon shown next to the reviewer name",
  })
  icon: ActionReviewerIcon | null;

  @Column({ type: "int" })
  @ApiProperty({ description: "Display order within the action" })
  position: number;
}
