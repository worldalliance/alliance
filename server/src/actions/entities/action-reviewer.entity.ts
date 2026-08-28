import {
  HTTP_URL_VALIDATOR_OPTIONS,
  isValidHttpUrl,
} from "@alliance/common/url";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  Allow,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";
import type { Relation } from "src/utils/Repository";
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { z } from "zod";
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
 * An imported action arrives as arbitrary JSON, so its reviewers only get the
 * checks a request body gets from the ValidationPipe if they are parsed here.
 * `position` is advisory; import renumbers from the sorted order.
 */
export const importedReviewersSchema = z
  .array(
    z.object({
      name: z.string().min(1).max(REVIEWER_NAME_MAX_LENGTH),
      url: z
        .string()
        .max(REVIEWER_URL_MAX_LENGTH)
        .refine(isValidHttpUrl, "must be an http(s) URL")
        .nullish(),
      icon: z.enum(ActionReviewerIcon).nullish(),
      position: z.number().int().nullish(),
    }),
  )
  .max(ACTION_REVIEWERS_MAX);

/** A non-user credited with reviewing an action (name + optional link). */
@Entity()
export class ActionReviewer {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  @Allow()
  id: number;

  @Column()
  @Index()
  @ApiProperty()
  @Allow()
  actionId: number;

  @ManyToOne(() => Action, (action) => action.reviewers, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "actionId" })
  @Type(() => Action)
  @IsOptional()
  action?: Relation<Action>;

  @Column({ type: "text" })
  @ApiProperty({
    description: "Display name of the reviewer",
    maxLength: REVIEWER_NAME_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(REVIEWER_NAME_MAX_LENGTH)
  name: string;

  @Column({ type: "text", nullable: true })
  @ApiProperty({
    type: String,
    nullable: true,
    description: "Link to the reviewer's website, LinkedIn, etc.",
    maxLength: REVIEWER_URL_MAX_LENGTH,
  })
  @IsOptional()
  @IsUrl(HTTP_URL_VALIDATOR_OPTIONS)
  @MaxLength(REVIEWER_URL_MAX_LENGTH)
  url: string | null;

  @Column({ type: "enum", enum: ActionReviewerIcon, nullable: true })
  @ApiProperty({
    enum: ActionReviewerIcon,
    enumName: "ActionReviewerIcon",
    nullable: true,
    description: "Icon shown next to the reviewer name",
  })
  @IsOptional()
  @IsEnum(ActionReviewerIcon)
  icon: ActionReviewerIcon | null;

  @Column({ type: "int" })
  @ApiProperty({ description: "Display order within the action" })
  @IsInt()
  position: number;
}
