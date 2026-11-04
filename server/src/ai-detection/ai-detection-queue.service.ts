import { thrownStack } from "@alliance/common/errorMessage";
import { NodeEnv } from "@alliance/common/node-env";
import { Injectable, Logger } from "@nestjs/common";
import { env } from "../config/env";
import { AiDetectionProcessor } from "./ai-detection.processor";
import { AiDetectionJobData } from "./ai-detection.types";

@Injectable()
export class AiDetectionQueueService {
  private readonly logger = new Logger(AiDetectionQueueService.name);

  constructor(private readonly detectionProcessor: AiDetectionProcessor) {}

  async addDetectJob(job: AiDetectionJobData): Promise<void> {
    if (
      env("NODE_ENV") !== NodeEnv.Production &&
      !env("USE_DEV_AI_DETECTION")
    ) {
      return;
    }
    this.logger.log(
      `Adding AI detection job for ${job.entityType}:${job.entityId}`,
    );
    setImmediate(() => {
      void this.detectionProcessor.handleDetection(job).catch((error) => {
        this.logger.error(
          `Failed AI detection job for ${job.entityType}:${job.entityId}`,
          thrownStack(error),
        );
      });
    });
  }
}
