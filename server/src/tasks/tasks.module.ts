import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ActionsModule } from "src/actions/actions.module";
import { Action } from "src/actions/entities/action.entity";
import { FollowUpForm } from "src/actions/entities/follow-up-form.entity";
import { AiDetectionModule } from "src/ai-detection/ai-detection.module";
import { AuthModule } from "src/auth/auth.module";
import { Guest } from "src/auth/entities/guest.entity";
import { ContractModule } from "src/contract/contract.module";
import { EventLogModule } from "src/eventlog/eventlog.module";
import { ForumModule } from "src/forum/forum.module";
import { MmsModule } from "src/mms/mms.module";
import { ShareUrlsModule } from "src/share-urls/share-urls.module";
import { User } from "src/user/entities/user.entity";
import { UserModule } from "src/user/user.module";
import { CustomValidatorController } from "./customvalidator.controller";
import { CustomValidatorService } from "./customvalidator.service";
import { CustomValidator } from "./entities/customvalidator.entity";
import { FormRowAssignment } from "./entities/form-row-assignment.entity";
import { Form } from "./entities/form.entity";
import { FormResponse } from "./entities/formresponse.entity";
import { FormResponseDraft } from "./entities/formresponsedraft.entity";
import { FormProfileAnswersService } from "./form-profile-answers.service";
import { FormResponseQueryService } from "./form-response-query.service";
import { FormResponseWriterService } from "./form-response-writer.service";
import { FormRowAssignmentService } from "./form-row-assignment.service";
import { FormSubmissionValidationService } from "./form-submission-validation.service";
import { FormSubmissionService } from "./form-submission.service";
import { FormSnapshotModule } from "./formsnapshot.module";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Form,
      FormResponse,
      FormResponseDraft,
      Action,
      CustomValidator,
      User,
      FollowUpForm,
      Guest,
      FormRowAssignment,
    ]),
    UserModule,
    ForumModule,
    ActionsModule,
    MmsModule,
    EventLogModule,
    AiDetectionModule,
    ContractModule,
    AuthModule,
    FormSnapshotModule,
    ShareUrlsModule,
  ],
  controllers: [TasksController, CustomValidatorController],
  providers: [
    TasksService,
    FormRowAssignmentService,
    CustomValidatorService,
    FormResponseQueryService,
    FormProfileAnswersService,
    FormSubmissionValidationService,
    FormResponseWriterService,
    FormSubmissionService,
  ],
})
export class TasksModule {}
