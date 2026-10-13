import { ApiProperty, PickType } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { HostedDoc } from "../entities/hosted-doc.entity";

export class HostedDocDto extends PickType(HostedDoc, [
  "id",
  "slug",
  "notes",
  "views",
  "createdAt",
  "fileReplacedAt",
]) {
  @ApiProperty({ type: String, nullable: true })
  uploadedByName: string | null;

  @ApiProperty({ type: String, nullable: true })
  fileReplacedByName: string | null;

  constructor(input: HostedDoc) {
    super();
    this.id = input.id;
    this.slug = input.slug;
    this.notes = input.notes;
    this.views = input.views;
    this.createdAt = input.createdAt;
    this.fileReplacedAt = input.fileReplacedAt;
    this.uploadedByName = input.uploadedBy?.name ?? null;
    this.fileReplacedByName = input.fileReplacedBy?.name ?? null;
  }
}

export class CreateHostedDocDto {
  @ApiProperty()
  @IsString()
  slug: string;

  @ApiProperty()
  @IsString()
  notes: string;
}

export class UpdateHostedDocDto extends PickType(CreateHostedDocDto, [
  "notes",
]) {}
