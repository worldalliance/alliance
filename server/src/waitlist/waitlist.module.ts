import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WaitlistEntry } from "./entities/waitlist-entry.entity";
import { WaitlistLink } from "./entities/waitlist-link.entity";
import { WaitlistController } from "./waitlist.controller";
import { WaitlistService } from "./waitlist.service";

@Module({
  imports: [TypeOrmModule.forFeature([WaitlistEntry, WaitlistLink])],
  controllers: [WaitlistController],
  providers: [WaitlistService],
})
export class WaitlistModule {}
