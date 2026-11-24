import { Module } from "@nestjs/common";
import { SplitPlacementService } from "./split-placement.service";

/** Apart from `SuiteSplitsModule`, so cohort decisions can use it without a cycle. */
@Module({
  providers: [SplitPlacementService],
  exports: [SplitPlacementService],
})
export class SplitPlacementModule {}
