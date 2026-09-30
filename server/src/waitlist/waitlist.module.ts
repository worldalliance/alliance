import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventLogModule } from "src/eventlog/eventlog.module";
import { MailModule } from "src/mail/mail.module";
import { User } from "src/user/entities/user.entity";
import { UserModule } from "src/user/user.module";
import { WaitlistBrowser } from "./entities/waitlist-browser.entity";
import { WaitlistCohort } from "./entities/waitlist-cohort.entity";
import { WaitlistEntryAction } from "./entities/waitlist-entry-action.entity";
import { WaitlistEntryTag } from "./entities/waitlist-entry-tag.entity";
import { WaitlistEntry } from "./entities/waitlist-entry.entity";
import { WaitlistLink } from "./entities/waitlist-link.entity";
import { WaitlistMailAllowance } from "./entities/waitlist-mail-allowance.entity";
import { WaitlistTag } from "./entities/waitlist-tag.entity";
import { WaitlistAdminController } from "./waitlist-admin.controller";
import { WaitlistBrowserService } from "./waitlist-browser.service";
import { WaitlistCohortService } from "./waitlist-cohort.service";
import { WaitlistEntryAdminService } from "./waitlist-entry-admin.service";
import { WaitlistLinkService } from "./waitlist-link.service";
import { WaitlistMailService } from "./waitlist-mail.service";
import { WaitlistTagService } from "./waitlist-tag.service";
import { WaitlistController } from "./waitlist.controller";
import { WaitlistService } from "./waitlist.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      WaitlistBrowser,
      WaitlistCohort,
      WaitlistEntry,
      WaitlistEntryAction,
      WaitlistEntryTag,
      WaitlistLink,
      WaitlistMailAllowance,
      WaitlistTag,
    ]),
    MailModule,
    EventLogModule,
    UserModule,
  ],
  controllers: [WaitlistController, WaitlistAdminController],
  providers: [
    WaitlistService,
    WaitlistMailService,
    WaitlistBrowserService,
    WaitlistLinkService,
    WaitlistEntryAdminService,
    WaitlistTagService,
    WaitlistCohortService,
  ],
})
export class WaitlistModule {}
