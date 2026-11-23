import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserModule } from "src/user/user.module";
import { SuiteSplitPin } from "./entities/suite-split-pin.entity";
import { SuiteSplitVersion } from "./entities/suite-split-version.entity";
import { SuiteSplit } from "./entities/suite-split.entity";
import { SuiteSplitsController } from "./suite-splits.controller";
import { SuiteSplitsService } from "./suite-splits.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([SuiteSplit, SuiteSplitVersion, SuiteSplitPin]),
    UserModule,
  ],
  controllers: [SuiteSplitsController],
  providers: [SuiteSplitsService],
})
export class SuiteSplitsModule {}
