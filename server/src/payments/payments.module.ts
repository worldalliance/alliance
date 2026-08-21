import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ActionsModule } from "src/actions/actions.module";
import { MailModule } from "src/mail/mail.module";
import { UserModule } from "src/user/user.module";
import { PaymentUserDataToken } from "./entities/payment-token.entity";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [
    UserModule,
    ActionsModule,
    TypeOrmModule.forFeature([PaymentUserDataToken]),
    MailModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
