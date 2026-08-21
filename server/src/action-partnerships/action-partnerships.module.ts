import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import { ActionPartnershipsController } from "./action-partnerships.controller";
import { ActionPartnershipsService } from "./action-partnerships.service";
import { ActionPartnershipNote } from "./entities/action-partnership-note.entity";
import { ActionPartnershipResponse } from "./entities/action-partnership-response.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActionPartnershipResponse,
      ActionPartnershipNote,
      User,
    ]),
  ],
  controllers: [ActionPartnershipsController],
  providers: [ActionPartnershipsService],
})
export class ActionPartnershipsModule {}
