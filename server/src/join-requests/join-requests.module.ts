import { Module } from "@nestjs/common";
import { EventLogModule } from "src/eventlog/eventlog.module";
import { JoinRequestsController } from "./join-requests.controller";
import { JoinRequestsService } from "./join-requests.service";

@Module({
  imports: [EventLogModule],
  controllers: [JoinRequestsController],
  providers: [JoinRequestsService],
})
export class JoinRequestsModule {}
