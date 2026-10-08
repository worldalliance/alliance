import { PartialType, PickType } from "@nestjs/swagger";
import { CustomLink } from "../entities/custom-link.entity";

export class CustomLinkDto extends PickType(CustomLink, [
  "id",
  "label",
  "slug",
  "destination",
  "visits",
  "createdAt",
  "updatedAt",
]) {
  constructor(input: CustomLink) {
    super();
    this.id = input.id;
    this.label = input.label;
    this.slug = input.slug;
    this.destination = input.destination;
    this.visits = input.visits;
    this.createdAt = input.createdAt;
    this.updatedAt = input.updatedAt;
  }
}

export class CreateCustomLinkDto extends PickType(CustomLink, [
  "label",
  "slug",
  "destination",
]) {}

export class UpdateCustomLinkDto extends PartialType(CreateCustomLinkDto) {}

export class CustomLinkDestinationDto extends PickType(CustomLink, [
  "destination",
]) {
  constructor(input: Pick<CustomLink, "destination">) {
    super();
    this.destination = input.destination;
  }
}
