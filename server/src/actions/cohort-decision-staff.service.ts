import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { ActionCohortDecision } from "./entities/action-cohort-decision.entity";

@Injectable()
export class CohortDecisionStaffService {
  constructor(
    @InjectRepository(ActionCohortDecision)
    private readonly decisionRepository: Repository<ActionCohortDecision>,
  ) {}

  hasDecisions(actionId: number): Promise<boolean> {
    return this.decisionRepository.exists({ where: { actionId } });
  }
}
