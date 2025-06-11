import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { Mail } from './mail.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  providers: [MailService],
  exports: [MailService],
  imports: [TypeOrmModule.forFeature([Mail])],
})
export class MailModule {}
