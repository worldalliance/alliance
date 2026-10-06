import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MessageTracking } from "./message-tracking.entity";
import { MessageTrackingService } from "./message-tracking.service";

@Module({
  imports: [TypeOrmModule.forFeature([MessageTracking])],
  providers: [MessageTrackingService],
  exports: [MessageTrackingService],
})
export class LinkTrackingModule {}
