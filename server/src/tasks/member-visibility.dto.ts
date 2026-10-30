import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsDefined, IsInt } from "class-validator";
import type { VisibilityProfile } from "./member-visibility.service";

const MAX_PROFILED_USERS = 5000;

export class VisibilityProfilesRequestDto {
  @ApiProperty()
  @IsDefined()
  @Type(() => Object)
  schema: Record<string, unknown>;

  @ApiProperty({ type: Number, isArray: true })
  @IsArray()
  @ArrayMaxSize(MAX_PROFILED_USERS)
  @IsInt({ each: true })
  userIds: number[];
}

export class VisibilityProfileDto {
  /** One verdict per `memberConditions(schema)` entry, in order. */
  @ApiProperty({ type: Boolean, isArray: true })
  results: boolean[];

  @ApiProperty({ type: Number, isArray: true })
  userIds: number[];

  constructor(input: VisibilityProfile) {
    this.results = input.results;
    this.userIds = input.userIds;
  }
}

export class VisibilityProfilesDto {
  @ApiProperty({ type: () => VisibilityProfileDto, isArray: true })
  profiles: VisibilityProfileDto[];

  constructor(profiles: VisibilityProfile[]) {
    this.profiles = profiles.map(
      (profile) => new VisibilityProfileDto(profile),
    );
  }
}
