import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventLogModule } from "src/eventlog/eventlog.module";
import { User } from "src/user/entities/user.entity";
import { MmsOptout } from "./mms-optout.entity";
import { MmsUnsubService } from "./mms-unsub.service";
import { MmsController } from "./mms.controller";
import { Mms } from "./mms.entity";
import { MmsService } from "./mms.service";
import { TwilioStatusWorker } from "./twiliostatus.worker";

@Module({
  imports: [TypeOrmModule.forFeature([Mms, MmsOptout, User]), EventLogModule],
  providers: [MmsService, TwilioStatusWorker, MmsUnsubService],
  controllers: [MmsController],
  exports: [MmsService],
})
export class MmsModule {}
