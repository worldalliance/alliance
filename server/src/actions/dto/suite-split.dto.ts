import { type CohortExpression } from "@alliance/common/cohort-expression";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import {
  SplitVisibilityMode,
  type ParsedSplit,
  type ParsedSplitArm,
} from "../entities/action-suite-split.entity";

export const COMBINED_SPLIT_ID_PROPERTY = {
  type: Number,
  nullable: true,
  description:
    "Set when other members see the action as an arm of this combined split; actionName is then the split's title",
};

export class SuiteSplitArmDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  actionId: number;

  @ApiProperty({
    description: "Null on the last arm, which catches everyone else",
    nullable: true,
    type: Object,
  })
  rule: CohortExpression | null;

  @ApiProperty()
  optional: boolean;

  constructor(arm: ParsedSplitArm) {
    this.id = arm.id;
    this.actionId = arm.actionId;
    this.rule = arm.rule;
    this.optional = arm.optional;
  }
}

export class SuiteSplitDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: SplitVisibilityMode, enumName: "SplitVisibilityMode" })
  visibilityMode: SplitVisibilityMode;

  @ApiProperty({ nullable: true, type: Object })
  filterExpression: CohortExpression | null;

  @ApiProperty({ type: () => SuiteSplitArmDto, isArray: true })
  arms: SuiteSplitArmDto[];

  @ApiProperty({
    description:
      "Whether the arms have launched, after which only the title, visibility mode and optional flags change",
  })
  launched: boolean;

  constructor(split: ParsedSplit, launched: boolean) {
    this.id = split.id;
    this.title = split.title;
    this.visibilityMode = split.visibilityMode;
    this.filterExpression = split.filterExpression;
    this.arms = split.arms.map((arm) => new SuiteSplitArmDto(arm));
    this.launched = launched;
  }
}

export class SaveSuiteSplitArmDto {
  @ApiProperty()
  @IsInt()
  actionId: number;

  @ApiProperty({ nullable: true, type: Object })
  @IsOptional()
  @Type(() => Object)
  rule: unknown | null;

  @ApiProperty()
  @IsBoolean()
  optional: boolean;
}

export class SaveSuiteSplitDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ enum: SplitVisibilityMode, enumName: "SplitVisibilityMode" })
  @IsEnum(SplitVisibilityMode)
  visibilityMode: SplitVisibilityMode;

  @ApiProperty({ nullable: true, type: Object })
  @IsOptional()
  @Type(() => Object)
  filterExpression: unknown | null;

  @ApiProperty({ type: () => SaveSuiteSplitArmDto, isArray: true })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => SaveSuiteSplitArmDto)
  arms: SaveSuiteSplitArmDto[];
}
