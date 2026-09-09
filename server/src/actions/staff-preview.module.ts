import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import { ActionActivity } from "./entities/action-activity.entity";
import { Action } from "./entities/action.entity";
import { StaffPreviewService } from "./staff-preview.service";
import { StaffPreviewWorker } from "./staff-preview.worker";

@Module({
  imports: [TypeOrmModule.forFeature([Action, ActionActivity, User])],
  providers: [StaffPreviewService, StaffPreviewWorker],
  exports: [StaffPreviewService],
})
export class StaffPreviewModule {}
