import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import { UserModule } from "src/user/user.module";
import { EventLog } from "./event-log.entity";
import { EventLogController } from "./eventlog.controller";
import { EventLogGateway } from "./eventlog.gateway";
import { EventLogService } from "./eventlog.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([EventLog, User]),
    forwardRef(() => UserModule),
  ],
  controllers: [EventLogController],
  providers: [EventLogService, EventLogGateway],
  exports: [EventLogService],
})
export class EventLogModule {}
