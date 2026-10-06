import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LinkOpeningController } from "./link-opening.controller";
import { LinkOpening } from "./link-opening.entity";
import { LinkOpeningService } from "./link-opening.service";
import { MessageTracking } from "./message-tracking.entity";
import { MessageTrackingService } from "./message-tracking.service";

@Module({
  imports: [TypeOrmModule.forFeature([MessageTracking, LinkOpening])],
  providers: [MessageTrackingService, LinkOpeningService],
  controllers: [LinkOpeningController],
  exports: [MessageTrackingService],
})
export class LinkTrackingModule {}
