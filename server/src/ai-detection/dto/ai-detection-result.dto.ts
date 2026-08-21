import { PickType } from "@nestjs/swagger";
import { AiDetectionResult } from "../entities/ai-detection-result.entity";

export class AiDetectionResultDto extends PickType(AiDetectionResult, [
  "id",
  "fieldPath",
  "status",
  "aiProbability",
  "modelVersion",
  "createdAt",
  "updatedAt",
]) {
  constructor(input: AiDetectionResult) {
    super();
    this.id = input.id;
    this.fieldPath = input.fieldPath;
    this.status = input.status;
    this.aiProbability = input.aiProbability;
    this.modelVersion = input.modelVersion;
    this.createdAt = input.createdAt;
    this.updatedAt = input.updatedAt;
  }
}
