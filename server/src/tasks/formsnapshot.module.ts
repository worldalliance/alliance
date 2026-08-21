import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { FormSnapshot } from "./entities/formsnapshot.entity";
import { FormSnapshotService } from "./formsnapshot.service";

@Module({
  imports: [TypeOrmModule.forFeature([FormSnapshot])],
  providers: [FormSnapshotService],
  exports: [FormSnapshotService],
})
export class FormSnapshotModule {}
