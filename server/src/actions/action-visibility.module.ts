import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Community } from "src/community/entities/community.entity";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { User } from "src/user/entities/user.entity";
import { ActionBranchService } from "./action-branch.service";
import { ActionVisibilityService } from "./action-visibility.service";
import { CohortAdmissionService } from "./cohort-admission.service";
import { ActionActivity } from "./entities/action-activity.entity";
import { ActionCohortDecision } from "./entities/action-cohort-decision.entity";
import { ActionFormAssignment } from "./entities/action-form-assignment.entity";
import { ActionFormVariant } from "./entities/action-form-variant.entity";
import { Action } from "./entities/action.entity";
import { PrerequisiteProgressService } from "./prerequisite-progress.service";
import { SingleMemberCohortService } from "./single-member-cohort.service";

/** Kept apart from ActionsModule, which imports NotifsModule, so notifications can import it without a cycle. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Action,
      ActionActivity,
      ActionCohortDecision,
      ActionFormAssignment,
      ActionFormVariant,
      Community,
      FormResponse,
      User,
    ]),
  ],
  providers: [
    ActionBranchService,
    ActionVisibilityService,
    CohortAdmissionService,
    PrerequisiteProgressService,
    SingleMemberCohortService,
  ],
  exports: [
    ActionBranchService,
    ActionVisibilityService,
    CohortAdmissionService,
    PrerequisiteProgressService,
    SingleMemberCohortService,
  ],
})
export class ActionVisibilityModule {}
