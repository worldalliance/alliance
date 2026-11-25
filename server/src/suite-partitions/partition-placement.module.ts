import { Module } from "@nestjs/common";
import { PartitionPlacementService } from "./partition-placement.service";

/** Apart from `SuitePartitionsModule`, so cohort decisions can use it without a cycle. */
@Module({
  providers: [PartitionPlacementService],
  exports: [PartitionPlacementService],
})
export class PartitionPlacementModule {}
