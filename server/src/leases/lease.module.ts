import { Module, OnModuleInit } from "@nestjs/common";
import { LocksModule, LocksStorage } from "@nestjs/locks";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Lease } from "./lease.entity";
import { PgLockStore } from "./pg-lock-store";

@Module({
  imports: [
    // Renewed every ttl / 3: a 60-second lease every 20 seconds.
    LocksModule.forRoot({ ttl: "60s" }),
    TypeOrmModule.forFeature([Lease]),
  ],
  providers: [PgLockStore],
})
export class LeaseModule implements OnModuleInit {
  constructor(private readonly storage: LocksStorage) {}

  /** The package refuses its in-memory store only when NODE_ENV is production. */
  onModuleInit() {
    if (!(this.storage.source instanceof PgLockStore)) {
      throw new Error(
        "LeaseModule: leases are not on PgLockStore, so they would exclude only this process",
      );
    }
  }
}
