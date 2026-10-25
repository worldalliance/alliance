import { HTTP_URL_VALIDATOR_OPTIONS } from "@alliance/common/url";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";
import {
  ActionReviewer,
  ActionReviewerIcon,
  REVIEWER_NAME_MAX_LENGTH,
  REVIEWER_URL_MAX_LENGTH,
} from "../entities/action-reviewer.entity";

/**
 * The wire shape of a reviewer: the display fields only. Ids and ordering are
 * server-owned, and an update replaces the whole list rather than patching
 * rows, so neither is meaningful to a client.
 *
 * class-transformer instantiates this one with no arguments to validate a
 * request body, so it must stay constructor-less; the outbound half is
 * {@link ActionReviewerResponseDto}.
 */
export class ActionReviewerDto {
  @ApiProperty({ description: "Display name of the reviewer" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(REVIEWER_NAME_MAX_LENGTH)
  name: string;

  @ApiPropertyOptional({
    description: "Link to the reviewer's website, LinkedIn, etc.",
  })
  @IsOptional()
  @IsUrl(HTTP_URL_VALIDATOR_OPTIONS)
  @MaxLength(REVIEWER_URL_MAX_LENGTH)
  url?: string;

  @ApiPropertyOptional({
    enum: ActionReviewerIcon,
    enumName: "ActionReviewerIcon",
    description: "Icon shown next to the reviewer name",
  })
  @IsOptional()
  @IsEnum(ActionReviewerIcon)
  icon?: ActionReviewerIcon;
}

export class ActionReviewerResponseDto extends ActionReviewerDto {
  constructor(input: ActionReviewer) {
    super();
    this.name = input.name;
    this.url = input.url ?? undefined;
    this.icon = input.icon ?? undefined;
  }
}
