import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AiDetectionQueryService } from "./ai-detection-query.service";
import { AiDetectionQueueService } from "./ai-detection-queue.service";
import { AiDetectionProcessor } from "./ai-detection.processor";
import { AiDetectionResult } from "./entities/ai-detection-result.entity";
import { EntityResolverService } from "./entity-resolver.service";
import { PangramAiDetectionApiService } from "./pangram-ai-detection-api.service";

@Module({
  imports: [TypeOrmModule.forFeature([AiDetectionResult])],
  providers: [
    PangramAiDetectionApiService,
    EntityResolverService,
    AiDetectionProcessor,
    AiDetectionQueueService,
    AiDetectionQueryService,
  ],
  exports: [AiDetectionQueueService, AiDetectionQueryService],
})
export class AiDetectionModule {}
