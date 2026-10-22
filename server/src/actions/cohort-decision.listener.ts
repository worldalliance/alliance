import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  ContractEvents,
  type ContractSignedPayload,
} from "src/contract/contract.events";
import { DetachedWorkTracker } from "src/utils/detached-work";
import { CohortDecisionService } from "./cohort-decision.service";

/**
 * Decides a newly signed member's open actions after the signing commits. A
 * failure leaves the work to the scheduled pass rather than failing the
 * signature.
 */
@Injectable()
export class CohortDecisionListener implements OnModuleDestroy {
  private readonly logger = new Logger(CohortDecisionListener.name);
  private readonly detachedWork = new DetachedWorkTracker();

  private readonly onContractSigned = ({ userId }: ContractSignedPayload) => {
    this.detachedWork.track(
      this.cohortDecisionService
        .resolveForUser(userId, new Date())
        .catch((error: unknown) =>
          this.logger.error(
            `Failed to decide cohorts for user ${userId} after signing`,
            error,
          ),
        ),
    );
  };

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly cohortDecisionService: CohortDecisionService,
  ) {
    this.eventEmitter.on(ContractEvents.Signed, this.onContractSigned);
  }

  async onModuleDestroy() {
    this.eventEmitter.off(ContractEvents.Signed, this.onContractSigned);
    await this.detachedWork.drain();
  }
}
