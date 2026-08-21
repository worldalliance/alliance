import { PartialType, PickType } from "@nestjs/swagger";
import { ExternalShareTarget } from "../entities/external-share-target.entity";

export class ExternalShareTargetDto extends PickType(ExternalShareTarget, [
  "id",
  "name",
  "url",
  "paramName",
  "createdAt",
  "updatedAt",
]) {
  constructor(target: ExternalShareTarget) {
    super();
    this.id = target.id;
    this.name = target.name;
    this.url = target.url;
    this.paramName = target.paramName;
    this.createdAt = target.createdAt;
    this.updatedAt = target.updatedAt;
  }
}

export class CreateExternalShareTargetDto extends PickType(
  ExternalShareTarget,
  ["name", "url", "paramName"],
) {}

export class UpdateExternalShareTargetDto extends PartialType(
  PickType(ExternalShareTarget, ["name", "url", "paramName"]),
) {}
