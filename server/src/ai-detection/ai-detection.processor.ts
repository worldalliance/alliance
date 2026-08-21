import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "src/utils/Repository";
import { In, Not } from "typeorm";
import { AiDetectionJobData } from "./ai-detection.types";
import { DETECTION_REGISTRY } from "./detection-registry";
import {
  AiDetectionResult,
  DetectionStatus,
} from "./entities/ai-detection-result.entity";
import { EntityResolverService } from "./entity-resolver.service";
import { PangramAiDetectionApiService } from "./pangram-ai-detection-api.service";

@Injectable()
export class AiDetectionProcessor {
  private readonly logger = new Logger(AiDetectionProcessor.name);

  constructor(
    @InjectRepository(AiDetectionResult)
    private readonly detectionResultRepository: Repository<AiDetectionResult>,
    private readonly entityResolver: EntityResolverService,
    private readonly pangramApiService: PangramAiDetectionApiService,
  ) {}

  async handleDetection(job: AiDetectionJobData): Promise<void> {
    const { entityType, entityId } = job;
    const config = DETECTION_REGISTRY.find(
      (entry) => entry.entityType === entityType,
    );
    if (!config) {
      this.logger.warn(
        `No AI detection config found for entityType=${entityType}`,
      );
      return;
    }

    const entity = await this.entityResolver.resolve(entityType, entityId);
    const fields = config.extractText(entity);
    const fieldPaths = fields.map((field) => field.fieldPath);

    if (fieldPaths.length === 0) {
      await this.detectionResultRepository.delete({ entityType, entityId });
      return;
    }

    await this.detectionResultRepository.delete({
      entityType,
      entityId,
      fieldPath: Not(In(fieldPaths)),
    });

    for (const field of fields) {
      await this.detectionResultRepository.upsert(
        {
          entityType,
          entityId,
          fieldPath: field.fieldPath,
          status: DetectionStatus.Processing,
          aiProbability: null,
          rawApiResponse: null,
          modelVersion: null,
        },
        ["entityType", "entityId", "fieldPath"],
      );

      try {
        const apiResult = await this.pangramApiService.check(field.text);
        await this.detectionResultRepository.update(
          {
            entityType,
            entityId,
            fieldPath: field.fieldPath,
          },
          {
            status: DetectionStatus.Completed,
            aiProbability: apiResult.probability,
            rawApiResponse: JSON.stringify(apiResult.raw),
            modelVersion: apiResult.modelVersion,
          },
        );
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        await this.detectionResultRepository.update(
          {
            entityType,
            entityId,
            fieldPath: field.fieldPath,
          },
          {
            status: DetectionStatus.Failed,
            aiProbability: null,
            rawApiResponse: JSON.stringify({ error: errorMessage }),
          },
        );
      }
    }
  }
}
