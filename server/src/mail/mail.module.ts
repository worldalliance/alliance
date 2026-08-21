import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import { Mail } from "./mail.entity";
import { MailService } from "./mail.service";
import { MailgunWebhookController } from "./mailgun.webhook.controller";

@Module({
  providers: [MailService],
  controllers: [MailgunWebhookController],
  exports: [MailService],
  imports: [TypeOrmModule.forFeature([Mail]), TypeOrmModule.forFeature([User])],
})
export class MailModule {}
