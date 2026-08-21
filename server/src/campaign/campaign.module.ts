import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import { CampaignController } from "./campaign.controller";
import { CampaignService } from "./campaign.service";
import { Campaign } from "./entities/campaign.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, User])],
  controllers: [CampaignController],
  providers: [CampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
