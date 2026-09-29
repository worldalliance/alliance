import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WaitlistEntry } from "./entities/waitlist-entry.entity";
import { WaitlistLink } from "./entities/waitlist-link.entity";

@Module({
  imports: [TypeOrmModule.forFeature([WaitlistEntry, WaitlistLink])],
})
export class WaitlistModule {}
