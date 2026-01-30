import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mms } from './mms.entity';
import { MmsService } from './mms.service';
import { TwilioStatusWorker } from './twiliostatus.worker';
import { SlackModule } from 'src/slack/slack.module';

@Module({
  imports: [TypeOrmModule.forFeature([Mms]), SlackModule],
  providers: [MmsService, TwilioStatusWorker],
  exports: [MmsService],
})
export class MmsModule { }
