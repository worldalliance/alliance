import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserModule } from "src/user/user.module";
import { SuitePartitionPin } from "./entities/suite-partition-pin.entity";
import { SuitePartitionPlacement } from "./entities/suite-partition-placement.entity";
import { SuitePartitionVersion } from "./entities/suite-partition-version.entity";
import { SuitePartition } from "./entities/suite-partition.entity";
import { SuitePartitionsController } from "./suite-partitions.controller";
import { SuitePartitionsService } from "./suite-partitions.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SuitePartition,
      SuitePartitionVersion,
      SuitePartitionPin,
      SuitePartitionPlacement,
    ]),
    UserModule,
  ],
  controllers: [SuitePartitionsController],
  providers: [SuitePartitionsService],
})
export class SuitePartitionsModule {}
