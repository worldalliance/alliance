import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "src/utils/Repository";
import { In } from "typeorm";
import {
  AiDetectionResult,
  DetectableEntity,
} from "./entities/ai-detection-result.entity";

@Injectable()
export class AiDetectionQueryService {
  constructor(
    @InjectRepository(AiDetectionResult)
    private readonly detectionResultRepository: Repository<AiDetectionResult>,
  ) {}

  async findForEntities(
    entityType: DetectableEntity,
    entityIds: number[],
  ): Promise<Map<number, AiDetectionResult[]>> {
    const grouped = new Map<number, AiDetectionResult[]>();

    if (!entityIds.length) {
      return grouped;
    }

    const results = await this.detectionResultRepository.find({
      where: { entityType, entityId: In(entityIds) },
      order: { updatedAt: "DESC" },
    });

    for (const result of results) {
      const existing = grouped.get(result.entityId) ?? [];
      existing.push(result);
      grouped.set(result.entityId, existing);
    }

    return grouped;
  }
}
