import { ApiProperty, PickType } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Allow, IsNumber } from "class-validator";
import { Tag } from "../entities/tag.entity";
import { ProfileDto } from "./user.dto";

export class TagDto extends PickType(Tag, [
  "id",
  "name",
  "description",
  "publicDisplayName",
  "createdAt",
  "updatedAt",
] as const) {
  @Allow()
  @ApiProperty({ type: ProfileDto, isArray: true })
  @Type(() => ProfileDto)
  users: ProfileDto[];

  constructor(tag: Tag) {
    super();
    this.id = tag.id;
    this.name = tag.name;
    this.description = tag.description;
    this.publicDisplayName = tag.publicDisplayName;
    this.createdAt = tag.createdAt;
    this.updatedAt = tag.updatedAt;
    this.users = tag.users ? tag.users.map((user) => new ProfileDto(user)) : [];
  }
}

export class TagSummaryDto extends PickType(Tag, [
  "id",
  "name",
  "description",
  "publicDisplayName",
  "createdAt",
  "updatedAt",
] as const) {
  constructor(tag: Tag) {
    super();
    this.id = tag.id;
    this.name = tag.name;
    this.description = tag.description;
    this.publicDisplayName = tag.publicDisplayName;
    this.createdAt = tag.createdAt;
    this.updatedAt = tag.updatedAt;
  }
}

export class CreateTagDto extends PickType(TagDto, [
  "name",
  "description",
  "publicDisplayName",
]) {}

export class AddUserToTagDto {
  @ApiProperty()
  @IsNumber()
  userId: number;
}
