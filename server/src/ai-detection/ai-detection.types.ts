import { DetectableEntity } from "./entities/ai-detection-result.entity";

export interface AiDetectionJobData {
  entityType: DetectableEntity;
  entityId: number;
}

export interface PangramAiDetectionResult {
  probability: number | null;
  raw: Record<string, unknown>;
  modelVersion: string | null;
}
