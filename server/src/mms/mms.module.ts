import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventLogModule } from "src/eventlog/eventlog.module";
import { LinkTrackingModule } from "src/link-tracking/link-tracking.module";
import { S3Module } from "src/s3/s3.module";
import { User } from "src/user/entities/user.entity";
import { MmsMedia } from "./mms-media.entity";
import { MmsMediaService } from "./mms-media.service";
import { MmsOptout } from "./mms-optout.entity";
import { MmsThreadService } from "./mms-thread.service";
import { MmsUnsubService } from "./mms-unsub.service";
import { MmsController } from "./mms.controller";
import { Mms } from "./mms.entity";
import { MmsService } from "./mms.service";
import { TwilioStatusWorker } from "./twiliostatus.worker";

@Module({
  imports: [
    TypeOrmModule.forFeature([Mms, MmsMedia, MmsOptout, User]),
    forwardRef(() => EventLogModule),
    LinkTrackingModule,
    S3Module,
  ],
  providers: [
    MmsService,
    TwilioStatusWorker,
    MmsUnsubService,
    MmsThreadService,
    MmsMediaService,
  ],
  controllers: [MmsController],
  exports: [MmsService],
})
export class MmsModule {}
