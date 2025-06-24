import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { ActionsModule } from 'src/actions/actions.module';
import { UserModule } from 'src/user/user.module';
import { PaymentUserDataToken } from './entities/payment-token.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from 'src/mail/mail.module';

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
