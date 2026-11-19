import { Module } from "@nestjs/common";
import { LocksModule } from "@nestjs/locks";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Lease } from "./lease.entity";
import { PgLockStore } from "./pg-lock-store";

@Module({
  imports: [LocksModule.forRoot(), TypeOrmModule.forFeature([Lease])],
  providers: [PgLockStore],
})
export class LeaseModule {}
