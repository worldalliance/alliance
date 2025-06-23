import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { ActionsModule } from 'src/actions/actions.module';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [UserModule, ActionsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
