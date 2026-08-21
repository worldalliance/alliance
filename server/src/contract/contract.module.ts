import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CommunityModule } from "src/community/community.module";
import { EventLogModule } from "src/eventlog/eventlog.module";
import { NotifsModule } from "src/notifs/notifs.module";
import { ContractEvent } from "src/user/entities/contract-event.entity";
import { User } from "src/user/entities/user.entity";
import { UserModule } from "src/user/user.module";
import { ContractController } from "./contract.controller";
import { ContractService } from "./contract.service";
import { Contract } from "./entities/contract.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, ContractEvent, User]),
    forwardRef(() => UserModule),
    CommunityModule,
    EventLogModule,
    NotifsModule,
  ],
  controllers: [ContractController],
  providers: [ContractService],
  exports: [ContractService],
})
export class ContractModule {}
